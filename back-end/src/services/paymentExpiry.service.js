import { Payment } from "../models/payment.model.js";

const RAZORPAY_PAYMENT_TIMEOUT_MINUTES = 15;
const PAYMENT_EXPIRY_THROTTLE_MS = 30 * 1000;
let lastGlobalRunAt = 0;
const lastUserRunAt = new Map();

const cleanupUserThrottle = (now = Date.now()) => {
    for (const [key, lastRunAt] of lastUserRunAt.entries()) {
        if (now - lastRunAt > PAYMENT_EXPIRY_THROTTLE_MS * 4) {
            lastUserRunAt.delete(key);
        }
    }
};

export const getRazorpayPaymentExpiryCutoff = () => {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - RAZORPAY_PAYMENT_TIMEOUT_MINUTES);
    return cutoff;
};

export const expireStaleRazorpayPayments = async ({ user = null } = {}) => {
    const now = Date.now();
    cleanupUserThrottle(now);
    const cacheKey = user?.toString?.() || String(user || "");

    if (cacheKey) {
        const lastRunAt = lastUserRunAt.get(cacheKey) || 0;
        if (now - lastRunAt < PAYMENT_EXPIRY_THROTTLE_MS) {
            return { acknowledged: true, matchedCount: 0, modifiedCount: 0, skipped: true };
        }
        lastUserRunAt.set(cacheKey, now);
    } else if (now - lastGlobalRunAt < PAYMENT_EXPIRY_THROTTLE_MS) {
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, skipped: true };
    } else {
        lastGlobalRunAt = now;
    }

    const cutoff = getRazorpayPaymentExpiryCutoff();
    const query = {
        provider: "Razorpay",
        status: "initiated",
        createdAt: { $lte: cutoff },
        ...(user ? { user } : {}),
    };

    return Payment.updateMany(query, {
        $set: {
            status: "failed",
            "meta.autoFailedAt": new Date(),
            "meta.failureReason": "payment_timeout",
            "meta.reason": "Razorpay payment was not completed in time",
        },
    });
};

export { RAZORPAY_PAYMENT_TIMEOUT_MINUTES };
