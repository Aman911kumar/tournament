import mongoose, { Schema, model } from "mongoose";

const EmailDeliveryLogSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: "",
      index: true,
    },
    to: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      default: "",
    },
    templateType: {
      type: String,
      default: "generic",
      index: true,
    },
    requestId: {
      type: String,
      default: "",
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: "",
      index: true,
    },
    messageId: {
      type: String,
      default: "",
    },
    providerMessageId: {
      type: String,
      default: "",
    },
    error: {
      type: String,
      default: "",
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

EmailDeliveryLogSchema.index({ to: 1, attemptedAt: -1 });
EmailDeliveryLogSchema.index({ status: 1, attemptedAt: -1 });
EmailDeliveryLogSchema.index({ provider: 1, attemptedAt: -1 });
EmailDeliveryLogSchema.index({ templateType: 1, attemptedAt: -1 });

export const EmailDeliveryLog = model("EmailDeliveryLog", EmailDeliveryLogSchema);

