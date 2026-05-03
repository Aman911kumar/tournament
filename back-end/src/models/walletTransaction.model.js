import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    category: {
      type: String,
      enum: [
        "DEPOSIT",
        "WITHDRAW",
        "TRANSFER",
        "REFUND",
        "TOURNAMENT_ENTRY",
        "WINNING",
        "BONUS",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    balanceBefore: Number,
    balanceAfter: Number,

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REVERSED"],
      default: "PENDING",
    },

    paymentMethod: String,
    referenceId: String,

    description: String,

    metadata: mongoose.Schema.Types.Mixed,

    idempotencyKey: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
walletTransactionSchema.index({ user: 1, createdAt: -1 });

// Pagination plugin
walletTransactionSchema.plugin(mongooseAggregatePaginate);

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
