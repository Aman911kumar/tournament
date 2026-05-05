import mongoose from "mongoose";

const LeaderboardSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    type: {
        type: String,
        enum: ['solo', 'duo', 'squad', 'team'],
        required: true
    },
    entries: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
            kills: { type: Number, default: 0 },
            points: { type: Number, default: 0 },
            position: { type: Number, default: 0 }
        }
    ],
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

LeaderboardSchema.index({ tournament: 1 });
LeaderboardSchema.index({ "entries.user": 1 });

export const Leaderboard = mongoose.model("Leaderboard", LeaderboardSchema);
