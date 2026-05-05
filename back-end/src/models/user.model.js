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
        lowercase: true,
        trim: true
    },
    phone_number: {
        index: true,
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        default: undefined,
    },
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
    avatar: {
        public_id: { type: String, trim: true },
        url: { type: String, trim: true }
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    role: {
        type: [String],
        enum: ['user', 'creator', 'admin', 'banned'],
        default: ['user']
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
        notifications: { type: Boolean, default: true }
    },
    refreshToken: {
        type: String
    }
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
