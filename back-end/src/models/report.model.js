import mongoose from "mongoose";

const reportCategoryValues = [
    "creator",
    "player",
    "tournament",
    "cheating",
    "abusive_behavior",
    "fake_results",
    "spam",
    "fraud_scam",
    "inappropriate_content",
    "payout_not_distributed",
    "wrong_payout",
    "room_details_issue",
    "payment_issue",
    "other",
];

const reportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        reporterRole: {
            type: String,
            enum: ["player", "creator", "admin", "moderator"],
            default: "player",
            index: true,
        },
        targetType: {
            type: String,
            enum: ["creator", "player", "tournament", "team", "match", "system"],
            default: "tournament",
            index: true,
        },
        category: {
            type: String,
            enum: reportCategoryValues,
            default: "other",
            index: true,
        },
        reason: {
            type: String,
            enum: reportCategoryValues,
            default: "other",
            index: true,
        },
        title: {
            type: String,
            trim: true,
            default: "",
        },
        message: {
            type: String,
            trim: true,
            default: "",
        },
        reportedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        reportedCreator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
            default: null,
            index: true
        },
        content: {
            type: String,
            default: "",
            trim: true
        },
        scores: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true
        },
        evidence: {
            screenshots: [{ type: String, trim: true }],
            videoUrl: { type: String, trim: true, default: "" },
            matchProof: { type: String, trim: true, default: "" },
        },
        severity: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium",
            index: true,
        },
        status: {
            type: String,
            enum: ["open", "under_review", "actioned", "resolved", "rejected", "closed", "reviewed"],
            default: "open",
            index: true
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        resolution: {
            type: String,
            trim: true,
            default: "",
        },
        adminResponse: {
            type: String,
            default: null
        },
        duplicateKey: {
            type: String,
            trim: true,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

reportSchema.pre("validate", function (next) {
    if (!this.reporter && this.createdBy) this.reporter = this.createdBy;
    if (!this.createdBy && this.reporter) this.createdBy = this.reporter;
    if (!this.message && this.content) this.message = this.content;
    if (!this.content && this.message) this.content = this.message;
    if (!this.reason && this.category) this.reason = this.category;
    if (!this.category && this.reason) this.category = this.reason;
    next();
});

reportSchema.index({ tournament: 1, createdAt: -1 });
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, severity: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, category: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, status: 1, createdAt: -1 });
reportSchema.index({ reportedCreator: 1, status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
export { reportCategoryValues };
