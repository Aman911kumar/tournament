import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { sendEmailDirect } from "../services/email/email.service.js";
import { cleanEnv } from "../services/email/email.utils.js";
import { getRuntimeConfig, SERVER_ROLES } from "../utils/runtime.js";

const router = express.Router();

const internalEmailLimiter = rateLimit({
    windowMs: Number(process.env.INTERNAL_EMAIL_RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.INTERNAL_EMAIL_RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, "Too many internal email dispatch requests")),
});

const assertFastEmailRuntime = () => {
    const runtime = getRuntimeConfig();
    const enabled = cleanEnv(process.env.ENABLE_EMAIL_DISPATCH ?? "true").toLowerCase() !== "false";

    if (!enabled || (runtime.role !== SERVER_ROLES.FAST && !runtime.isVercel && !runtime.isLocal)) {
        throw new ApiError(409, "Email dispatch is not enabled on this backend runtime");
    }
};

const assertInternalSecret = (req) => {
    const expected = cleanEnv(process.env.INTERNAL_EMAIL_SECRET || process.env.EMAIL_INTERNAL_SECRET || "");
    const received = cleanEnv(req.header("x-internal-email-secret") || req.body?.secret || "");

    if (!expected) {
        throw new ApiError(503, "Internal email secret is not configured");
    }
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    const matches =
        receivedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    if (!received || !matches) {
        throw new ApiError(401, "Invalid internal email credentials");
    }
};

router.post("/internal/send", internalEmailLimiter, asyncHandler(async (req, res) => {
    assertFastEmailRuntime();
    assertInternalSecret(req);

    const payload = req.body?.email || req.body;
    const result = await sendEmailDirect({
        ...payload,
        requestId: payload?.requestId || req.requestId,
    });

    return res.status(200).json(
        new ApiResponse(200, {
            ...result,
            requestId: req.requestId,
        }, "Email dispatched successfully")
    );
}));

export default router;
