import { startEmailWorker } from "./email.queue.js";
import { emailService, sendEmailDirect } from "./email.service.js";
import { decryptJsonAes256Gcm, getEmailQueueEncryptionKey, parseBoolean } from "./email.utils.js";

export * from "./email.constants.js";
export * from "./email.service.js";
export * from "./email.templates.js";
export * from "./email.queue.js";
export * from "./email.utils.js";

// Single-process worker bootstrap (can be disabled in production when running a separate worker service).
export const initEmailSystem = async () => {
  const enableWorker = parseBoolean(process.env.EMAIL_WORKER_ENABLED, true);
  if (!enableWorker) return null;

  return startEmailWorker(async (jobData, meta) => {
    // jobData contains the full email request. Do not store secrets in job payloads.
    const normalized = { ...jobData };
    if (normalized.encrypted) {
      const key = getEmailQueueEncryptionKey();
      if (!key) {
        throw new Error("EMAIL_QUEUE_ENCRYPTION_KEY is required to decrypt queued email payload");
      }
      const decrypted = decryptJsonAes256Gcm(normalized.encrypted, key);
      delete normalized.encrypted;
      Object.assign(normalized, decrypted);
    }

    const result = await sendEmailDirect(normalized);
    if (parseBoolean(process.env.EMAIL_LOG_PROVIDER_RESULT, false)) {
      console.log("Email sent:", {
        provider: result?.provider,
        messageId: result?.messageId,
        idempotencyKey: normalized?.idempotencyKey,
        requestId: normalized?.requestId,
        jobId: meta?.job?.id,
      });
    }
    return result;
  });
};

export default emailService;
