import { cleanEnv } from "./email.utils.js";
import { DEFAULT_EMAIL_VERSION } from "./email.constants.js";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildEmailLayout = ({ title, preview, bodyHtml, ctaLabel, ctaUrl, footerNote }) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
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
                <p style="margin:0 0 8px 0;color:#dbeafe;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Battle4Arena</p>
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:900;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 26px;">
                ${bodyHtml}
                ${ctaLabel && ctaUrl ? `
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
                ` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;border-top:1px solid #26324f;background:#090d19;">
                <p style="margin:0;color:#64748b;font-size:11px;line-height:1.6;">${escapeHtml(footerNote || "This security email was sent for your Battle4Arena account. Ignore it if you did not request this action.")}</p>
                <p style="margin:10px 0 0 0;color:#475569;font-size:10px;line-height:1.6;">Policy version: ${escapeHtml(DEFAULT_EMAIL_VERSION)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const buildNotificationEmail = ({
  title,
  preview,
  username,
  paragraphs = [],
  bullets = [],
  ctaLabel,
  ctaUrl,
  footerNote,
}) =>
  buildEmailLayout({
    title,
    preview,
    ctaLabel,
    ctaUrl,
    footerNote,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      ${Array.isArray(paragraphs) ? paragraphs.map((p) => `<p style="margin:0 0 12px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">${escapeHtml(p)}</p>`).join("") : ""}
      ${Array.isArray(bullets) && bullets.length ? `
        <div style="margin:16px 0;padding:16px;border-radius:14px;border:1px solid #26324f;background:#0b1020;">
          <ul style="margin:0;padding-left:18px;color:#e2e8f0;font-size:13px;line-height:1.7;">
            ${bullets.map((b) => `<li style="margin:0 0 6px 0;">${escapeHtml(b)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    `,
  });

export const buildOtpVerificationEmail = ({ username, otpCode, expiresInMinutes = 5 }) =>
  buildEmailLayout({
    title: "Verify your account",
    preview: "Enter this code to finish verification.",
    ctaLabel: "",
    ctaUrl: "",
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Use this code to continue:</p>
      <div style="margin:18px 0;padding:16px;border-radius:14px;border:1px solid #0ea5e9;background:#061a2b;">
        <p style="margin:0 0 8px 0;color:#bae6fd;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;">Verification code</p>
        <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:900;letter-spacing:0.2em;">${escapeHtml(otpCode || "")}</p>
        <p style="margin:10px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">This code expires in ${Number(expiresInMinutes)} minutes.</p>
      </div>
    `,
  });

export const buildEmailVerificationEmail = ({ username, verificationUrl, expiresInMinutes = 30 }) =>
  buildEmailLayout({
    title: "Verify your email",
    preview: "Confirm your Battle4Arena email address.",
    ctaLabel: "Verify Email",
    ctaUrl: verificationUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Lock in your Battle4Arena account by verifying this email address.</p>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #1f9d55;background:#052e1a;">
        <p style="margin:0;color:#bbf7d0;font-size:13px;line-height:1.6;">This verification link expires in ${Number(expiresInMinutes)} minutes.</p>
      </div>
    `,
  });

export const buildPhoneVerificationEmail = ({ username, phoneNumber, verificationUrl, expiresInMinutes = 30 }) =>
  buildEmailLayout({
    title: "Verify your phone",
    preview: "Confirm your Battle4Arena phone number.",
    ctaLabel: "Verify Phone",
    ctaUrl: verificationUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Confirm that this phone number belongs to your Battle4Arena account:</p>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #0ea5e9;background:#061a2b;">
        <p style="margin:0;color:#bae6fd;font-size:18px;font-weight:900;letter-spacing:0.08em;">${escapeHtml(phoneNumber)}</p>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">This verification link expires in ${Number(expiresInMinutes)} minutes.</p>
    `,
  });

export const buildPasswordResetEmail = ({ username, resetUrl, otpCode, otpExpiresInMinutes = 5, linkExpiresInDays = 4 }) =>
  buildEmailLayout({
    title: "Reset your password",
    preview: "Use the reset link or enter the code to reset your password.",
    ctaLabel: "Reset Password",
    ctaUrl: resetUrl,
    bodyHtml: `
      <p style="margin:0 0 14px 0;color:#e2e8f0;font-size:16px;line-height:1.7;">Hey ${escapeHtml(username || "player")},</p>
      <p style="margin:0 0 14px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Use the code below to verify your reset request, then choose a new password.</p>
      <div style="margin:18px 0;padding:16px;border-radius:14px;border:1px solid #0ea5e9;background:#061a2b;">
        <p style="margin:0 0 8px 0;color:#bae6fd;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;">Reset code</p>
        <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:900;letter-spacing:0.2em;">${escapeHtml(otpCode || "")}</p>
        <p style="margin:10px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">This code expires in ${Number(otpExpiresInMinutes)} minutes.</p>
      </div>
      <div style="margin:20px 0;padding:16px;border-radius:14px;border:1px solid #f59e0b;background:#2b1703;">
        <p style="margin:0;color:#fde68a;font-size:13px;line-height:1.6;">This reset link expires in ${Number(linkExpiresInDays)} days and may become invalid if you request a new code.</p>
      </div>
    `,
  });

export const resolveEmailFrom = () =>
  cleanEnv(process.env.EMAIL_FROM) ||
  (process.env.HOSTINGER_SMTP_USER ? `Battle4Arena <${cleanEnv(process.env.HOSTINGER_SMTP_USER)}>` : "") ||
  (process.env.SENDPLUS_SMTP_USER ? `Battle4Arena <${cleanEnv(process.env.SENDPLUS_SMTP_USER)}>` : "") ||
  (process.env.SMTP_USER ? `Battle4Arena <${cleanEnv(process.env.SMTP_USER)}>` : "");
