import mongoose from "mongoose";

const chatModerationLogSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            index: true,
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        message: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatMessage",
            default: null,
        },
        action: {
            type: String,
            enum: [
                "mute",
                "unmute",
                "ban",
                "unban",
                "delete_message",
                "pin_message",
                "unpin_message",
                "announcement",
                "slow_mode",
                "report_message",
            ],
            required: true,
            index: true,
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 300,
            default: "",
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

chatModerationLogSchema.index({ tournament: 1, createdAt: -1 });
chatModerationLogSchema.index({ targetUser: 1, createdAt: -1 });

export const ChatModerationLog = mongoose.model("ChatModerationLog", chatModerationLogSchema);
