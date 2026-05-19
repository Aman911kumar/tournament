import { createSmtpProvider } from "./smtp.provider.js";
import { cleanEnv } from "../email.utils.js";
import { EMAIL_PROVIDERS } from "../email.constants.js";

export const createHostingerProvider = (overrides = {}) =>
  createSmtpProvider({
    name: EMAIL_PROVIDERS.hostinger,
    priority: Number(overrides.priority ?? 10),
    config: {
      host: cleanEnv(process.env.HOSTINGER_SMTP_HOST || process.env.SMTP_HOST),
      port: cleanEnv(process.env.HOSTINGER_SMTP_PORT || process.env.SMTP_PORT),
      secure: cleanEnv(process.env.HOSTINGER_SMTP_SECURE || process.env.SMTP_SECURE),
      user: cleanEnv(process.env.HOSTINGER_SMTP_USER || process.env.SMTP_USER),
      pass: cleanEnv(process.env.HOSTINGER_SMTP_PASS || process.env.SMTP_PASS),
      pool: cleanEnv(process.env.HOSTINGER_SMTP_POOL || process.env.SMTP_POOL || "true"),
      maxConnections: cleanEnv(process.env.HOSTINGER_SMTP_MAX_CONNECTIONS || process.env.SMTP_MAX_CONNECTIONS),
      maxMessages: cleanEnv(process.env.HOSTINGER_SMTP_MAX_MESSAGES || process.env.SMTP_MAX_MESSAGES),
      requireTLS: cleanEnv(process.env.HOSTINGER_SMTP_REQUIRE_TLS || process.env.SMTP_REQUIRE_TLS),
      rejectUnauthorized: cleanEnv(process.env.HOSTINGER_SMTP_REJECT_UNAUTHORIZED || process.env.SMTP_REJECT_UNAUTHORIZED),
      connectionTimeout: cleanEnv(process.env.HOSTINGER_SMTP_CONNECTION_TIMEOUT_MS || process.env.SMTP_CONNECTION_TIMEOUT_MS),
      greetingTimeout: cleanEnv(process.env.HOSTINGER_SMTP_GREETING_TIMEOUT_MS || process.env.SMTP_GREETING_TIMEOUT_MS),
      socketTimeout: cleanEnv(process.env.HOSTINGER_SMTP_SOCKET_TIMEOUT_MS || process.env.SMTP_SOCKET_TIMEOUT_MS),
      ...(overrides.config || {}),
    },
  });

