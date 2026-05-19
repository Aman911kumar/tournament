import ApiError from "../../utils/ApiError.js";
import { clampInt, cleanEnv, parseBoolean, positiveNumber } from "./email.utils.js";
import { EMAIL_JOB_NAME, EMAIL_QUEUE_NAME } from "./email.constants.js";

let queue = null;
let worker = null;
let queueEvents = null;

const resolveRedisUrl = () =>
  cleanEnv(process.env.EMAIL_QUEUE_REDIS_URL || process.env.REDIS_URL || "");

const queueEnabled = () =>
  parseBoolean(process.env.EMAIL_QUEUE_ENABLED, true) && Boolean(resolveRedisUrl());

export const isEmailQueueEnabled = () => queueEnabled();

export const getEmailQueue = async () => {
  if (!queueEnabled()) return null;
  if (queue) return queue;

  const { Queue } = await import("bullmq");
  const { default: IORedis } = await import("ioredis");

  const redisUrl = resolveRedisUrl();
  if (!redisUrl) throw new ApiError(500, "EMAIL_QUEUE_REDIS_URL is missing for email queue");

  const prefix = cleanEnv(process.env.EMAIL_QUEUE_PREFIX || "b4a");
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  queue = new Queue(EMAIL_QUEUE_NAME, { connection, prefix });
  return queue;
};

export const enqueueEmailJob = async (jobData, options = {}) => {
  const q = await getEmailQueue();
  if (!q) return null;

  const attempts = clampInt(options.attempts ?? process.env.EMAIL_MAX_RETRIES, 1, 20, 4);
  const baseDelayMs = positiveNumber(options.delayMs ?? process.env.EMAIL_RETRY_DELAY_MS, 1500);
  const removeOnComplete = clampInt(process.env.EMAIL_REMOVE_ON_COMPLETE, 1, 5000, 50);
  const removeOnFail = clampInt(process.env.EMAIL_REMOVE_ON_FAIL, 50, 20000, 2000);

  const jobId = options.jobId || jobData?.idempotencyKey || undefined;

  return q.add(EMAIL_JOB_NAME, jobData, {
    jobId,
    attempts,
    backoff: { type: "exponential", delay: baseDelayMs },
    removeOnComplete: { count: removeOnComplete },
    removeOnFail: { count: removeOnFail },
  });
};

export const startEmailWorker = async (processor) => {
  if (!queueEnabled()) return null;
  if (worker) return worker;

  const { Worker, QueueEvents } = await import("bullmq");
  const { default: IORedis } = await import("ioredis");

  const redisUrl = resolveRedisUrl();
  const prefix = cleanEnv(process.env.EMAIL_QUEUE_PREFIX || "b4a");
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });

  const concurrency = clampInt(process.env.EMAIL_WORKER_CONCURRENCY, 1, 25, 4);

  worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => processor(job.data, { job }),
    { connection, prefix, concurrency },
  );

  queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, { connection: connection.duplicate(), prefix });

  worker.on("failed", (job, err) => {
    console.error("Email job failed:", {
      id: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      message: err?.message,
    });
  });

  worker.on("completed", (job) => {
    if (!parseBoolean(process.env.EMAIL_LOG_COMPLETED_JOBS, false)) return;
    console.log("Email job completed:", { id: job?.id, name: job?.name });
  });

  return worker;
};

export const stopEmailWorker = async () => {
  if (queueEvents) {
    await queueEvents.close().catch(() => undefined);
    queueEvents = null;
  }
  if (worker) {
    await worker.close().catch(() => undefined);
    worker = null;
  }
  if (queue) {
    await queue.close().catch(() => undefined);
    queue = null;
  }
};

