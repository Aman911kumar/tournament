import mongoose from "mongoose";

const chatReadStateSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        lastReadMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatMessage",
            default: null,
        },
        lastReadAt: {
            type: Date,
            default: null,
        },
        unreadCount: {
            type: Number,
            min: 0,
            default: 0,
        },
    },
    { timestamps: true }
);

chatReadStateSchema.index({ tournament: 1, user: 1 }, { unique: true });
chatReadStateSchema.index({ user: 1, unreadCount: -1, updatedAt: -1 });

export const ChatReadState = mongoose.model("ChatReadState", chatReadStateSchema);
