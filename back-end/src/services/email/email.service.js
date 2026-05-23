import ApiError from "../../utils/ApiError.js";
import { getRuntimeConfig, SERVER_ROLES } from "../../utils/runtime.js";
import { EMAIL_PROVIDERS, EMAIL_TEMPLATE_TYPES } from "./email.constants.js";
import { enqueueEmailJob, isEmailQueueEnabled } from "./email.queue.js";
import {
  assertValidRecipient,
  cleanEnv,
  clampInt,
  encryptJsonAes256Gcm,
  getEmailQueueEncryptionKey,
  parseBoolean,
  stableIdempotencyKey,
} from "./email.utils.js";
import {
  buildEmailVerificationEmail,
  buildNotificationEmail,
  buildOtpVerificationEmail,
  buildPasswordResetEmail,
  buildPhoneVerificationEmail,
  resolveEmailFrom,
} from "./email.templates.js";
import { createHostingerProvider } from "./providers/hostinger.provider.js";
import { createSendPlusProvider } from "./providers/sendplus.provider.js";
import { logEmailDeliveryAttempt } from "./email.logger.js";

const resolveProviderOrder = () => {
  const fromEnv = cleanEnv(process.env.EMAIL_PROVIDER_ORDER || "");
  const list = fromEnv
    ? fromEnv.split(",").map((v) => v.trim()).filter(Boolean)
    : [process.env.EMAIL_PRIMARY_PROVIDER, process.env.EMAIL_FALLBACK_PROVIDER].filter(Boolean).map(String);

  const normalized = list.map((v) => v.toLowerCase());
  return normalized.length ? normalized : [EMAIL_PROVIDERS.hostinger, EMAIL_PROVIDERS.sendplus];
};

const buildProviders = () => {
  const registry = {
    [EMAIL_PROVIDERS.hostinger]: createHostingerProvider(),
    [EMAIL_PROVIDERS.sendplus]: createSendPlusProvider(),
  };

  const order = resolveProviderOrder();

  // Respect explicit order from env. Provider "priority" is used only as a fallback for providers
  // that are configured but not listed in EMAIL_PROVIDER_ORDER.
  const providers = [];
  const seen = new Set();
  for (const name of order) {
    const provider = registry[name];
    if (!provider) continue;
    if (!provider.isConfigured()) continue;
    if (seen.has(provider)) continue;
    providers.push(provider);
    seen.add(provider);
  }

  // Add any configured providers not mentioned in order as tail.
  const tail = Object.values(registry)
    .filter((p) => p.isConfigured() && !seen.has(p))
    .sort((a, b) => a.priority - b.priority);

  return [...providers, ...tail];
};

let cachedProviders = null;
const getProviders = () => {
  if (!cachedProviders) cachedProviders = buildProviders();
  return cachedProviders;
};

// Health cache to avoid verifying SMTP on every job.
const healthCache = new Map(); // providerName -> { ok, checkedAtMs, reason }

const healthTtlMs = () => {
  const ms = Number(process.env.EMAIL_HEALTH_TTL_MS || 30_000);
  return Number.isFinite(ms) && ms > 1000 ? ms : 30_000;
};

const markHealth = (providerName, result) => {
  healthCache.set(providerName, {
    ok: Boolean(result?.ok),
    checkedAtMs: Date.now(),
    reason: result?.reason || "",
  });
};

const getCachedHealth = (providerName) => healthCache.get(providerName) || null;

const checkProviderHealth = async (provider) => {
  const cached = getCachedHealth(provider.name);
  const ttl = healthTtlMs();
  if (cached && Date.now() - cached.checkedAtMs < ttl) return cached;

  const res = await provider.healthCheck();
  markHealth(provider.name, res);
  return getCachedHealth(provider.name);
};

