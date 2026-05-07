import { Payment } from "../models/payment.model.js";

const RAZORPAY_PAYMENT_TIMEOUT_MINUTES = 15;

export const getRazorpayPaymentExpiryCutoff = () => {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - RAZORPAY_PAYMENT_TIMEOUT_MINUTES);
    return cutoff;
};

export const expireStaleRazorpayPayments = async ({ user = null } = {}) => {
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
