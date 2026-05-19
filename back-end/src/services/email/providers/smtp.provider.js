import nodemailer from "nodemailer";
import ApiError from "../../../utils/ApiError.js";
import { cleanEnv, parseBoolean, positiveNumber, toSingleLine } from "../email.utils.js";

const getEmailFailureMeta = (error, meta = {}) => ({
  code: error?.code || error?.command || "",
  responseCode: error?.responseCode,
  address: error?.address,
  port: error?.port,
  host: meta.host || undefined,
  secure: Boolean(meta.secure),
  stage: error?.command || undefined,
  response: toSingleLine(error?.response || ""),
  message: toSingleLine(error?.message || ""),
});

const buildEmailFailureMessage = (error, meta = {}) => {
  const info = getEmailFailureMeta(error, meta);
  const raw = info.response || info.message || "Failed to send email";
  const prefix = info.code ? `SMTP error (${info.code})` : "SMTP error";
  const endpoint = info.host ? `${info.host}:${info.port || meta.port}` : undefined;
  return `${prefix}${endpoint ? ` at ${endpoint}` : ""}: ${raw}`;
};

const buildEmailFailureDetails = (error, meta = {}) => {
  const info = getEmailFailureMeta(error, meta);
  const details = [];

  if (info.code) details.push({ field: "smtp.code", message: info.code });
  if (info.responseCode) details.push({ field: "smtp.responseCode", message: String(info.responseCode) });
  if (info.stage) details.push({ field: "smtp.stage", message: String(info.stage) });
  if (info.host) details.push({ field: "smtp.host", message: String(info.host) });
  if (info.port) details.push({ field: "smtp.port", message: String(info.port) });
  details.push({ field: "smtp.secure", message: String(Boolean(info.secure)) });
  if (info.address) details.push({ field: "smtp.address", message: String(info.address) });
  if (info.response) details.push({ field: "smtp.response", message: info.response });
  if (info.message) details.push({ field: "smtp.message", message: info.message });

  return details;
};

const makeTransport = (config) => nodemailer.createTransport(config);

export const createSmtpProvider = ({ name, priority, config }) => {
  const cfg = config || {};

  const host = cleanEnv(cfg.host);
  const port = positiveNumber(cfg.port, 587);
  const user = cleanEnv(cfg.user);
  const pass = cleanEnv(cfg.pass);
  const service = cleanEnv(cfg.service);

  const secure = port === 465 || (port !== 587 && parseBoolean(cfg.secure, false));
  const requireTLS = parseBoolean(cfg.requireTLS, port === 587);
  const rejectUnauthorized = parseBoolean(cfg.rejectUnauthorized, true);
  const pool = parseBoolean(cfg.pool, true);

  const maxConnections = positiveNumber(cfg.maxConnections, 2);
  const maxMessages = positiveNumber(cfg.maxMessages, 50);

  const connectionTimeout = positiveNumber(cfg.connectionTimeout, 8000);
  const greetingTimeout = positiveNumber(cfg.greetingTimeout, 8000);
  const socketTimeout = positiveNumber(cfg.socketTimeout, 12000);

  const isConfigured = () => Boolean((service || host) && (!user || pass) && (!pass || user));

  const buildTransportOptions = () => ({
    ...(service ? { service } : { host }),
    port,
    secure,
    requireTLS: !secure && requireTLS,
    pool,
    ...(pool ? { maxConnections, maxMessages } : {}),
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    ...(user && pass ? { auth: { user, pass } } : {}),
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized,
      ...(host ? { servername: host } : {}),
    },
  });

  // Keep a pooled transporter in memory for reuse.
  let transporter = null;
  const getTransporter = () => {
    if (!isConfigured()) {
      throw new ApiError(500, `Email provider ${name} is not configured`);
    }
    if (transporter) return transporter;
    transporter = makeTransport(buildTransportOptions());
    return transporter;
  };

  const healthCheck = async () => {
    if (!isConfigured()) return { ok: false, reason: "not_configured", checkedAt: new Date() };
    try {
      const t = getTransporter();
      await t.verify();
      return { ok: true, checkedAt: new Date() };
    } catch (error) {
      return { ok: false, reason: buildEmailFailureMessage(error, { host, port, secure }), checkedAt: new Date() };
    }
  };

  const send = async (request) => {
    const t = getTransporter();
    const message = {
      from: request.from,
      to: request.to,
      subject: request.subject,
      html: request.html,
      ...(request.text ? { text: request.text } : {}),
      ...(request.replyTo ? { replyTo: request.replyTo } : {}),
      // Useful for troubleshooting in email headers
      ...(request.idempotencyKey ? { headers: { "x-b4a-idempotency-key": request.idempotencyKey } } : {}),
      ...(request.requestId ? { headers: { ...(request.idempotencyKey ? { "x-b4a-idempotency-key": request.idempotencyKey } : {}), "x-b4a-request-id": request.requestId } } : {}),
    };

    try {
      const info = await t.sendMail(message);
      return { messageId: info?.messageId, raw: info };
    } catch (error) {
      throw new ApiError(502, buildEmailFailureMessage(error, { host, port, secure }), buildEmailFailureDetails(error, { host, port, secure }));
    }
  };

  return {
    name,
    priority: Number.isFinite(priority) ? priority : 100,
    isConfigured,
    healthCheck,
    send,
  };
};

