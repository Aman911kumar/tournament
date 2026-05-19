import { createSmtpProvider } from "./smtp.provider.js";
import { cleanEnv } from "../email.utils.js";
import { EMAIL_PROVIDERS } from "../email.constants.js";

export const createSendPlusProvider = (overrides = {}) =>
  createSmtpProvider({
    name: EMAIL_PROVIDERS.sendplus,
    priority: Number(overrides.priority ?? 20),
    config: {
      host: cleanEnv(process.env.SENDPLUS_SMTP_HOST),
      port: cleanEnv(process.env.SENDPLUS_SMTP_PORT),
      secure: cleanEnv(process.env.SENDPLUS_SMTP_SECURE),
      user: cleanEnv(process.env.SENDPLUS_SMTP_USER),
      pass: cleanEnv(process.env.SENDPLUS_SMTP_PASS),
      pool: cleanEnv(process.env.SENDPLUS_SMTP_POOL || "true"),
      maxConnections: cleanEnv(process.env.SENDPLUS_SMTP_MAX_CONNECTIONS),
      maxMessages: cleanEnv(process.env.SENDPLUS_SMTP_MAX_MESSAGES),
      requireTLS: cleanEnv(process.env.SENDPLUS_SMTP_REQUIRE_TLS),
      rejectUnauthorized: cleanEnv(process.env.SENDPLUS_SMTP_REJECT_UNAUTHORIZED),
      connectionTimeout: cleanEnv(process.env.SENDPLUS_SMTP_CONNECTION_TIMEOUT_MS),
      greetingTimeout: cleanEnv(process.env.SENDPLUS_SMTP_GREETING_TIMEOUT_MS),
      socketTimeout: cleanEnv(process.env.SENDPLUS_SMTP_SOCKET_TIMEOUT_MS),
      ...(overrides.config || {}),
    },
  });

