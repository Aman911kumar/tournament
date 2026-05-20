import mongoose, { Schema, model } from "mongoose";

const OAuthLoginCodeSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["google", "facebook"],
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdIp: {
      type: String,
      default: "",
    },
    createdUserAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// TTL cleanup for expired codes
OAuthLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthLoginCode = model("OAuthLoginCode", OAuthLoginCodeSchema);
