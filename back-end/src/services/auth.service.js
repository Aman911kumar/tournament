import nodemailer from "nodemailer";
import { Resend } from "resend";
import ApiError from "../utils/ApiError.js";
import {
    APP_PUBLIC_URL,
    EMAIL_PROVIDER,
    EMAIL_FROM,
    RESEND_API_KEY,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
} from "../../env.js";

const cleanEnv = (value = "") =>
    String(value || "")
        .trim()
        .replace(/^['"]|['"]$/g, "");

const parseBoolean = (value, fallback = false) => {
    const normalized = cleanEnv(value).toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return fallback;
};

const positiveNumber = (value, fallback) => {
    const parsed = Number(cleanEnv(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const smtpService = cleanEnv(process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE);
const smtpHost = cleanEnv(SMTP_HOST);
const smtpPort = positiveNumber(SMTP_PORT, 587);
const smtpUser = cleanEnv(SMTP_USER);
const rawSmtpPass = cleanEnv(SMTP_PASS);
const isGmailSmtp = /gmail/i.test(`${smtpService} ${smtpHost}`);
const smtpPass = isGmailSmtp ? rawSmtpPass.replace(/\s+/g, "") : rawSmtpPass;
const hasPartialAuth = Boolean((smtpUser && !smtpPass) || (!smtpUser && smtpPass));
const smtpSecure = smtpPort === 465 || (smtpPort !== 587 && parseBoolean(SMTP_SECURE, false));
const smtpRequireTls = parseBoolean(process.env.SMTP_REQUIRE_TLS, smtpPort === 587);
const smtpRejectUnauthorized = parseBoolean(process.env.SMTP_REJECT_UNAUTHORIZED, true);
const smtpVerifyOnSend = parseBoolean(process.env.SMTP_VERIFY_ON_SEND, false);
const smtpConnectionTimeout = positiveNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 8000);
const smtpGreetingTimeout = positiveNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 8000);
const smtpSocketTimeout = positiveNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 12000);
const defaultFrom = cleanEnv(EMAIL_FROM) || (smtpUser ? `Battle4Arena <${smtpUser}>` : "");
const resendApiKey = cleanEnv(RESEND_API_KEY);
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const requestedEmailProvider = cleanEnv(EMAIL_PROVIDER).toLowerCase();
const emailProvider = requestedEmailProvider || (resend ? "resend" : "smtp");

const getEmailConfigError = () => {
    if (!smtpService && !smtpHost) return "SMTP_HOST is missing";
    if (hasPartialAuth) return "SMTP_USER and SMTP_PASS must both be set";
    return "";
};

const buildTransportOptions = () => ({
    ...(smtpService ? { service: smtpService } : { host: smtpHost }),
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: !smtpSecure && smtpRequireTls,
    pool: true,
    maxConnections: positiveNumber(process.env.SMTP_MAX_CONNECTIONS, 2),
    maxMessages: positiveNumber(process.env.SMTP_MAX_MESSAGES, 50),
    connectionTimeout: smtpConnectionTimeout,
    greetingTimeout: smtpGreetingTimeout,
    socketTimeout: smtpSocketTimeout,
    ...(smtpUser && smtpPass
        ? {
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        }
        : {}),
    tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: smtpRejectUnauthorized,
        ...(smtpHost ? { servername: smtpHost } : {}),
    },
});

const mailTransporter = getEmailConfigError()
    ? null
    : nodemailer.createTransport(buildTransportOptions());

let transporterVerified = false;
let transporterVerifyPromise = null;

const getEmailFailureMessage = (error) => {
    const code = error?.code || error?.command || "";
    const response = error?.response || error?.message || "";

    if (code === "EAUTH" || /auth|credential|username|password|login/i.test(response)) {
        return "SMTP authentication failed. Check SMTP_USER, SMTP_PASS, and use an app password for Gmail in production.";
    }
    if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND"].includes(code)) {
        return "SMTP connection failed. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and production firewall/network settings.";
    }
    if (/self signed|certificate|tls/i.test(response)) {
        return "SMTP TLS verification failed. Check SMTP host/port or set SMTP_REJECT_UNAUTHORIZED=false only for a trusted private SMTP server.";
    }
    if (code === "EENVELOPE") {
        return "SMTP rejected the sender or recipient address. Check EMAIL_FROM and recipient email.";
    }

    return response || "Failed to send email";
};

