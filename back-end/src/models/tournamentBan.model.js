import mongoose from "mongoose";

const tournamentBanSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            index: true,
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        scope: {
            type: String,
            enum: ["tournament", "creator"],
            default: "tournament",
            index: true,
        },
        reason: {
            type: String,
            trim: true,
            required: true,
            maxlength: 500,
        },
        note: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000,
        },
        status: {
            type: String,
            enum: ["active", "revoked", "expired"],
            default: "active",
            index: true,
        },
        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },
        bannedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        bannedAt: {
            type: Date,
            default: Date.now,
        },
        revokedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

tournamentBanSchema.index(
    { tournament: 1, player: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "active" },
    }
);
tournamentBanSchema.index({ creator: 1, player: 1, status: 1, createdAt: -1 });
tournamentBanSchema.index({ player: 1, status: 1, expiresAt: 1 });

export const TournamentBan = mongoose.model("TournamentBan", tournamentBanSchema);
