import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        unreadCount: {
            type: Number,
            min: 0,
            default: 0,
        },
        pinned: {
            type: Boolean,
            default: false,
            index: true,
        },
        muted: {
            type: Boolean,
            default: false,
        },
        archived: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        lastReadAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

const userActionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 240,
            default: "",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const dmConversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["direct"],
            default: "direct",
            index: true,
        },
        participantKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        participants: {
            type: [participantSchema],
            validate: {
                validator: (items) => Array.isArray(items) && items.length === 2,
                message: "Direct conversations require exactly two participants",
            },
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        request: {
            status: {
                type: String,
                enum: ["accepted", "pending", "declined"],
                default: "accepted",
                index: true,
            },
            requestedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            respondedAt: {
                type: Date,
                default: null,
            },
        },
        blockedBy: {
            type: [userActionSchema],
            default: [],
        },
        lastMessage: {
            message: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "DmMessage",
                default: null,
            },
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            body: {
                type: String,
                trim: true,
                default: "",
            },
            type: {
                type: String,
                trim: true,
                default: "text",
            },
            createdAt: {
                type: Date,
                default: null,
            },
        },
        lastActivityAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

dmConversationSchema.index({ "participants.user": 1, lastActivityAt: -1 });
dmConversationSchema.index({ "participants.user": 1, "participants.unreadCount": -1 });
dmConversationSchema.index({ "request.status": 1, lastActivityAt: -1 });
dmConversationSchema.index({ lastActivityAt: -1 });

export const DmConversation = mongoose.model("DmConversation", dmConversationSchema);