const retryConfig = () => ({
  attempts: clampInt(process.env.EMAIL_MAX_RETRIES, 1, 20, 4),
  baseDelayMs: Number(process.env.EMAIL_RETRY_DELAY_MS || process.env.EMAIL_RETRY_DELAY || 1500) || 1500,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canSendEmailLocally = () => {
  const runtime = getRuntimeConfig();
  if (parseBoolean(process.env.EMAIL_ALLOW_LOCAL_SEND, false)) return true;
  if (runtime.isLocal) return true;
  if (runtime.isRender || runtime.role === SERVER_ROLES.REALTIME) return false;
  return runtime.isVercel || runtime.role === SERVER_ROLES.FAST || runtime.role === SERVER_ROLES.HYBRID;
};

const shouldSendInline = () => {
  const runtime = getRuntimeConfig();
  if ((runtime.isServerless || runtime.role === SERVER_ROLES.FAST) && !parseBoolean(process.env.EMAIL_FORCE_QUEUE, false)) {
    return true;
  }

  const configured = process.env.EMAIL_SEND_INLINE;
  if (cleanEnv(configured)) return parseBoolean(configured, false);
  return false;
};

const shouldFireAndForget = () => {
  const runtime = getRuntimeConfig();
  if (runtime.isServerless || runtime.role === SERVER_ROLES.FAST) return false;
  return parseBoolean(process.env.EMAIL_FIRE_AND_FORGET, true) && !isEmailQueueEnabled() && !shouldSendInline();
};

const getFastEmailDispatchUrl = () => {
  const exact = cleanEnv(process.env.EMAIL_INTERNAL_SEND_URL || process.env.EMAIL_DISPATCH_URL || "");
  if (exact) return exact;

  const base = cleanEnv(
    process.env.EMAIL_FAST_API_URL ||
    process.env.FAST_API_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    ""
  ).replace(/\/$/, "");

  if (!base) return "";
  return `${base.replace(/\/api\/v\d+\/?$/, "")}/api/v1/email/internal/send`;
};

const shouldDelegateEmail = () => {
  if (canSendEmailLocally()) return false;
  return parseBoolean(process.env.EMAIL_DELEGATE_TO_FAST_API, true);
};

const delegateEmailToFastApi = async (job) => {
  const url = getFastEmailDispatchUrl();
  const secret = cleanEnv(process.env.INTERNAL_EMAIL_SECRET || process.env.EMAIL_INTERNAL_SECRET || "");

  if (!url || !secret) {
    throw new ApiError(503, "Email dispatch is disabled on this backend role. Configure EMAIL_FAST_API_URL and INTERNAL_EMAIL_SECRET to delegate through Vercel.");
  }

  const controller = new AbortController();
  const timeoutMs = clampInt(process.env.EMAIL_DELEGATE_TIMEOUT_MS, 3_000, 60_000, 15_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-internal-email-secret": secret,
        ...(job.requestId ? { "x-request-id": job.requestId } : {}),
      },
      body: JSON.stringify({ email: job }),
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ApiError(response.status, json?.message || "Fast email dispatch failed", json?.errors || []);
    }

    return {
      delegated: true,
      idempotencyKey: job.idempotencyKey,
      provider: json?.data?.provider,
      messageId: json?.data?.messageId,
      fastRequestId: json?.requestId || json?.data?.requestId,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(504, "Fast email dispatch timed out");
    }
    if (error instanceof SyntaxError) {
      throw new ApiError(502, "Fast email dispatch returned an invalid response");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const sendWithRetriesInline = async (job) => {
  const { attempts, baseDelayMs } = retryConfig();

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await sendEmailDirect(job);
    } catch (error) {
      lastError = error;
      const backoff = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
      const jitter = Math.floor(Math.random() * 250);
      const delay = Math.min(backoff + jitter, 60_000);
      if (attempt < attempts) {
        await sleep(delay);
      }
    }
  }

  throw lastError || new ApiError(502, "Email send failed");
};

export const sendEmailDirect = async (request) => {
  if (!canSendEmailLocally()) {
    throw new ApiError(409, "Email dispatch is disabled on this backend role. Use the fast API email dispatcher.");
  }

  assertValidRecipient(request.to);
  if (!request.subject || !request.html) {
    throw new ApiError(400, "Email subject and html are required");
  }

  const from = cleanEnv(request.from) || resolveEmailFrom();
  if (!from) throw new ApiError(500, "EMAIL_FROM is missing");

  const providers = getProviders();
  if (providers.length === 0) {
    throw new ApiError(500, "No email providers are configured");
  }

  const errors = [];
  for (const provider of providers) {
    const health = await checkProviderHealth(provider);
    if (health && health.ok === false) {
      // Don't silently skip: surface the health reason so operators can diagnose quickly.
      errors.push({
        provider: provider.name,
        error: health.reason || "health_check_failed",
      });
      continue;
    }

    try {
      const res = await provider.send({ ...request, from });
      markHealth(provider.name, { ok: true });
      logEmailDeliveryAttempt({
        status: "sent",
        provider: provider.name,
        to: request.to,
        subject: request.subject,
        templateType: request.templateType,
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        messageId: res?.messageId,
        providerMessageId: res?.providerMessageId,
      }).catch(() => undefined);
      return { provider: provider.name, ...res };
    } catch (err) {
      markHealth(provider.name, { ok: false, reason: err?.message || "send_failed" });
      const errorMessage = err?.message || "Failed to send";
      errors.push({ provider: provider.name, error: errorMessage });
      logEmailDeliveryAttempt({
        status: "failed",
        provider: provider.name,
        to: request.to,
        subject: request.subject,
        templateType: request.templateType,
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        error: errorMessage,
      }).catch(() => undefined);
      continue;
    }
  }

  const top = errors[0]?.error || "";
  const message = top ? `All email providers failed: ${top}` : "All email providers failed";
  throw new ApiError(502, message, errors);
};

export const enqueueEmail = async (request) => {
  assertValidRecipient(request.to);

  const idempotencyKey =
    request.idempotencyKey ||
    stableIdempotencyKey([request.templateType || "generic", request.to, request.subject, request.requestId || ""]);

  const job = {
    ...request,
    idempotencyKey,
    queuedAt: new Date().toISOString(),
  };

  // Realtime/Render deployments must not touch SMTP. They delegate email work to
  // the fast Vercel API, which owns auth/email-capable workflows.
  if (shouldDelegateEmail()) {
    return delegateEmailToFastApi(job);
  }

  // Queue mode (preferred in production).
  if (isEmailQueueEnabled() && !shouldSendInline()) {
    // BullMQ stores job data in Redis. Avoid storing secrets in cleartext when possible.
    const key = getEmailQueueEncryptionKey();
    const jobForQueue = { ...job };
    if (!key && parseBoolean(process.env.EMAIL_QUEUE_REQUIRE_ENCRYPTION, false)) {
      throw new ApiError(500, "EMAIL_QUEUE_ENCRYPTION_KEY is required when EMAIL_QUEUE_REQUIRE_ENCRYPTION=true");
    }
    if (key) {
      const encrypted = encryptJsonAes256Gcm(
        {
          subject: job.subject,
          html: job.html,
          text: job.text,
          from: job.from,
          replyTo: job.replyTo,
          templateData: job.templateData,
        },
        key
      );

      delete jobForQueue.subject;
      delete jobForQueue.html;
      delete jobForQueue.text;
      delete jobForQueue.from;
      delete jobForQueue.replyTo;
      delete jobForQueue.templateData;

      jobForQueue.encrypted = encrypted;
    }

    await enqueueEmailJob(jobForQueue, { jobId: idempotencyKey });
    return { queued: true, idempotencyKey };
  }

  // Fire-and-forget mode (no Redis queue configured).
  if (shouldFireAndForget()) {
    setImmediate(() => {
      sendWithRetriesInline(job).catch((error) => {
        const details = error?.errors || error?.details || [];
        console.error("Email send failed (fire-and-forget):", {
          idempotencyKey,
          requestId: request.requestId,
          message: error?.message || error,
          errors: Array.isArray(details) ? details : [],
        });
      });
    });
    return { queued: true, idempotencyKey };
  }

  // Fallback: inline send (still has provider fallback + health checks).
  return sendEmailDirect(job);
};

export const emailService = {
  send: enqueueEmail,
  sendDirect: sendEmailDirect,
  getProviders,
  checkProviderHealth,
};

// High-level helpers used by controllers/services
export const sendOtpVerificationEmail = async ({ to, username, otpCode, expiresInMinutes = 5, requestId, idempotencyKey }) => {
  const html = buildOtpVerificationEmail({ username, otpCode, expiresInMinutes });

  return emailService.send({
    to,
    subject: "Your Battle4Arena verification code",
    html,
    text: `Battle4Arena verification code: ${otpCode} (expires in ${expiresInMinutes} minutes)`,
    templateType: EMAIL_TEMPLATE_TYPES.OTP_VERIFICATION,
    templateData: { username },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendPasswordResetEmail = async ({
  to,
  username,
  resetUrl,
  otpCode,
  otpExpiresInMinutes = 5,
  linkExpiresInDays = 4,
  requestId,
  idempotencyKey,
}) => {
  const html = buildPasswordResetEmail({ username, resetUrl, otpCode, otpExpiresInMinutes, linkExpiresInDays });

  return emailService.send({
    to,
    subject: "Reset your Battle4Arena password",
    html,
    text: `Reset your Battle4Arena password: ${resetUrl}\n\nReset code (expires in ${otpExpiresInMinutes} minutes): ${otpCode}`,
    templateType: EMAIL_TEMPLATE_TYPES.PASSWORD_RESET,
    templateData: { username, resetUrl },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendEmailVerification = async ({ to, username, verificationUrl, expiresInMinutes = 30, requestId, idempotencyKey }) => {
  const html = buildEmailVerificationEmail({ username, verificationUrl, expiresInMinutes });

  return emailService.send({
    to,
    subject: "Verify your Battle4Arena email",
    html,
    text: `Verify your Battle4Arena email: ${verificationUrl}`,
    templateType: EMAIL_TEMPLATE_TYPES.EMAIL_VERIFICATION,
    templateData: { username, verificationUrl },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendPhoneVerificationEmail = async ({ to, username, phoneNumber, verificationUrl, expiresInMinutes = 30, requestId, idempotencyKey }) => {
  const html = buildPhoneVerificationEmail({ username, phoneNumber, verificationUrl, expiresInMinutes });

  return emailService.send({
    to,
    subject: "Verify your Battle4Arena phone number",
    html,
    text: `Verify your Battle4Arena phone number (${phoneNumber}): ${verificationUrl}`,
    templateType: EMAIL_TEMPLATE_TYPES.PHONE_VERIFICATION,
    templateData: { username, verificationUrl, phoneNumber },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendWelcomeEmail = async ({ to, username, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: "Welcome to Battle4Arena",
    preview: "Your account is ready.",
    username,
    paragraphs: [
      "Welcome to Battle4Arena. Get ready to compete, climb, and win.",
      "Keep your profile updated so tournament organizers can reach you quickly.",
    ],
  });

  return emailService.send({
    to,
    subject: "Welcome to Battle4Arena",
    html,
    text: `Welcome to Battle4Arena, ${username || "player"}!`,
    templateType: EMAIL_TEMPLATE_TYPES.WELCOME,
    templateData: { username },
    requestId,
    idempotencyKey,
    priority: "normal",
  });
};

export const sendTournamentNotificationEmail = async ({ to, username, title, message, actionUrl, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: title || "Tournament Update",
    preview: "Important tournament information.",
    username,
    paragraphs: [message || "There is an update related to your tournament."],
    ctaLabel: actionUrl ? "View Details" : "",
    ctaUrl: actionUrl || "",
  });

  return emailService.send({
    to,
    subject: title || "Battle4Arena Tournament Update",
    html,
    text: `${title || "Tournament Update"}: ${message || ""}${actionUrl ? `\n${actionUrl}` : ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.TOURNAMENT_NOTIFICATION,
    templateData: { username, title, message, actionUrl },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendMatchReminderEmail = async ({ to, username, matchTitle, startTime, actionUrl, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: "Match Reminder",
    preview: "Your match is coming up.",
    username,
    paragraphs: [
      matchTitle ? `Match: ${matchTitle}` : "Your scheduled match is coming up.",
      startTime ? `Start time: ${startTime}` : "",
    ].filter(Boolean),
    ctaLabel: actionUrl ? "Open Match" : "",
    ctaUrl: actionUrl || "",
  });

  return emailService.send({
    to,
    subject: "Battle4Arena Match Reminder",
    html,
    text: `Match reminder${matchTitle ? `: ${matchTitle}` : ""}${startTime ? `\nStart time: ${startTime}` : ""}${actionUrl ? `\n${actionUrl}` : ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.MATCH_REMINDER,
    templateData: { username, matchTitle, startTime, actionUrl },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendRoomShareEmail = async ({ to, username, roomId, roomPassword, matchName, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: "Room Details",
    preview: "Room ID and password for your match.",
    username,
    paragraphs: [
      matchName ? `Match: ${matchName}` : "Use the room details below to join the match.",
    ],
    bullets: [
      roomId ? `Room ID: ${roomId}` : "",
      roomPassword ? `Password: ${roomPassword}` : "",
    ].filter(Boolean),
  });

  return emailService.send({
    to,
    subject: "Battle4Arena Room ID & Password",
    html,
    text: `Room details${matchName ? ` (${matchName})` : ""}\nRoom ID: ${roomId || ""}\nPassword: ${roomPassword || ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.ROOM_SHARE,
    templateData: { username, roomId, roomPassword, matchName },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendWalletAlertEmail = async ({ to, username, title, message, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: title || "Wallet Alert",
    preview: "Wallet activity on your account.",
    username,
    paragraphs: [message || "There is new wallet activity on your account."],
  });

  return emailService.send({
    to,
    subject: title || "Battle4Arena Wallet Alert",
    html,
    text: `${title || "Wallet Alert"}: ${message || ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.WALLET_ALERT,
    templateData: { username, title, message },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};

export const sendSupportReplyEmail = async ({ to, username, ticketId, message, actionUrl, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: "Support Reply",
    preview: "You have a new reply from support.",
    username,
    paragraphs: [message || "Support has replied to your ticket."],
    bullets: ticketId ? [`Ticket ID: ${ticketId}`] : [],
    ctaLabel: actionUrl ? "View Ticket" : "",
    ctaUrl: actionUrl || "",
  });

  return emailService.send({
    to,
    subject: "Battle4Arena Support Reply",
    html,
    text: `Support reply${ticketId ? ` (Ticket ${ticketId})` : ""}: ${message || ""}${actionUrl ? `\n${actionUrl}` : ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.SUPPORT_REPLY,
    templateData: { username, ticketId, message, actionUrl },
    requestId,
    idempotencyKey,
    priority: "normal",
  });
};

export const sendAdminAnnouncementEmail = async ({ to, username, title, message, actionUrl, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: title || "Announcement",
    preview: "A message from Battle4Arena.",
    username,
    paragraphs: [message || "There is a new announcement from Battle4Arena."],
    ctaLabel: actionUrl ? "Open" : "",
    ctaUrl: actionUrl || "",
  });

  return emailService.send({
    to,
    subject: title || "Battle4Arena Announcement",
    html,
    text: `${title || "Announcement"}: ${message || ""}${actionUrl ? `\n${actionUrl}` : ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.ADMIN_ANNOUNCEMENT,
    templateData: { username, title, message, actionUrl },
    requestId,
    idempotencyKey,
    priority: "normal",
  });
};

export const sendModerationWarningEmail = async ({ to, username, title, message, requestId, idempotencyKey }) => {
  const html = buildNotificationEmail({
    title: title || "Account Warning",
    preview: "Important account notice.",
    username,
    paragraphs: [
      message || "Your account has received a warning for violating our policies.",
      "If you believe this is a mistake, you can appeal through the app.",
    ],
  });

  return emailService.send({
    to,
    subject: title || "Battle4Arena Account Warning",
    html,
    text: `${title || "Account Warning"}: ${message || ""}`,
    templateType: EMAIL_TEMPLATE_TYPES.MODERATION_WARNING,
    templateData: { username, title, message },
    requestId,
    idempotencyKey,
    priority: "high",
  });
};
