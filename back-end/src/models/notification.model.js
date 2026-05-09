import mongoose, { Schema, model } from "mongoose";

const NotificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ["system", "wallet", "tournament", "tournament_update", "reward", "security", "creator", "room", "payment", "report", "moderation"],
        default: "system",
    },
    priority: {
        type: String,
        enum: ["low", "normal", "high"],
        default: "normal",
    },
    channels: {
        inApp: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
    },
    actionUrl: {
        type: String,
        default: "",
    },
    data: {
        type: Schema.Types.Mixed,
        default: {},
    },
    read: {
        type: Boolean,
        default: false,
    },
    readAt: {
        type: Date,
        default: null,
    },
    deliveredAt: {
        type: Date,
        default: null,
    },
    emailSentAt: {
        type: Date,
        default: null,
    },
    emailError: {
        type: String,
        default: "",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

export const Notification = model("Notification", NotificationSchema);
