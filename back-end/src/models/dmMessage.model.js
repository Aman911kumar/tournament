import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["image", "file", "voice", "video"],
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

const readReceiptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        at: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const dmMessageSchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DmConversation",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["text", "emoji", "image", "file", "voice_note", "system", "tournament_card", "creator_card"],
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
            ref: "DmMessage",
            default: null,
        },
        status: {
            type: String,
            enum: ["active", "deleted"],
            default: "active",
            index: true,
        },
        deliveryStatus: {
            type: String,
            enum: ["sent", "delivered", "read", "failed"],
            default: "sent",
            index: true,
        },
        deliveredTo: {
            type: [readReceiptSchema],
            default: [],
        },
        readBy: {
            type: [readReceiptSchema],
            default: [],
        },
        clientRequestId: {
            type: String,
            trim: true,
            default: "",
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
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

dmMessageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
dmMessageSchema.index({ conversation: 1, status: 1, createdAt: -1 });
dmMessageSchema.index({ conversation: 1, sender: 1, createdAt: -1 });
dmMessageSchema.index(
    { conversation: 1, sender: 1, clientRequestId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            clientRequestId: { $type: "string", $gt: "" },
        },
    }
);

export const DmMessage = mongoose.model("DmMessage", dmMessageSchema);
