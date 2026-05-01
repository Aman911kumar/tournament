import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    round: {
        type: Number,
        required: true,
        index: true
    },
    scheduledAt: {
        type: Date,
        validate: {
            validator: function (value) {
                return !value || value > new Date();
            },
            message: "Scheduled date must be in the future."
        }
    },
    server: {
        ip: { type: String, trim: true },
        region: { type: String, trim: true },
        roomId: { type: String, trim: true },
        password: { type: String, trim: true }
    },
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        score: { type: Number, default: 0 },
        kills: { type: Number, default: 0 },
        result: {
            type: String,
            enum: ['win', 'loss', 'draw', 'pending'],
            default: 'pending'
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'running', 'finished', 'cancelled'],
        default: 'scheduled',
        index: true
    },
    resultPublishedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

export const Match = mongoose.model('Match', matchSchema);
