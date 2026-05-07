import mongoose from "mongoose";

const AdminAuditLogSchema = new mongoose.Schema({
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    entity: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
    },
    note: {
        type: String,
        trim: true,
        default: "",
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

AdminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model("AdminAuditLog", AdminAuditLogSchema);
