import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, "Amount must be greater than 0"]
  },
  source: {
    type: String,
    enum: ["added", "refund", "joined", "withdrawal", "tournament_prize", "bonus"],
    default: "added"
  },
  referenceId: {
    type: String,
    default: null,
    trim: true
  },
  status: {
    type: String,
    enum: ["pending", "successful", "failed", "rejected"],
    default: "pending",
    index: true
  },
  balanceApplied: {
    type: Boolean,
    default: false,
    index: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Add indexes for better query performance
transactionSchema.index({ user: 1, createdAt: -1 });

// Pagination plugin
transactionSchema.plugin(mongooseAggregatePaginate);

export const WalletTransaction = mongoose.model("WalletTransaction", transactionSchema);
