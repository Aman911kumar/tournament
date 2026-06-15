import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY
} from "../../env.js";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
        match: [/^[a-zA-Z0-9_]{4,30}$/, "Invalid username format"],
    },
    email: {
        index: true,
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    phone_number: {
        index: true,
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        default: undefined,
    },
    phoneVerified: {
        type: Boolean,
        default: false,
    },
    linkedProviders: [{
        provider: {
            type: String,
            enum: ["password", "google", "facebook", "phone", "email"],
            required: true,
        },
        providerId: { type: String, trim: true },
        linkedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
    }],
    socialProvider: {
        type: String,
        enum: ["google", "facebook"],
        index: true,
        default: undefined,
    },
    socialProviderId: {
        type: String,
        index: true,
        default: undefined,
    },
    dateOfBirth: {
        type: Date,
        default: null
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: null
    },
    password: {
        type: String,
        required: [true, "Password is required"],
    },
    passwordLoginEnabled: {
        type: Boolean,
        default: false,
    },
    transferPinHash: {
        type: String,
        select: false,
    },
    avatar: {
        public_id: { type: String, trim: true },
        mediaId: { type: String, trim: true },
        provider: { type: String, trim: true },
        url: { type: String, trim: true },
        thumbUrl: { type: String, trim: true },
        updatedAt: { type: Date }
    },
    banner: {
        public_id: { type: String, trim: true },
        mediaId: { type: String, trim: true },
        provider: { type: String, trim: true },
        url: { type: String, trim: true },
        thumbUrl: { type: String, trim: true },
        updatedAt: { type: Date }
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    stats: {
        rating: { type: Number, default: 0, min: 0, max: 5 },
        ratingCount: { type: Number, default: 0, min: 0 },
    },
    role: {
        type: [String],
        enum: ['user', 'creator', 'admin', 'super_admin', 'moderator', 'support', 'finance_manager', 'tournament_manager', 'banned'],
        default: ['user']
    },
    adminPermissions: {
        type: [String],
        default: [],
    },
    accountStatus: {
        type: String,
        enum: ["active", "suspended", "muted", "banned"],
        default: "active",
        index: true,
    },
    suspendedUntil: {
        type: Date,
        default: null,
    },
    mutedUntil: {
        type: Date,
        default: null,
    },
    moderationNote: {
        type: String,
        trim: true,
        default: "",
    },
    creatorRequest: {
        status: {
            type: String,
            enum: ["none", "pending", "approved", "rejected", "removed"],
            default: "none",
            index: true,
        },
        requestedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        note: { type: String, trim: true, default: "" },
    },
    lastLoginAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    preferences: {
        notifications: { type: Boolean, default: true },
        dmPrivacy: {
            type: String,
            enum: ["everyone", "followers_only", "subscribers_only", "mutual_followers", "nobody"],
            default: "everyone",
        },
        dmReadReceipts: {
            type: Boolean,
            default: true,
        },
        dmOnlineStatus: {
            type: Boolean,
            default: true,
        },
    },
    refreshToken: {
        type: String
    },
    emailVerificationToken: {
        type: String,
        select: false,
    },
    emailVerificationExpires: {
        type: Date,
        select: false,
    },
    phoneVerificationToken: {
        type: String,
        select: false,
    },
    phoneVerificationExpires: {
        type: Date,
        select: false,
    },
    resetPasswordToken: {
        type: String,
        select: false,
    },
    resetPasswordExpires: {
        type: Date,
        select: false,
    },
    resetPasswordOtpHash: {
        type: String,
        select: false,
    },
    resetPasswordOtpExpires: {
        type: Date,
        select: false,
    },
    resetPasswordOtpAttempts: {
        type: Number,
        select: false,
        default: 0,
        min: 0,
    },
    resetPasswordRequestIdHash: {
        type: String,
        select: false,
    },
    resetPasswordRequestIdExpires: {
        type: Date,
        select: false,
    },
    resetPasswordResendAvailableAt: {
        type: Date,
        select: false,
        default: null,
    },
    resetPasswordResendCount: {
        type: Number,
        select: false,
        default: 0,
        min: 0,
    },
    resetPasswordResendWindowStart: {
        type: Date,
        select: false,
        default: null,
    },
    resetPasswordGrantHash: {
        type: String,
        select: false,
    },
    resetPasswordGrantExpires: {
        type: Date,
        select: false,
    },
    onboarding: {
        completedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ["google", "facebook", "password", "admin", "unknown"],
            default: "unknown",
        },
        ageBand: {
            type: String,
            enum: ["teen", "adult"],
            default: null,
        },
    },
    legalAgreements: {
        acceptedAt: { type: Date, default: null },
        termsAcceptedAt: { type: Date, default: null },
        privacyAcceptedAt: { type: Date, default: null },
        communityAcceptedAt: { type: Date, default: null },
        version: { type: String, trim: true, default: "" },
    },
}, { timestamps: true });

userSchema.index(
    { socialProvider: 1, socialProviderId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            socialProvider: { $type: "string" },
            socialProviderId: { $type: "string" },
        },
    }
);
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ "creatorRequest.status": 1, "creatorRequest.requestedAt": -1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Check password
userSchema.methods.isPasswordCorrect = async function (password) {
    if (!password || !this.password) {
        throw new Error("Password or hash missing");
    }
    return await bcrypt.compare(password, this.password);
};

// Generate Access Token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
            // avatar: this.avatar?.url,
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { _id: this._id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
};

export const User = mongoose.model("User", userSchema);
