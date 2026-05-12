import mongoose from "mongoose";

const moderationUserSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 240,
            default: "",
        },
        until: {
            type: Date,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const chatRoomStateSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            unique: true,
            index: true,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        slowModeSeconds: {
            type: Number,
            min: 0,
            max: 300,
            default: 0,
        },
        mutedUsers: {
            type: [moderationUserSchema],
            default: [],
        },
        bannedUsers: {
            type: [moderationUserSchema],
            default: [],
        },
        pinnedMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatMessage",
            default: null,
        },
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatMessage",
            default: null,
        },
        lastMessageAt: {
            type: Date,
            default: null,
            index: true,
        },
        announcement: {
            body: { type: String, trim: true, maxlength: 400, default: "" },
            by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            createdAt: { type: Date, default: null },
        },
    },
    { timestamps: true }
);

export const ChatRoomState = mongoose.model("ChatRoomState", chatRoomStateSchema);
