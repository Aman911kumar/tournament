import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        default: null
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['report', 'dispute', 'general'],
        default: 'general'
    },
    reason: {
        type: String,
        enum: [
            'cheating',
            'abusive_behavior',
            'fake_result',
            'payout_not_distributed',
            'wrong_payout',
            'room_details_issue',
            'payment_issue',
            'other'
        ],
        default: 'other',
        index: true
    },
    evidence: {
        screenshots: [{ type: String, trim: true }],
        videoUrl: { type: String, trim: true, default: "" },
        matchProof: { type: String, trim: true, default: "" }
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        index: true
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    adminResponse: {
        type: String,
        default: null
    },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null }
}, { timestamps: true });

SupportTicketSchema.index({ user: 1, tournament: 1 });
SupportTicketSchema.index({ tournament: 1, type: 1, status: 1 });
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ user: 1, createdAt: -1 });

export const SupportTicket = mongoose.model("SupportTicket", SupportTicketSchema);
