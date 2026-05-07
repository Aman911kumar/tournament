import mongoose from "mongoose";

const gameAccountSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        game: {
            type: String,
            required: true,
            trim: true,
        },
        inGameName: {
            type: String,
            required: true,
            trim: true,
        },
        gameId: {
            type: String,
            required: true,
            trim: true,
        },
        level: {
            type: String,
            default: null,
        },
        verified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

gameAccountSchema.index({ user: 1, game: 1 }, { unique: true });
gameAccountSchema.index({ game: 1, gameId: 1 }, { unique: true });
gameAccountSchema.index({ verified: 1, createdAt: -1 });

export const GameAccount = mongoose.model("GameAccount", gameAccountSchema);
