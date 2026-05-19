import { parseBoolean, toSingleLine } from "./email.utils.js";

const enabled = () => parseBoolean(process.env.EMAIL_LOG_TO_DB, false);

/**
 * Best-effort MongoDB logging for delivery attempts.
 * Do not store html/text bodies here (PII risk) and do not throw if logging fails.
 */
export const logEmailDeliveryAttempt = async (entry = {}) => {
  if (!enabled()) return null;

  try {
    const { EmailDeliveryLog } = await import("../../models/emailDeliveryLog.model.js");
    const payload = {
      status: entry.status,
      provider: entry.provider || "",
      to: entry.to || "",
      subject: entry.subject || "",
      templateType: entry.templateType || "generic",
      requestId: entry.requestId || "",
      idempotencyKey: entry.idempotencyKey || "",
      messageId: entry.messageId || "",
      providerMessageId: entry.providerMessageId || "",
      error: toSingleLine(entry.error || ""),
      meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
      attemptedAt: new Date(),
    };

    await EmailDeliveryLog.create(payload);
    return payload;
  } catch {
    return null;
  }
};

