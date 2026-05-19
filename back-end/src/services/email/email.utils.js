import crypto from "crypto";
import ApiError from "../../utils/ApiError.js";

export const cleanEnv = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

export const toSingleLine = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

export const parseBoolean = (value, fallback = false) => {
  const normalized = cleanEnv(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

export const positiveNumber = (value, fallback) => {
  const parsed = Number(cleanEnv(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const clampInt = (value, min, max, fallback) => {
  const parsed = Number(cleanEnv(value));
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.min(max, Math.max(min, rounded));
};

export const sha256Hex = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

export const stableIdempotencyKey = (seedParts = []) => {
  const seed = seedParts.map((p) => String(p ?? "")).join("|");
  return sha256Hex(seed);
};

export const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim().toLowerCase());

export const assertValidRecipient = (to) => {
  if (!to || !isValidEmail(to)) {
    throw new ApiError(400, "Valid recipient email is required");
  }
};

export const redactSecrets = (value = "") => {
  const raw = String(value || "");
  if (!raw) return "";
  // Basic redaction for passwords embedded in URLs etc.
  return raw.replace(/pass(word)?=([^&\s]+)/gi, "pass=[redacted]");
};

const decodeKey = (raw) => {
  const v = cleanEnv(raw);
  if (!v) return null;

  // hex (64 chars) or base64 (44 chars for 32 bytes) are common for 32-byte keys
  if (/^[0-9a-f]{64}$/i.test(v)) return Buffer.from(v, "hex");
  try {
    const b = Buffer.from(v, "base64");
    if (b.length === 32) return b;
  } catch {
    // ignore
  }

  return null;
};

export const getEmailQueueEncryptionKey = () => decodeKey(process.env.EMAIL_QUEUE_ENCRYPTION_KEY || "");

export const encryptJsonAes256Gcm = (data, keyBuffer) => {
  const key = keyBuffer || getEmailQueueEncryptionKey();
  if (!key) throw new ApiError(500, "EMAIL_QUEUE_ENCRYPTION_KEY is missing/invalid");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
};

export const decryptJsonAes256Gcm = (envelope, keyBuffer) => {
  const key = keyBuffer || getEmailQueueEncryptionKey();
  if (!key) throw new ApiError(500, "EMAIL_QUEUE_ENCRYPTION_KEY is missing/invalid");
  if (!envelope || envelope.alg !== "A256GCM") throw new ApiError(400, "Invalid encrypted payload");

  const iv = Buffer.from(String(envelope.iv || ""), "base64");
  const tag = Buffer.from(String(envelope.tag || ""), "base64");
  const data = Buffer.from(String(envelope.data || ""), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
};
