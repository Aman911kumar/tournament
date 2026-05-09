import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const makeRateLimit = ({
    windowMs,
    max,
    message,
    skipSuccessfulRequests = false,
}) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        handler: (req, res, next) => {
            next(new ApiError(429, message));
        },
    });

export const globalApiLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 15 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_GLOBAL_MAX, 600),
    message: "Too many requests. Please slow down and try again shortly.",
});

export const authLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_AUTH_MAX, 25),
    message: "Too many login attempts. Please wait a few minutes and try again.",
    skipSuccessfulRequests: true,
});

export const passwordResetLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS, 15 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_PASSWORD_RESET_MAX, 5),
    message: "Too many password reset requests. Please wait before trying again.",
});

export const walletLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_WALLET_WINDOW_MS, 10 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_WALLET_MAX, 30),
    message: "Too many wallet requests. Please wait a moment before trying again.",
});

export const reportLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_REPORT_WINDOW_MS, 10 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_REPORT_MAX, 8),
    message: "Too many reports submitted. Please wait before reporting again.",
});

export const moderationLimiter = makeRateLimit({
    windowMs: toNumber(process.env.RATE_LIMIT_MODERATION_WINDOW_MS, 10 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_MODERATION_MAX, 60),
    message: "Too many moderation actions. Please slow down and try again shortly.",
});
