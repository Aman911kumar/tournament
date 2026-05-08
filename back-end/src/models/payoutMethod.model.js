import mongoose from "mongoose";

const payoutMethodSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["upi", "bank"],
        required: true,
        index: true,
    },
    label: {
        type: String,
        trim: true,
        maxlength: 60,
        default: "",
    },
    upiId: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
    },
    accountHolderName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
    },
    accountNumber: {
        type: String,
        trim: true,
        default: "",
        select: false,
    },
    accountNumberLast4: {
        type: String,
        trim: true,
        default: "",
    },
    ifsc: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
    },
    bankName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
    },
    isDefault: {
        type: Boolean,
        default: false,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, { timestamps: true });

payoutMethodSchema.index({ user: 1, type: 1, isActive: 1 });

export const PayoutMethod = mongoose.model("PayoutMethod", payoutMethodSchema);
