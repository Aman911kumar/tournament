import mongoose from "mongoose";

const channelSubscriptionSchema = new mongoose.Schema(
    {
        channel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        notificationsEnabled: {
            type: Boolean,
            default: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

channelSubscriptionSchema.index({ channel: 1, user: 1 }, { unique: true });
channelSubscriptionSchema.index({ user: 1, joinedAt: -1 });

export const ChannelSubscription = mongoose.model("ChannelSubscription", channelSubscriptionSchema);
