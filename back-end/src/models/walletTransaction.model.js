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
        "WALLET_TRANSFER",
        "ORGANIZER_EARNING",
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

    grossAmount: {
      type: Number,
      default: 0,
    },

    platformFee: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
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
walletTransactionSchema.index({ user: 1, status: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });
walletTransactionSchema.index({ category: 1, status: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1, category: 1 });
walletTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

// Pagination plugin
walletTransactionSchema.plugin(mongooseAggregatePaginate);

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
