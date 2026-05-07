import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        default: null
    },
    amount: {
        type: Number,
        required: true,
        min: [1, "Amount must be greater than 0"]
    },
    currency: {
        type: String,
        default: 'INR'
    },
    provider: {
        type: String,
        trim: true,
        required: true,
        enum: ['Razorpay', 'Stripe', 'Paytm', 'Other']
    },
    providerPaymentId: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index:true,
        trim: true
    },
    providerOrderId: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['initiated', 'pending', 'success', 'failed', 'cancelled', 'refunded'],
        default: 'initiated',
        index: true
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ provider: 1, status: 1, createdAt: -1 });
paymentSchema.index({ "meta.purpose": 1, status: 1, createdAt: -1 });

// Optional validation: prevent editing after success/failure
paymentSchema.pre('save', async function (next) {
    const existing = this.isNew ? null : await this.constructor.findById(this._id).select("status").lean();
    if (['success', 'failed', 'cancelled', 'refunded'].includes(existing?.status)) {
        return next(new Error('Cannot modify a completed payment record.'));
    }
    next();
});

export const Payment = mongoose.model("Payment", paymentSchema);
