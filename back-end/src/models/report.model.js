import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
    {
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
            index: true
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            required: true,
            index: true
        },
        content: {
            type: String,
            required: true,
            trim: true
        },
        scores: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ["open", "reviewed", "resolved", "rejected"],
            default: "open",
            index: true
        },
        adminResponse: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

reportSchema.index({ tournament: 1, match: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
