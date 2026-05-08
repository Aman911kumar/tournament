import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        endpoint: {
            type: String,
            required: true,
            unique: true,
        },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
        userAgent: {
            type: String,
            default: "",
        },
        platform: {
            type: String,
            enum: ["web", "android", "ios", "unknown"],
            default: "web",
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1, enabled: 1, updatedAt: -1 });

export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
