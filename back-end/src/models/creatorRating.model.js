import mongoose from "mongoose";

const CreatorRatingSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
}, { timestamps: true });

CreatorRatingSchema.index({ creator: 1, user: 1 }, { unique: true });

export const CreatorRating = mongoose.model("CreatorRating", CreatorRatingSchema);
