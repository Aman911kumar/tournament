import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["image", "file"],
            required: true,
        },
        url: {
            type: String,
            required: true,
            trim: true,
        },
        name: {
            type: String,
            trim: true,
            default: "",
        },
        mimeType: {
            type: String,
            trim: true,
            default: "",
        },
        size: {
            type: Number,
            min: 0,
            default: 0,
        },
        storageProvider: {
            type: String,
            trim: true,
            default: "",
        },
        mediaId: {
            type: String,
            trim: true,
            default: "",
        },
        apiUrl: {
            type: String,
            trim: true,
            default: "",
        },
        downloadUrl: {
            type: String,
            trim: true,
            default: "",
        },
        thumbUrl: {
            type: String,
            trim: true,
            default: "",
        },
        folderId: {
            type: String,
            trim: true,
            default: "",
        },
        folderName: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { _id: false }
);

const reactionSchema = new mongoose.Schema(
    {
        emoji: {
            type: String,
            required: true,
            trim: true,
            maxlength: 16,
        },
        users: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    { _id: false }
);

const seenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        seenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        type: {
            type: String,
            enum: ["text", "image", "file", "system", "announcement", "room_card"],
            default: "text",
            index: true,
        },
        body: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },
        attachments: {
            type: [attachmentSchema],
            default: [],
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChatMessage",
            default: null,
        },
        mentions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        reactions: {
            type: [reactionSchema],
            default: [],
        },
        seenBy: {
            type: [seenSchema],
            default: [],
        },
        status: {
            type: String,
            enum: ["active", "deleted"],
            default: "active",
            index: true,
        },
        editedAt: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        pinnedAt: {
            type: Date,
            default: null,
        },
        pinnedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

chatMessageSchema.index({ tournament: 1, createdAt: -1, _id: -1 });
chatMessageSchema.index({ tournament: 1, status: 1, createdAt: -1 });
chatMessageSchema.index({ tournament: 1, sender: 1, type: 1, createdAt: -1 });
chatMessageSchema.index({ tournament: 1, sender: 1, "metadata.clientRequestId": 1 }, { sparse: true });
chatMessageSchema.index({ tournament: 1, pinnedAt: -1 });
chatMessageSchema.index({ mentions: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
