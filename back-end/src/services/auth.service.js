// Auth-facing wrappers around the centralized email system.
// Controllers should import from here (or directly from services/email) instead of touching SMTP transport code.

import { APP_PUBLIC_URL } from "../../env.js";
import { cleanEnv } from "./email/email.utils.js";
import {
  sendEmailVerification as sendEmailVerificationViaEmailService,
  sendOtpVerificationEmail as sendOtpVerificationEmailViaEmailService,
  sendPhoneVerificationEmail as sendPhoneVerificationEmailViaEmailService,
  sendPasswordResetEmail as sendPasswordResetEmailViaEmailService,
  emailService,
} from "./email/email.service.js";

const appUrl = cleanEnv(APP_PUBLIC_URL || "http://localhost:8080").split(",")[0].replace(/\/$/, "");

export const sendEmailVerification = async ({ to, username, token, expiresInMinutes = 30, requestId }) => {
  const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmailVerificationViaEmailService({ to, username, verificationUrl, expiresInMinutes, requestId });
};

export const sendPhoneVerificationEmail = async ({ to, username, phoneNumber, token, expiresInMinutes = 30, requestId }) => {
  const verificationUrl = `${appUrl}/verify-phone?token=${encodeURIComponent(token)}`;
  return sendPhoneVerificationEmailViaEmailService({ to, username, phoneNumber, verificationUrl, expiresInMinutes, requestId });
};

export const sendPasswordResetEmail = async ({
  to,
  username,
  token,
  otpCode,
  otpExpiresInMinutes = 5,
  linkExpiresInDays = 4,
  requestId,
}) => {
  const resetUrl = `${appUrl}/forgot-password/reset?token=${encodeURIComponent(token)}`;
  return sendPasswordResetEmailViaEmailService({
    to,
    username,
    resetUrl,
    otpCode,
    otpExpiresInMinutes,
    linkExpiresInDays,
    requestId,
  });
};

export const sendOtpVerificationEmail = async ({ to, username, otpCode, expiresInMinutes = 5, requestId }) =>
  sendOtpVerificationEmailViaEmailService({ to, username, otpCode, expiresInMinutes, requestId });

export const sendEmail = async ({ to, subject, html, text, from, replyTo, requestId, idempotencyKey }) =>
  emailService.send({ to, subject, html, text, from, replyTo, requestId, idempotencyKey });