const ensureEmailTransportReady = async () => {
    const configError = getEmailConfigError();
    if (configError) {
        throw new ApiError(500, `Email service is not configured: ${configError}`);
    }
    if (!mailTransporter) {
        throw new ApiError(500, "Email service is not configured");
    }
    if (!smtpVerifyOnSend || transporterVerified) return;

    if (!transporterVerifyPromise) {
        transporterVerifyPromise = mailTransporter.verify()
            .then(() => {
                transporterVerified = true;
            })
            .catch((error) => {
                transporterVerified = false;
                throw new ApiError(502, getEmailFailureMessage(error));
            })
            .finally(() => {
                transporterVerifyPromise = null;
            });
    }

    await transporterVerifyPromise;
};

export const isEmailServiceConfigured = () => Boolean(mailTransporter);
export const verifyEmailTransport = ensureEmailTransportReady;

const getResendFailureMessage = (error) => {
    const message = error?.message || error?.error?.message || error?.response?.message || "";
    if (/domain|verify|from/i.test(message)) {
        return "Resend rejected the sender. Verify your domain in Resend and set EMAIL_FROM to an address on that domain.";
    }
    if (/api key|unauthorized|forbidden|permission/i.test(message)) {
        return "Resend authentication failed. Check RESEND_API_KEY in production.";
    }
    return message || "Failed to send email with Resend";
};

const sendEmailWithResend = async ({ to, subject, html, text, from = EMAIL_FROM, replyTo }) => {
    if (!resend) {
        throw new ApiError(500, "Resend email service is not configured");
    }

    try {
        const result = await resend.emails.send({
            from: cleanEnv(from) || defaultFrom,
            to: cleanEnv(to),
            subject,
            html,
            ...(text ? { text } : {}),
            ...(replyTo ? { reply_to: cleanEnv(replyTo) } : {}),
        });

        if (result?.error) throw result.error;
        return result?.data || result;
    } catch (error) {
        throw new ApiError(502, getResendFailureMessage(error));
    }
};

const sendEmailWithSmtp = async ({ to, subject, html, text, from = EMAIL_FROM, replyTo }) => {
    await ensureEmailTransportReady();

    return mailTransporter.sendMail({
        from: cleanEnv(from) || defaultFrom,
        to: cleanEnv(to),
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo: cleanEnv(replyTo) } : {}),
    });
};

const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const appUrl = cleanEnv(APP_PUBLIC_URL || "http://localhost:8080").split(",")[0].replace(/\/$/, "");

