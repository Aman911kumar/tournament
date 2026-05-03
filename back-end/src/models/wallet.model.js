import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        balance: {
            type: Number,
            default: 0,
        },

        lockedBalance: {
            type: Number,
            default: 0,
        },

        currency: {
            type: String,
            default: "INR",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED", "BLOCKED"],
            default: "ACTIVE",
        },

        lastTransactionAt: Date,
    },
    { timestamps: true }
);

export const Wallet = mongoose.model("Wallet", walletSchema);