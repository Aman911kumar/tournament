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
SupportTicketSchema.index({ status: 1 });

export const SupportTicket = mongoose.model("SupportTicket", SupportTicketSchema);
