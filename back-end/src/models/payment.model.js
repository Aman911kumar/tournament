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
        required: true,
        unique: true,
        index:true,
        trim: true
    },
    status: {
        type: String,
        enum: ['initiated', 'success', 'failed', 'refunded'],
        default: 'initiated',
        index: true
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// Optional validation: prevent editing after success/failure
paymentSchema.pre('save', function (next) {
    if (!this.isNew && ['success', 'failed'].includes(this.status)) {
        return next(new Error('Cannot modify a completed payment record.'));
    }
    next();
});

export const Payment = mongoose.model("Payment", paymentSchema);
