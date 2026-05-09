import mongoose from "mongoose";

const moderationActionSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        actorRole: {
            type: String,
            enum: ["player", "creator", "moderator", "admin", "system"],
            default: "creator",
            index: true,
        },
        action: {
            type: String,
            enum: [
                "report_created",
                "report_reviewed",
                "warn",
                "mute",
                "suspend",
                "tournament_ban",
                "tournament_unban",
                "global_ban",
                "player_removed",
            ],
            required: true,
            index: true,
        },
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            default: null,
            index: true,
        },
        report: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            default: null,
            index: true,
        },
        ban: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TournamentBan",
            default: null,
        },
        note: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

moderationActionSchema.index({ createdAt: -1 });
moderationActionSchema.index({ tournament: 1, createdAt: -1 });
moderationActionSchema.index({ targetUser: 1, createdAt: -1 });
moderationActionSchema.index({ action: 1, createdAt: -1 });

export const ModerationAction = mongoose.model("ModerationAction", moderationActionSchema);