const buildEmailLayout = ({ title, preview, bodyHtml, ctaLabel, ctaUrl }) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#070913;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070913;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border-radius:20px;border:1px solid #26324f;background:#0d1222;">
            <tr>
              <td style="padding:28px 26px;background:linear-gradient(135deg,#6d28d9 0%,#0ea5e9 48%,#22c55e 100%);">
                <p style="margin:0 0 8px 0;color:#dbeafe;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">BattleArena</p>
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:900;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 26px;">
                ${bodyHtml}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 18px 0;">
                  <tr>
                    <td style="border-radius:12px;background:#22c55e;">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 20px;color:#04110a;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">
                        ${escapeHtml(ctaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px 0;color:#94a3b8;font-size:12px;line-height:1.6;">If the button does not work, paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;color:#38bdf8;font-size:12px;line-height:1.6;">${escapeHtml(ctaUrl)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;border-top:1px solid #26324f;background:#090d19;">
                <p style="margin:0;color:#64748b;font-size:11px;line-height:1.6;">This security email was sent for your BattleArena account. Ignore it if you did not request this action.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const buildEmailVerificationHtml = ({ username, verificationUrl, expiresInMinutes = 30 }) => buildEmailLayout({
    title: "Verify your email",
    preview: "Confirm your BattleArena email address.",
    ctaLabel: "Verify Email",
    ctaUrl: verificationUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Lock in your BattleArena account by verifying this email address. Verified accounts are easier to recover and safer for tournament payouts, creator access, and wallet activity.</p>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #1f9d55;background:#052e1a;">
        <p style="margin:0;color:#bbf7d0;font-size:13px;line-height:1.6;">This verification link expires in ${Number(expiresInMinutes)} minutes.</p>
      </div>
    `,
});

export const buildPhoneVerificationHtml = ({ username, phoneNumber, verificationUrl, expiresInMinutes = 30 }) => buildEmailLayout({
    title: "Verify your phone",
    preview: "Confirm your BattleArena phone number.",
    ctaLabel: "Verify Phone",
    ctaUrl: verificationUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Confirm that this phone number belongs to your BattleArena account:</p>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #0ea5e9;background:#061a2b;">
        <p style="margin:0;color:#bae6fd;font-size:18px;font-weight:900;letter-spacing:0.08em;">${escapeHtml(phoneNumber)}</p>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">This verification link expires in ${Number(expiresInMinutes)} minutes.</p>
    `,
});

export const buildPasswordResetHtml = ({ username, resetUrl, resetToken, expiresInMinutes = 10 }) => buildEmailLayout({
    title: "Reset your password",
    preview: "Use this BattleArena reset link to create a new password.",
    ctaLabel: "Reset Password",
    ctaUrl: resetUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">We received a request to reset your BattleArena password. Use the button below to open the reset page and set a new password.</p>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #6d28d9;background:#171033;">
        <p style="margin:0 0 8px 0;color:#c4b5fd;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Reset token</p>
        <p style="margin:0;word-break:break-all;color:#f8fafc;font-size:16px;font-weight:800;letter-spacing:0.04em;">${escapeHtml(resetToken)}</p>
      </div>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #f59e0b;background:#2b1703;">
        <p style="margin:0;color:#fde68a;font-size:13px;line-height:1.6;">This reset link expires in ${Number(expiresInMinutes)} minutes. If you did not request this, keep your current password and ignore this email.</p>
      </div>
    `,
});

export const sendEmail = async ({ to, subject, html, text, from = EMAIL_FROM, replyTo }) => {
    if (!to || !subject || !html) {
        throw new ApiError(400, "Email recipient, subject, and html are required");
    }

    try {
        if (emailProvider === "resend") {
            return await sendEmailWithResend({ to, subject, html, text, from, replyTo });
        }

        if (emailProvider === "smtp") {
            return await sendEmailWithSmtp({ to, subject, html, text, from, replyTo });
        }

        throw new ApiError(500, `Unsupported EMAIL_PROVIDER "${emailProvider}". Use "resend" or "smtp".`);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, getEmailFailureMessage(error));
    }
};

export const sendEmailVerification = async ({ to, username, token, expiresInMinutes = 30 }) => {
    const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const html = buildEmailVerificationHtml({ username, verificationUrl, expiresInMinutes });

    return sendEmail({
        to,
        subject: "Verify your BattleArena email",
        html,
        text: `Verify your BattleArena email: ${verificationUrl}`,
    });
};

export const sendPhoneVerificationEmail = async ({ to, username, phoneNumber, token, expiresInMinutes = 30 }) => {
    const verificationUrl = `${appUrl}/verify-phone?token=${encodeURIComponent(token)}`;
    const html = buildPhoneVerificationHtml({ username, phoneNumber, verificationUrl, expiresInMinutes });

    return sendEmail({
        to,
        subject: "Verify your BattleArena phone number",
        html,
        text: `Verify your BattleArena phone number (${phoneNumber}): ${verificationUrl}`,
    });
};

export const sendPasswordResetEmail = async ({ to, username, token, expiresInMinutes = 10 }) => {
    const resetUrl = `${appUrl}/forgot-password?token=${encodeURIComponent(token)}`;
    const html = buildPasswordResetHtml({ username, resetUrl, resetToken: token, expiresInMinutes });

    return sendEmail({
        to,
        subject: "Reset your BattleArena password",
        html,
        text: `Reset your BattleArena password: ${resetUrl}\n\nReset token: ${token}`,
    });
};
