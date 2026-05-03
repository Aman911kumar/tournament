import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
        },

        debitAccount: String,
        creditAccount: String,

        amount: Number,
        currency: String,

        status: {
            type: String,
            enum: ["SUCCESS", "FAILED"],
        },
    },
    { timestamps: true }
);

export const Ledger = mongoose.model("Ledger", ledgerSchema);