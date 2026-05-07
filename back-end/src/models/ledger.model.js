import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
        },

        debitAccount: String,
        creditAccount: String,

        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        toUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        category: String,
        referenceId: String,
        amount: Number,
        currency: String,
        platformFee: {
            type: Number,
            default: 0,
        },
        netAmount: {
            type: Number,
            default: 0,
        },

        status: {
            type: String,
            enum: ["SUCCESS", "FAILED"],
        },

        metadata: mongoose.Schema.Types.Mixed,
    },
    { timestamps: true }
);

ledgerSchema.index({ transactionId: 1 });
ledgerSchema.index({ referenceId: 1, category: 1 });
ledgerSchema.index({ status: 1, creditAccount: 1, category: 1 });
ledgerSchema.index({ createdAt: -1 });

export const Ledger = mongoose.model("Ledger", ledgerSchema);
