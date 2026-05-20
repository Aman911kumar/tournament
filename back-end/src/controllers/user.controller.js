import asyncHandler from '../utils/AsyncHandler.js'
import ApiError from '../utils/ApiError.js'
import ApiResponse from '../utils/ApiResponse.js'
import { User } from '../models/user.model.js'
import { WalletTransaction } from '../models/walletTransaction.model.js'
import { Wallet } from '../models/wallet.model.js'
import { Payment } from '../models/payment.model.js'
import { Notification } from '../models/notification.model.js'
import { PushSubscription } from '../models/pushSubscription.model.js'
import { Tournament } from '../models/tournament.model.js'
import { Registration } from '../models/registration.model.js'
import { hasRole } from '../middlewares/auth.middleware.js'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import axios from 'axios'
import {
    ACCESS_TOKEN_SECRET,
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_GRAPH_VERSION,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    APP_PUBLIC_URL,
    API_PUBLIC_URL,
    REFRESH_TOKEN_SECRET
} from '../../env.js'
import { expireStaleRazorpayPayments } from '../services/paymentExpiry.service.js'
import { sendEmailVerification, sendPasswordResetEmail, sendPhoneVerificationEmail } from '../services/auth.service.js'
import { getPushPublicKey } from '../services/notification.service.js'
import { OAuthLoginCode } from "../models/oauthLoginCode.model.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, error || 'something went while generating refresh and access token')
    }
}

const isProduction = process.env.NODE_ENV === "production";
const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
}

const normalizeUsername = (value = "") => {
    const base = value
        .toString()
        .toLowerCase()
        .replace(/@.*/, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24);

    return base.length >= 4 ? base : `user_${base || "player"}`;
};

const createUniqueUsername = async (name, email, providerId) => {
    const base = normalizeUsername(email || name || providerId);
    let username = base.slice(0, 30);
    let suffix = 0;

    while (await User.exists({ username: { $regex: `^${username}$`, $options: "i" } })) {
        suffix += 1;
        const nextSuffix = `_${suffix}`;
        username = `${base.slice(0, 30 - nextSuffix.length)}${nextSuffix}`;
    }

    return username;
};

const isProviderPhoneNumber = (value) => /^(google|facebook):/i.test(String(value || ""));

const normalizePhoneNumber = (value = "") => {
    const compact = String(value).trim().replace(/\s+/g, "");
    const digits = compact.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 10) return digits;
    return compact;
};

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const isValidIndianPhoneNumber = (value = "") => /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const toPositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clampInt = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.floor(parsed);
    return Math.min(max, Math.max(min, rounded));
};

const msFromMinutes = (minutes, fallbackMinutes) =>
    clampInt(minutes, 1, 60 * 24 * 30, fallbackMinutes) * 60 * 1000;

const msFromDays = (days, fallbackDays) =>
    clampInt(days, 1, 365, fallbackDays) * 24 * 60 * 60 * 1000;

const randomOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sha256Hex = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// OAuth redirect login (Web + mobile via external browser + deep links)
const OAUTH_STATE_COOKIE = "b4a_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const base64UrlEncode = (input) =>
    Buffer.from(typeof input === "string" ? input : JSON.stringify(input), "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

const base64UrlDecodeJson = (value = "") => {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
};

const timingSafeEqual = (a, b) => {
    try {
        const ba = Buffer.from(String(a));
        const bb = Buffer.from(String(b));
        if (ba.length !== bb.length) return false;
        return crypto.timingSafeEqual(ba, bb);
    } catch {
        return false;
    }
};

const signOAuthCookie = (payload) => {
    if (!ACCESS_TOKEN_SECRET) {
        throw new ApiError(500, "ACCESS_TOKEN_SECRET is missing");
    }
    const body = base64UrlEncode(payload);
    const sig = crypto
        .createHmac("sha256", String(ACCESS_TOKEN_SECRET))
        .update(body)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    return `${body}.${sig}`;
};

const verifyOAuthCookie = (signedValue) => {
    const raw = String(signedValue || "");
    const [body, sig] = raw.split(".");
    if (!body || !sig) return null;
    if (!ACCESS_TOKEN_SECRET) return null;

    const expectedSig = crypto
        .createHmac("sha256", String(ACCESS_TOKEN_SECRET))
        .update(body)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    if (!timingSafeEqual(expectedSig, sig)) return null;
    try {
        return base64UrlDecodeJson(body);
    } catch {
        return null;
    }
};

const resolveApiPublicUrl = (req) => {
    const fromEnv = String(API_PUBLIC_URL || "").trim().replace(/\/$/, "");
    if (fromEnv) return fromEnv;

    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString().split(",")[0].trim();
    const host = (req.headers["x-forwarded-host"] || req.get("host") || "").toString().split(",")[0].trim();
    if (!host) return "";
    return `${proto}://${host}`;
};

const resolveAllowedReturnOrigins = () => {
    const list = [
        ...(String(APP_PUBLIC_URL || "").split(",").map((v) => v.trim()).filter(Boolean)),
        ...(String(process.env.CORS_ORIGIN || "").split(",").map((v) => v.trim()).filter(Boolean)),
        ...(String(process.env.OAUTH_ALLOWED_RETURN_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean)),
    ];

    const origins = new Set();
    for (const item of list) {
        try {
            if (!item) continue;
            const url = new URL(item);
            origins.add(url.origin);
        } catch {
            // ignore
        }
    }
    return origins;
};

const resolveAllowedReturnSchemes = () => {
    const list = [
        ...(String(process.env.APP_DEEPLINK_SCHEME || "battle4arena").split(",").map((v) => v.trim()).filter(Boolean)),
        ...(String(process.env.OAUTH_ALLOWED_RETURN_SCHEMES || "").split(",").map((v) => v.trim()).filter(Boolean)),
    ];
    return new Set(list.map((v) => v.replace(/:$/, "")));
};

const assertAllowedReturnTo = (returnTo) => {
    const value = String(returnTo || "").trim();
    if (!value) throw new ApiError(400, "returnTo is required");

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new ApiError(400, "Invalid returnTo URL");
    }

    const allowedOrigins = resolveAllowedReturnOrigins();
    const allowedSchemes = resolveAllowedReturnSchemes();

    if (url.protocol === "http:" || url.protocol === "https:") {
        if (!allowedOrigins.has(url.origin)) {
            throw new ApiError(400, "returnTo origin is not allowed");
        }
        return url.toString();
    }

    const scheme = url.protocol.replace(/:$/, "");
    if (!allowedSchemes.has(scheme)) {
        throw new ApiError(400, "returnTo scheme is not allowed");
    }
    return url.toString();
};

const resolveDefaultReturnTo = () => {
    const candidates = [
        ...(String(APP_PUBLIC_URL || "").split(",").map((v) => v.trim()).filter(Boolean)),
        ...(String(process.env.CORS_ORIGIN || "").split(",").map((v) => v.trim()).filter(Boolean)),
    ];

    for (const item of candidates) {
        try {
            const url = new URL(item);
            return `${url.origin}/oauth/callback`;
        } catch {
            // ignore invalid entries
        }
    }

    return "http://localhost:8080/oauth/callback";
};

const resolveAllowedReturnToOrDefault = (rawReturnTo) => {
    // Never throw here. If the returnTo is missing/invalid/not-allowed, fall back to a safe app URL.
    const value = String(rawReturnTo || "").trim();
    if (!value) return resolveDefaultReturnTo();
    try {
        return assertAllowedReturnTo(value);
    } catch {
        return resolveDefaultReturnTo();
    }
};

const redirectOAuthResult = (res, { returnTo, provider, code, error, errorDescription }) => {
    let target = returnTo || resolveDefaultReturnTo();
    try {
        const url = new URL(String(target));
        if (provider) url.searchParams.set("provider", String(provider));
        if (code) url.searchParams.set("code", String(code));
        if (error) url.searchParams.set("error", String(error));
        if (errorDescription) url.searchParams.set("error_description", String(errorDescription));
        return res.redirect(url.toString());
    } catch {
        // If the returnTo is malformed for any reason, fall back to the app public url.
        const fallback = new URL(resolveDefaultReturnTo());
        if (provider) fallback.searchParams.set("provider", String(provider));
        if (error) fallback.searchParams.set("error", String(error));
        if (errorDescription) fallback.searchParams.set("error_description", String(errorDescription));
        return res.redirect(fallback.toString());
    }
};

const getAgeYears = (dateOfBirth) => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
    return age;
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findUserByIdentifier = async (rawIdentifier, projection) => {
    const identifier = String(rawIdentifier || "").trim();
    const normalizedPhone = normalizePhoneNumber(identifier);
    const normalizedEmail = normalizeEmail(identifier);
    const exactUsername = new RegExp(`^${escapeRegex(identifier)}$`, "i");
    const exactEmail = new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i");
    const digits = identifier.replace(/\D/g, "");
    const looksLikeEmail = isValidEmail(identifier);
    const looksLikePhone = /^\+?\d[\d\s()-]{7,}$/.test(identifier) && (digits.length === 10 || (digits.length === 12 && digits.startsWith("91")));
    const candidates = looksLikeEmail
        ? [
            { email: normalizedEmail },
            { email: exactEmail },
        ]
        : looksLikePhone
            ? [
                { phone_number: identifier },
                { phone_number: normalizedPhone },
                ...(digits ? [{ phone_number: digits }] : []),
            ]
            : [
                { username: exactUsername },
            ];
    // console.log("Finding user with candidates:", candidates);
    const directMatch = await User.findOne({
        $or: candidates
    })
        .collation({ locale: "en", strength: 2 })
        .select(projection || "");

    if (directMatch || !identifier) return directMatch;

    const loosePattern = new RegExp(escapeRegex(identifier), "i");
    const loosePhonePattern = digits ? new RegExp(escapeRegex(digits), "i") : null;
    const looseCandidates = looksLikeEmail
        ? [{ email: loosePattern }, { email: new RegExp(escapeRegex(normalizedEmail), "i") }]
        : looksLikePhone
            ? (loosePhonePattern ? [{ phone_number: loosePhonePattern }] : [])
            : [{ username: loosePattern }];

    return User.findOne({
        $or: looseCandidates,
    }).select(projection || "");
};

const getIdentifierDebugInfo = (rawIdentifier) => {
    const identifier = String(rawIdentifier || "").trim();
    const digits = identifier.replace(/\D/g, "");

    return {
        received: identifier,
        normalizedPhone: normalizePhoneNumber(identifier),
        normalizedEmail: normalizeEmail(identifier),
        username: identifier,
        digits: digits || undefined,
    };
};

const toDateInputString = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
};

const sanitizeUserForResponse = (user) => {
    const plain = user?.toObject?.() || user;
    if (!plain) return plain;

    const { password, refreshToken, ...safeUser } = plain;
    if (isProviderPhoneNumber(safeUser.phone_number)) {
        delete safeUser.phone_number;
    }

    return safeUser;
};

const getPlayerStats = async (userId) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [wallet, allTimeWinnings, monthlyWinnings, tournamentsPlayed] = await Promise.all([
        Wallet.findOne({ user: userId }).select("balance"),
        WalletTransaction.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), type: "CREDIT", category: "WINNING", status: "SUCCESS" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        WalletTransaction.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), type: "CREDIT", category: "WINNING", status: "SUCCESS", createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Registration.countDocuments({
            $or: [{ user: userId }, { team: userId }],
            status: { $in: ["paid", "confirmed"] }
        })
    ]);

    const amountWon = Number(allTimeWinnings[0]?.total || 0);
    const monthWon = Number(monthlyWinnings[0]?.total || 0);

    return {
        walletBalance: Number(wallet?.balance || 0),
        stats: {
            matchesPlayed: tournamentsPlayed,
            tournamentsPlayed,
            kills: 0,
            amount_won: amountWon,
        },
        playerEarnings: amountWon,
        playerMonthlyChange: amountWon > 0 ? Math.round((monthWon / amountWon) * 100) : 0,
    };
};

const buildUserProfileResponse = async (user) => {
    const safeUser = sanitizeUserForResponse(user);
    if (!safeUser?._id) return safeUser;

    const playerStats = await getPlayerStats(safeUser._id);
    return {
        ...safeUser,
        walletBalance: playerStats.walletBalance,
        stats: playerStats.stats,
        playerEarnings: playerStats.playerEarnings,
        playerMonthlyChange: playerStats.playerMonthlyChange,
    };
};

const issueAuthResponse = async (res, user, message) => {
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

    return res.status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(200, { user: sanitizeUserForResponse(loggedInUser), accessToken, refreshToken }, message)
        );
};

const findOrCreateSocialUser = async ({ provider, providerId, email, name, picture }) => {
    if (!provider || !providerId) {
        throw new ApiError(400, "Invalid social profile");
    }

    const normalizedEmail = email?.trim().toLowerCase();
    const accountEmail = normalizedEmail || `${provider}_${providerId}@${provider}.local`;
    const legacySocialPhoneNumber = `${provider}:${providerId}`;

    const existingUser = await User.findOne({
        $or: [
            { socialProvider: provider, socialProviderId: providerId },
            { email: accountEmail },
            { phone_number: legacySocialPhoneNumber }
        ]
    });

    // EXISTING USER FLOW
    if (existingUser) {
        let isUpdated = false;

        if (!existingUser.email && normalizedEmail) {
            existingUser.email = normalizedEmail;
            isUpdated = true;
        }

        if (!existingUser.socialProvider || !existingUser.socialProviderId) {
            existingUser.socialProvider = provider;
            existingUser.socialProviderId = providerId;
            isUpdated = true;
        }

        const existingLinks = existingUser.linkedProviders || [];
        const nextLinks = [...existingLinks];
        if (!nextLinks.some((link) => link.provider === provider && link.providerId === providerId)) {
            nextLinks.push({ provider, providerId, verified: true });
        }
        if (normalizedEmail && !nextLinks.some((link) => link.provider === "email" && link.providerId === normalizedEmail)) {
            nextLinks.push({ provider: "email", providerId: normalizedEmail, verified: true });
        }
        if (nextLinks.length !== existingLinks.length) {
            existingUser.linkedProviders = nextLinks;
            isUpdated = true;
        }

        if (normalizedEmail && !existingUser.emailVerified) {
            existingUser.emailVerified = true;
            isUpdated = true;
        }

        if (isProviderPhoneNumber(existingUser.phone_number)) {
            existingUser.set("phone_number", undefined);
            isUpdated = true;
        }

        if (!existingUser.avatar?.url && picture) {
            existingUser.avatar = { ...existingUser.avatar, url: picture };
            isUpdated = true;
        }

        if (isUpdated) {
            await existingUser.save();
        }

        return existingUser;
    }

    // NEW USER FLOW (WITH TRANSACTION)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const username = await createUniqueUsername(name, accountEmail, providerId);
        const password = crypto.randomBytes(32).toString("hex");

        const userArr = await User.create(
            [
                {
                    username,
                    email: accountEmail,
                    emailVerified: Boolean(normalizedEmail),
                    socialProvider: provider,
                    socialProviderId: providerId,
                    password,
                    passwordLoginEnabled: false,
                    avatar: picture ? { url: picture } : undefined,
                    linkedProviders: [
                        { provider, providerId, verified: true },
                        { provider: "email", providerId: accountEmail, verified: Boolean(normalizedEmail) }
                    ],
                }
            ],
            { session }
        );

        const user = userArr[0];

        await Wallet.create(
            [
                {
                    user: user._id,
                    balance: 0,
                    lockedBalance: 0
                }
            ],
            { session }
        );

        await session.commitTransaction();
        return user;

    } catch (error) {
        await session.abortTransaction();
        throw new ApiError(500, "Social login failed");
    } finally {
        session.endSession();
    }
};

const getGoogleProfile = async ({ access_token, credential }) => {
    if (access_token) {
        try {
            const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            if (!data?.sub) {
                throw new Error("Google profile did not include an id");
            }

            return {
                provider: "google",
                providerId: data.sub,
                email: data.email,
                name: data.name,
                picture: data.picture,
            };
        } catch (error) {
            throw new ApiError(401, error?.response?.data?.error_description || "Invalid Google access token");
        }
    }

    if (credential) {
        try {
            const { data } = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
                params: { id_token: credential },
            });

            if (!data?.sub) {
                throw new Error("Google credential did not include an id");
            }

            if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
                throw new Error("Google credential audience does not match this app");
            }

            return {
                provider: "google",
                providerId: data.sub,
                email: data.email,
                name: data.name,
                picture: data.picture,
            };
        } catch (error) {
            throw new ApiError(401, error?.response?.data?.error_description || error?.message || "Invalid Google credential");
        }
    }

    throw new ApiError(400, "Google access token is required");
};

const getFacebookProfile = async ({ accessToken, access_token, userID }) => {
    const token = accessToken || access_token;

    if (!token) {
        throw new ApiError(400, "Facebook access token is required");
    }

    try {
        if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
            const appAccessToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
            const { data: tokenData } = await axios.get(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/debug_token`, {
                params: { input_token: token, access_token: appAccessToken },
            });

            if (!tokenData?.data?.is_valid) {
                throw new Error("Facebook token is invalid");
            }

            if (tokenData.data.app_id && tokenData.data.app_id !== FACEBOOK_APP_ID) {
                throw new Error("Facebook token audience does not match this app");
            }

            if (userID && tokenData.data.user_id && tokenData.data.user_id !== userID) {
                throw new Error("Facebook token user does not match");
            }
        }

        const { data } = await axios.get(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`, {
            params: {
                fields: "id,name,email,picture.type(large)",
                access_token: token,
            },
        });

        if (!data?.id) {
            throw new Error("Facebook profile did not include an id");
        }

        return {
            provider: "facebook",
            providerId: data.id,
            email: data.email,
            name: data.name,
            picture: data.picture?.data?.url,
        };
    } catch (error) {
        throw new ApiError(401, error?.response?.data?.error?.message || error?.message || "Invalid Facebook access token");
    }
};

// Auth & Account___________________________________________________________________________________________________

const registerUser = asyncHandler(async (req, res) => {
    const { username, phone_number, password, email } = req.body;
    const normalizedEmail = email ? normalizeEmail(email) : undefined;
    const normalizedPhone = normalizePhoneNumber(phone_number);

    // Validate required fields
    [
        { field: username, name: "username" },
        { field: email, name: "email" },
        { field: phone_number, name: "phone number" },
        { field: password, name: "password" }
    ].forEach(item => {
        if (!item.field || item.field.trim() === '') {
            throw new ApiError(400, `${item.name} is required`);
        }
    });

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        throw new ApiError(400, "Invalid email address");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [
            { username: { $regex: `^${username}$`, $options: "i" } },
            { phone_number: normalizedPhone },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
        ]
    });

    if (existedUser) {
        throw new ApiError(400, 'Username, email, or phone number already exists');
    }

    // 🔥 START TRANSACTION
    const session = await mongoose.startSession();
    session.startTransaction();

    let user;

    try {
        // 1️⃣ Create user
        const createdUserArr = await User.create(
            [{
                username,
                phone_number: normalizedPhone,
                password,
                email: normalizedEmail,
                passwordLoginEnabled: true,
                linkedProviders: [
                    { provider: "password", providerId: username, verified: true },
                    { provider: "phone", providerId: normalizedPhone, verified: false },
                    { provider: "email", providerId: normalizedEmail, verified: false }
                ]
            }],
            { session }
        );

        user = createdUserArr[0];

        // 2️⃣ Create wallet (IMPORTANT: match your schema field)
        await Wallet.create(
            [
                {
                    user: user._id,
                    balance: 0,
                    lockedBalance: 0
                }
            ],
            { session }
        );

        // ✅ Commit both together
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ApiError(500, 'Failed to register user',error);
    } finally {
        session.endSession();
    }

    // 🔐 Generate tokens AFTER success
    const { accessToken, refreshToken } =
        await generateAccessTokenAndRefreshToken(user._id);

    // Exclude sensitive fields
    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");

    return res.status(201)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(
                201,
                { user: createdUser, accessToken, refreshToken },
                "User registered successfully"
            )
        );
});

const loginUser = asyncHandler(async (req, res) => {
    const { phone_number, identifier, username, email, password } = req.body;
    const loginIdentifier = phone_number || identifier || username || email;

    // console.log(phone_number, "\n", password)
    // Validate input
    [{ field: loginIdentifier, name: "username, email, or phone number" },
    { field: password, name: "password" }].forEach(item => {
        if (!item.field || item.field.trim() === '') {
            throw new ApiError(400, `${item.name} is required`);
        }
    });

    // Find user
    const user = await findUserByIdentifier(loginIdentifier);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    // console.log(password)
    // Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Incorrect password');
    }

    // Optional: update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    // Exclude sensitive fields
    const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

    return res.status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(200, { user: sanitizeUserForResponse(loggedInUser), accessToken, refreshToken }, "logged in successfully")
        );
});
const loginWithGoogle = asyncHandler(async (req, res) => {
    const profile = await getGoogleProfile(req.body);
    const user = await findOrCreateSocialUser(profile);

    return issueAuthResponse(res, user, "Logged in with Google successfully");
});

const loginWithFacebook = asyncHandler(async (req, res) => {
    const profile = await getFacebookProfile(req.body);
    const user = await findOrCreateSocialUser(profile);

    return issueAuthResponse(res, user, "Logged in with Facebook successfully");
});

const startOAuthLogin = asyncHandler(async (req, res) => {
    const provider = String(req.params.provider || "").trim().toLowerCase();
    if (!["google", "facebook"].includes(provider)) {
        throw new ApiError(404, "OAuth provider not supported");
    }

    const rawReturnTo = req.query?.returnTo || req.query?.return_to || req.query?.returnUrl || req.query?.return_url || "";
    const returnTo = resolveAllowedReturnToOrDefault(rawReturnTo);

    try {
        if (provider === "google" && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)) {
            return redirectOAuthResult(res, {
                returnTo,
                provider,
                error: "provider_not_configured",
                errorDescription: "Google login is not configured. Contact support.",
            });
        }

        if (provider === "facebook" && (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET)) {
            return redirectOAuthResult(res, {
                returnTo,
                provider,
                error: "provider_not_configured",
                errorDescription: "Facebook login is not configured. Contact support.",
            });
        }

        const state = crypto.randomBytes(16).toString("hex");
        const createdAt = Date.now();

        const ctx = {
            provider,
            state,
            returnTo,
            createdAt,
        };

        res.cookie(OAUTH_STATE_COOKIE, signOAuthCookie(ctx), {
            ...options,
            maxAge: OAUTH_STATE_TTL_MS,
        });

        const apiPublicUrl = resolveApiPublicUrl(req);
        const callbackUrl = `${apiPublicUrl}/api/v1/auth/oauth/${provider}/callback`;

        if (provider === "google") {
            const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
            authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
            authUrl.searchParams.set("redirect_uri", callbackUrl);
            authUrl.searchParams.set("response_type", "code");
            authUrl.searchParams.set("scope", "openid email profile");
            authUrl.searchParams.set("state", state);
            // Keep it lightweight; refresh tokens are not required for basic sign-in.
            authUrl.searchParams.set("access_type", "online");

            return res.redirect(authUrl.toString());
        }

        const fbUrl = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
        fbUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
        fbUrl.searchParams.set("redirect_uri", callbackUrl);
        fbUrl.searchParams.set("response_type", "code");
        fbUrl.searchParams.set("scope", "public_profile,email");
        fbUrl.searchParams.set("state", state);

        return res.redirect(fbUrl.toString());
    } catch (err) {
        return redirectOAuthResult(res, {
            returnTo,
            provider,
            error: "oauth_start_failed",
            errorDescription: "Could not start login. Please try again.",
        });
    }
});

const oauthGoogleCallback = asyncHandler(async (req, res) => {
    let ctx = null;
    try {
        const code = String(req.query?.code || "").trim();
        const state = String(req.query?.state || "").trim();
        const error = String(req.query?.error || "").trim();
        const errorDescription = String(req.query?.error_description || "").trim();

        const signed = req.cookies?.[OAUTH_STATE_COOKIE] || "";
        ctx = verifyOAuthCookie(signed);

        res.clearCookie(OAUTH_STATE_COOKIE, options);

        if (!ctx || ctx.provider !== "google") {
            return redirectOAuthResult(res, {
                provider: "google",
                error: "oauth_session_expired",
                errorDescription: "Login session expired. Please try again.",
            });
        }

        if (!state || state !== ctx.state) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "oauth_state_mismatch",
                errorDescription: "Login state mismatch. Please try again.",
            });
        }

        if (Date.now() - Number(ctx.createdAt || 0) > OAUTH_STATE_TTL_MS) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "oauth_session_expired",
                errorDescription: "Login session expired. Please try again.",
            });
        }

        if (error) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "google_login_failed",
                errorDescription: errorDescription || error,
            });
        }

        if (!code) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "missing_code",
                errorDescription: "Google login did not return a code. Please try again.",
            });
        }

        const apiPublicUrl = resolveApiPublicUrl(req);
        const callbackUrl = `${apiPublicUrl}/api/v1/auth/oauth/google/callback`;

        // Exchange code for tokens (server-side).
        const tokenBody = new URLSearchParams({
            code,
            client_id: String(GOOGLE_CLIENT_ID || ""),
            client_secret: String(GOOGLE_CLIENT_SECRET || ""),
            redirect_uri: callbackUrl,
            grant_type: "authorization_code",
        });

        let idToken = "";
        try {
            const { data } = await axios.post("https://oauth2.googleapis.com/token", tokenBody.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            idToken = data?.id_token || "";
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "token_exchange_failed",
                errorDescription:
                    err?.response?.data?.error_description || err?.response?.data?.error || "Google token exchange failed",
            });
        }

        let profile;
        try {
            profile = await getGoogleProfile({ credential: idToken });
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "invalid_google_token",
                errorDescription: err?.message || "Google login could not be verified",
            });
        }

        let user;
        try {
            user = await findOrCreateSocialUser(profile);
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "account_sync_failed",
                errorDescription: err?.message || "Could not finish Google login. Please try again.",
            });
        }

        const loginCode = crypto.randomBytes(32).toString("hex");
        const codeHash = sha256Hex(loginCode);
        const ttlMs = toPositiveNumber(process.env.OAUTH_LOGIN_CODE_TTL_MS, 5 * 60 * 1000);

        try {
            await OAuthLoginCode.create({
                user: user._id,
                provider: "google",
                codeHash,
                expiresAt: new Date(Date.now() + ttlMs),
                createdIp: String(req.ip || ""),
                createdUserAgent: String(req.get("user-agent") || ""),
            });
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "google",
                error: "login_persist_failed",
                errorDescription: "Could not complete login. Please try again.",
            });
        }

        return redirectOAuthResult(res, {
            returnTo: ctx.returnTo,
            provider: "google",
            code: loginCode,
        });
    } catch (err) {
        return redirectOAuthResult(res, {
            returnTo: ctx?.returnTo,
            provider: "google",
            error: "oauth_callback_failed",
            errorDescription: "Login failed. Please try again.",
        });
    }
});

const oauthFacebookCallback = asyncHandler(async (req, res) => {
    let ctx = null;
    try {
        const code = String(req.query?.code || "").trim();
        const state = String(req.query?.state || "").trim();
        const error = String(req.query?.error || "").trim();
        const errorReason = String(req.query?.error_reason || "").trim();
        const errorDescription = String(req.query?.error_description || "").trim();

        const signed = req.cookies?.[OAUTH_STATE_COOKIE] || "";
        ctx = verifyOAuthCookie(signed);

        res.clearCookie(OAUTH_STATE_COOKIE, options);

        if (!ctx || ctx.provider !== "facebook") {
            return redirectOAuthResult(res, {
                provider: "facebook",
                error: "oauth_session_expired",
                errorDescription: "Login session expired. Please try again.",
            });
        }

        if (!state || state !== ctx.state) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "oauth_state_mismatch",
                errorDescription: "Login state mismatch. Please try again.",
            });
        }

        if (Date.now() - Number(ctx.createdAt || 0) > OAUTH_STATE_TTL_MS) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "oauth_session_expired",
                errorDescription: "Login session expired. Please try again.",
            });
        }

        if (error) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "facebook_login_failed",
                errorDescription: errorDescription || errorReason || error,
            });
        }

        if (!code) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "missing_code",
                errorDescription: "Facebook login did not return a code. Please try again.",
            });
        }

        const apiPublicUrl = resolveApiPublicUrl(req);
        const callbackUrl = `${apiPublicUrl}/api/v1/auth/oauth/facebook/callback`;

        let accessToken = "";
        try {
            const { data } = await axios.get(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`, {
                params: {
                    client_id: FACEBOOK_APP_ID,
                    client_secret: FACEBOOK_APP_SECRET,
                    redirect_uri: callbackUrl,
                    code,
                },
            });
            accessToken = data?.access_token || "";
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "token_exchange_failed",
                errorDescription: err?.response?.data?.error?.message || "Facebook token exchange failed",
            });
        }

        let profile;
        try {
            profile = await getFacebookProfile({ accessToken });
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "invalid_facebook_token",
                errorDescription: err?.message || "Facebook login could not be verified",
            });
        }

        let user;
        try {
            user = await findOrCreateSocialUser(profile);
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "account_sync_failed",
                errorDescription: err?.message || "Could not finish Facebook login. Please try again.",
            });
        }

        const loginCode = crypto.randomBytes(32).toString("hex");
        const codeHash = sha256Hex(loginCode);
        const ttlMs = toPositiveNumber(process.env.OAUTH_LOGIN_CODE_TTL_MS, 5 * 60 * 1000);

        try {
            await OAuthLoginCode.create({
                user: user._id,
                provider: "facebook",
                codeHash,
                expiresAt: new Date(Date.now() + ttlMs),
                createdIp: String(req.ip || ""),
                createdUserAgent: String(req.get("user-agent") || ""),
            });
        } catch (err) {
            return redirectOAuthResult(res, {
                returnTo: ctx.returnTo,
                provider: "facebook",
                error: "login_persist_failed",
                errorDescription: "Could not complete login. Please try again.",
            });
        }

        return redirectOAuthResult(res, {
            returnTo: ctx.returnTo,
            provider: "facebook",
            code: loginCode,
        });
    } catch (err) {
        return redirectOAuthResult(res, {
            returnTo: ctx?.returnTo,
            provider: "facebook",
            error: "oauth_callback_failed",
            errorDescription: "Login failed. Please try again.",
        });
    }
});

const completeOAuthLogin = asyncHandler(async (req, res) => {
    const code = String(req.body?.code || "").trim();
    if (!code) {
        throw new ApiError(400, "Login code is required");
    }

    const codeHash = sha256Hex(code);

    const loginCode = await OAuthLoginCode.findOne({
        codeHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
    });

    if (!loginCode) {
        throw new ApiError(401, "Login code expired. Please try again.");
    }

    loginCode.usedAt = new Date();
    await loginCode.save({ validateBeforeSave: false });

    const user = await User.findById(loginCode.user);
    if (!user) {
        throw new ApiError(401, "User not found");
    }

    return issueAuthResponse(res, user, `Logged in with ${loginCode.provider} successfully`);
});

const logoutUser = asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "User not authenticated");
    }

    // Remove refresh token from DB
    await User.findByIdAndUpdate(
        user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    // Clear cookies
    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);

    return res.status(200).json(
        new ApiResponse(200, {}, "logged out successfully")
    );
});
const renewTokens = asyncHandler(async (req, res) => {
    const receivedRefreshToken = String(
        req.body?.refreshToken ||
        req.body?.refresh_token ||
        req.cookies?.refreshToken ||
        ""
    ).trim();

    if (!receivedRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // Verify refresh token
        const decodedToken = jwt.verify(receivedRefreshToken, REFRESH_TOKEN_SECRET);

        // Find user
        const user = await User.findById(decodedToken._id);
        if (!user) {
            throw new ApiError(401, "User not found");
        }

        // Validate refresh token
        if (user.refreshToken !== receivedRefreshToken) {
            throw new ApiError(401, "Refresh token expired or already used");
        }

        // Generate a fresh access token without rotating the refresh token.
        // This keeps concurrent browser tabs from invalidating each other.
        const accessToken = user.generateAccessToken();

        // Optional: update last token renewal time
        user.lastTokenRenewed = new Date();
        await user.save({ validateBeforeSave: false });

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", receivedRefreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken: receivedRefreshToken }, "New access token generated successfully")
            );

    } catch (error) {
        res.clearCookie("accessToken", options);
        res.clearCookie("refreshToken", options);

        const message = error?.name === "TokenExpiredError"
            ? "Refresh token expired. Please login again."
            : error?.message || "Invalid refresh token";

        throw new ApiError(401, message);
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const primaryIdentifier = String(req.body?.identifier || "").trim();
    const primaryIsEmail = isValidEmail(primaryIdentifier);
    const primaryDigits = primaryIdentifier.replace(/\D/g, "");
    const primaryIsPhone = !primaryIsEmail && /^\+?\d[\d\s()-]{7,}$/.test(primaryIdentifier) && (primaryDigits.length === 10 || (primaryDigits.length === 12 && primaryDigits.startsWith("91")));
    const identifiers = [
        primaryIdentifier,
        ...(primaryIsEmail ? [req.body?.email] : []),
        ...(primaryIsPhone ? [req.body?.phone_number] : []),
        ...(!primaryIsEmail && !primaryIsPhone ? [req.body?.username] : []),
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
    // console.log(req.body)

    if (identifiers.length === 0) {
        throw new ApiError(400, "Username, email, or phone number is required");
    }

    let user = null;
    for (const identifier of identifiers) {
        user = await findUserByIdentifier(
            identifier,
            "+resetPasswordToken +resetPasswordExpires +resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpAttempts +resetPasswordResendAvailableAt +resetPasswordResendCount +resetPasswordResendWindowStart"
        );
        // console.log("Found user:", user, "for identifier:", identifier);
        if (user) break;
    }

    const now = Date.now();
    const otpExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_OTP_EXPIRY_MS, msFromMinutes(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES, 5));
    const resendCooldownMs = toPositiveNumber(process.env.PASSWORD_RESET_RESEND_COOLDOWN_MS, msFromMinutes(process.env.PASSWORD_RESET_RESEND_COOLDOWN_MINUTES, 5));
    const linkExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_LINK_EXPIRY_MS, msFromDays(process.env.PASSWORD_RESET_LINK_EXPIRY_DAYS, 4));
    const resendWindowMs = toPositiveNumber(process.env.PASSWORD_RESET_RESEND_WINDOW_MS, msFromMinutes(process.env.PASSWORD_RESET_RESEND_WINDOW_MINUTES, 60));
    const maxResendsPerWindow = clampInt(process.env.PASSWORD_RESET_MAX_RESENDS, 1, 25, 5);
    const otpExpiresAt = new Date(now + otpExpiryMs);
    const resendAvailableAt = new Date(now + resendCooldownMs);
    const resetLinkExpiresAt = new Date(now + linkExpiryMs);

    // Public request id for the OTP flow. Do not reveal whether the account exists.
    const requestId = crypto.randomBytes(16).toString("hex");
    const requestIdHash = crypto.createHash("sha256").update(requestId).digest("hex");
    let devOtpCode = "";
    let devResetToken = "";

    if (!user) {
        // User requested behavior: only proceed when an account exists.
        throw new ApiError(404, "Account not found for the provided username/email/phone.");
    }

    if (!user.email || !isValidEmail(user.email)) {
        throw new ApiError(400, "This account does not have a valid email address for password reset.");
    }

    const userResendAvailableAt = user.resetPasswordResendAvailableAt ? new Date(user.resetPasswordResendAvailableAt).getTime() : 0;
    if (userResendAvailableAt && userResendAvailableAt > now) {
        const remainingSeconds = Math.ceil((userResendAvailableAt - now) / 1000);
        throw new ApiError(429, "Please wait before requesting another reset code.", [
            { field: "passwordReset.cooldownRemainingSeconds", message: String(remainingSeconds) },
            { field: "passwordReset.resendAvailableAt", message: new Date(userResendAvailableAt).toISOString() },
        ]);
    }

    const windowStartMs = user.resetPasswordResendWindowStart ? new Date(user.resetPasswordResendWindowStart).getTime() : 0;
    const inWindow = windowStartMs && windowStartMs + resendWindowMs > now;
    const resendCount = inWindow ? Number(user.resetPasswordResendCount || 0) : 0;
    if (resendCount >= maxResendsPerWindow) {
        throw new ApiError(429, "Too many password reset requests. Please try again later.", [
            { field: "passwordReset.maxResends", message: String(maxResendsPerWindow) },
        ]);
    }

    // Generate a long-lived reset link token + a short-lived OTP code.
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    devResetToken = resetToken;

    const otpCode = randomOtpCode();
    const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");
    devOtpCode = otpCode;

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetLinkExpiresAt;
    user.resetPasswordOtpHash = otpHash;
    user.resetPasswordOtpExpires = otpExpiresAt;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordRequestIdHash = requestIdHash;
    user.resetPasswordRequestIdExpires = otpExpiresAt;
    user.resetPasswordGrantHash = undefined;
    user.resetPasswordGrantExpires = undefined;
    user.resetPasswordResendAvailableAt = resendAvailableAt;
    user.resetPasswordResendWindowStart = inWindow ? new Date(windowStartMs) : new Date(now);
    user.resetPasswordResendCount = resendCount + 1;
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        token: resetToken,
        otpCode,
        otpExpiresInMinutes: Math.ceil(otpExpiryMs / 60000),
        linkExpiresInDays: Math.ceil(linkExpiryMs / (24 * 60 * 60 * 1000)),
        requestId: req.requestId,
    });

    const responseData = {
        delivery: "email",
        requestId,
        otpExpiresInSeconds: Math.ceil(otpExpiryMs / 1000),
        otpExpiresAt: otpExpiresAt.toISOString(),
        resendAvailableInSeconds: Math.ceil(resendCooldownMs / 1000),
        resendAvailableAt: resendAvailableAt.toISOString(),
        linkExpiresAt: resetLinkExpiresAt.toISOString(),
        // Only for local development/troubleshooting. Not used by the production UI.
        ...(process.env.NODE_ENV !== "production" && user
            ? {
                debug: {
                    identifiers,
                    otpCode: devOtpCode,
                    resetToken: devResetToken,
                }
            }
            : {}),
    };

    return res.status(200).json(
        new ApiResponse(200, responseData, "Password reset instructions have been sent to your email.")
    );
});

const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
    const requestId = String(req.body?.requestId || "").trim();
    const otp = String(req.body?.otp || "").trim();

    if (!requestId || !otp) {
        throw new ApiError(400, "Reset request id and OTP are required");
    }

    const now = Date.now();
    const requestHash = sha256Hex(requestId);
    const user = await User.findOne({
        resetPasswordRequestIdHash: requestHash,
        resetPasswordRequestIdExpires: { $gt: new Date(now) },
    }).select("+resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpAttempts +resetPasswordRequestIdHash +resetPasswordRequestIdExpires");

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset code");
    }

    const otpExpiresAtMs = user.resetPasswordOtpExpires ? new Date(user.resetPasswordOtpExpires).getTime() : 0;
    if (!otpExpiresAtMs || otpExpiresAtMs <= now) {
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        user.resetPasswordRequestIdHash = undefined;
        user.resetPasswordRequestIdExpires = undefined;
        await user.save({ validateBeforeSave: false });
        throw new ApiError(400, "Reset code has expired. Please request a new one.");
    }

    const maxVerifyAttempts = clampInt(process.env.PASSWORD_RESET_MAX_VERIFY_ATTEMPTS, 1, 20, 5);
    const attempts = Number(user.resetPasswordOtpAttempts || 0);
    if (attempts >= maxVerifyAttempts) {
        throw new ApiError(429, "Too many incorrect attempts. Please request a new reset code.", [
            { field: "passwordReset.maxVerifyAttempts", message: String(maxVerifyAttempts) },
        ]);
    }

    const otpHash = sha256Hex(otp);
    if (!user.resetPasswordOtpHash || otpHash !== user.resetPasswordOtpHash) {
        user.resetPasswordOtpAttempts = attempts + 1;
        await user.save({ validateBeforeSave: false });
        throw new ApiError(400, "Invalid reset code", [
            { field: "passwordReset.attemptsRemaining", message: String(Math.max(0, maxVerifyAttempts - (attempts + 1))) },
            { field: "passwordReset.otpExpiresInSeconds", message: String(Math.max(0, Math.ceil((otpExpiresAtMs - now) / 1000))) },
        ]);
    }

    const grantExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_GRANT_EXPIRY_MS, msFromMinutes(process.env.PASSWORD_RESET_GRANT_EXPIRY_MINUTES, 15));
    const resetGrant = crypto.randomBytes(32).toString("hex");
    const resetGrantHash = sha256Hex(resetGrant);

    user.resetPasswordGrantHash = resetGrantHash;
    user.resetPasswordGrantExpires = new Date(now + grantExpiryMs);

    // OTP is single-use. Clear OTP + request id after successful verification.
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordRequestIdHash = undefined;
    user.resetPasswordRequestIdExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { resetGrant, expiresAt: new Date(now + grantExpiryMs).toISOString() }, "OTP verified")
    );
});

const resendForgotPasswordOtp = asyncHandler(async (req, res) => {
    const requestId = String(req.body?.requestId || "").trim();
    if (!requestId) throw new ApiError(400, "Reset request id is required");

    const now = Date.now();
    const requestHash = sha256Hex(requestId);
    const user = await User.findOne({
        resetPasswordRequestIdHash: requestHash,
        resetPasswordRequestIdExpires: { $gt: new Date(now) },
    }).select("+resetPasswordResendAvailableAt +resetPasswordResendCount +resetPasswordResendWindowStart +resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpAttempts +resetPasswordRequestIdHash +resetPasswordRequestIdExpires");

    // Don't reveal if the request id is unknown. Return generic response.
    const otpExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_OTP_EXPIRY_MS, msFromMinutes(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES, 5));
    const resendCooldownMs = toPositiveNumber(process.env.PASSWORD_RESET_RESEND_COOLDOWN_MS, msFromMinutes(process.env.PASSWORD_RESET_RESEND_COOLDOWN_MINUTES, 5));
    const resendWindowMs = toPositiveNumber(process.env.PASSWORD_RESET_RESEND_WINDOW_MS, msFromMinutes(process.env.PASSWORD_RESET_RESEND_WINDOW_MINUTES, 60));
    const maxResendsPerWindow = clampInt(process.env.PASSWORD_RESET_MAX_RESENDS, 1, 25, 5);

    if (!user) {
        return res.status(200).json(
            new ApiResponse(200, {
                otpExpiresInSeconds: Math.ceil(otpExpiryMs / 1000),
                otpExpiresAt: new Date(now + otpExpiryMs).toISOString(),
                resendAvailableInSeconds: Math.ceil(resendCooldownMs / 1000),
                resendAvailableAt: new Date(now + resendCooldownMs).toISOString(),
            }, "If the account exists, we sent password reset instructions to its email.")
        );
    }

    const userResendAvailableAt = user.resetPasswordResendAvailableAt ? new Date(user.resetPasswordResendAvailableAt).getTime() : 0;
    if (userResendAvailableAt && userResendAvailableAt > now) {
        const remainingSeconds = Math.ceil((userResendAvailableAt - now) / 1000);
        throw new ApiError(429, "Please wait before requesting another reset code.", [
            { field: "passwordReset.cooldownRemainingSeconds", message: String(remainingSeconds) },
            { field: "passwordReset.resendAvailableAt", message: new Date(userResendAvailableAt).toISOString() },
        ]);
    }

    const windowStartMs = user.resetPasswordResendWindowStart ? new Date(user.resetPasswordResendWindowStart).getTime() : 0;
    const inWindow = windowStartMs && windowStartMs + resendWindowMs > now;
    const resendCount = inWindow ? Number(user.resetPasswordResendCount || 0) : 0;
    if (resendCount >= maxResendsPerWindow) {
        throw new ApiError(429, "Too many password reset requests. Please try again later.", [
            { field: "passwordReset.maxResends", message: String(maxResendsPerWindow) },
        ]);
    }

    const otpCode = randomOtpCode();
    user.resetPasswordOtpHash = sha256Hex(otpCode);
    user.resetPasswordOtpExpires = new Date(now + otpExpiryMs);
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordResendAvailableAt = new Date(now + resendCooldownMs);
    user.resetPasswordResendWindowStart = inWindow ? new Date(windowStartMs) : new Date(now);
    user.resetPasswordResendCount = resendCount + 1;
    await user.save({ validateBeforeSave: false });

    if (user.email && isValidEmail(user.email)) {
        // Rotate reset link token when resending.
        const linkExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_LINK_EXPIRY_MS, msFromDays(process.env.PASSWORD_RESET_LINK_EXPIRY_DAYS, 4));
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = sha256Hex(resetToken);
        user.resetPasswordExpires = new Date(now + linkExpiryMs);
        await user.save({ validateBeforeSave: false });

        await sendPasswordResetEmail({
            to: user.email,
            username: user.username,
            token: resetToken,
            otpCode,
            otpExpiresInMinutes: Math.ceil(otpExpiryMs / 60000),
            linkExpiresInDays: Math.ceil(linkExpiryMs / (24 * 60 * 60 * 1000)),
            requestId: req.requestId,
        });
    }

    return res.status(200).json(
        new ApiResponse(200, {
            otpExpiresInSeconds: Math.ceil(otpExpiryMs / 1000),
            otpExpiresAt: new Date(now + otpExpiryMs).toISOString(),
            resendAvailableInSeconds: Math.ceil(resendCooldownMs / 1000),
            resendAvailableAt: new Date(now + resendCooldownMs).toISOString(),
            ...(process.env.NODE_ENV !== "production" ? { debug: { otpCode } } : {}),
        }, "Reset code sent")
    );
});

const prepareForgotPasswordResetFromLink = asyncHandler(async (req, res) => {
    const token = String(req.body?.token || req.params?.token || "").trim();
    if (!token) throw new ApiError(400, "Reset token is required");

    const now = Date.now();
    const tokenHash = sha256Hex(token);
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date(now) },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
        throw new ApiError(400, "Reset link is invalid or expired");
    }

    const grantExpiryMs = toPositiveNumber(process.env.PASSWORD_RESET_GRANT_EXPIRY_MS, msFromMinutes(process.env.PASSWORD_RESET_GRANT_EXPIRY_MINUTES, 15));
    const resetGrant = crypto.randomBytes(32).toString("hex");

    user.resetPasswordGrantHash = sha256Hex(resetGrant);
    user.resetPasswordGrantExpires = new Date(now + grantExpiryMs);

    // One-time link: convert it into a short-lived grant.
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordRequestIdHash = undefined;
    user.resetPasswordRequestIdExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { resetGrant, expiresAt: new Date(now + grantExpiryMs).toISOString() }, "Reset link verified")
    );
});

const completeForgotPasswordReset = asyncHandler(async (req, res) => {
    const resetGrant = String(req.body?.resetGrant || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();
    if (!resetGrant || !newPassword) {
        throw new ApiError(400, "Reset grant and new password are required");
    }

    const now = Date.now();
    const grantHash = sha256Hex(resetGrant);
    const user = await User.findOne({
        resetPasswordGrantHash: grantHash,
        resetPasswordGrantExpires: { $gt: new Date(now) },
    }).select("+resetPasswordGrantHash +resetPasswordGrantExpires");

    if (!user) {
        throw new ApiError(400, "Reset session expired. Please restart the reset flow.");
    }

    user.password = newPassword;
    user.passwordLoginEnabled = true;
    user.resetPasswordGrantHash = undefined;
    user.resetPasswordGrantExpires = undefined;
    user.resetPasswordResendAvailableAt = undefined;
    user.resetPasswordResendCount = 0;
    user.resetPasswordResendWindowStart = undefined;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully")
    );
});
const resetPassword = asyncHandler(async (req, res) => {
    const token = req.params.token || req.body?.token;
    const { newPassword, otp } = req.body;

    if (!token || !newPassword || newPassword.trim() === '') {
        throw new ApiError(400, "Token and new password are required");
    }

    if (!otp || String(otp).trim() === "") {
        throw new ApiError(400, "Reset code (OTP) is required");
    }

    const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: Date.now() } // token not expired
    }).select("+resetPasswordToken +resetPasswordExpires +resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpAttempts");

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }

    const now = Date.now();
    const maxVerifyAttempts = clampInt(process.env.PASSWORD_RESET_MAX_VERIFY_ATTEMPTS, 1, 20, 5);

    const otpExpiresAtMs = user.resetPasswordOtpExpires ? new Date(user.resetPasswordOtpExpires).getTime() : 0;
    if (!otpExpiresAtMs || otpExpiresAtMs <= now) {
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        await user.save({ validateBeforeSave: false });
        throw new ApiError(400, "Reset code has expired. Please request a new one.");
    }

    const attempts = Number(user.resetPasswordOtpAttempts || 0);
    if (attempts >= maxVerifyAttempts) {
        throw new ApiError(429, "Too many incorrect reset code attempts. Please request a new code.", [
            { field: "passwordReset.maxVerifyAttempts", message: String(maxVerifyAttempts) },
        ]);
    }

    const otpHash = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
    if (!user.resetPasswordOtpHash || otpHash !== user.resetPasswordOtpHash) {
        user.resetPasswordOtpAttempts = attempts + 1;
        await user.save({ validateBeforeSave: false });
        throw new ApiError(400, "Invalid reset code", [
            { field: "passwordReset.attemptsRemaining", message: String(Math.max(0, maxVerifyAttempts - (attempts + 1))) },
            { field: "passwordReset.otpExpiresInSeconds", message: String(Math.max(0, Math.ceil((otpExpiresAtMs - now) / 1000))) },
        ]);
    }

    user.password = newPassword;
    user.passwordLoginEnabled = true;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordResendAvailableAt = undefined;
    user.resetPasswordResendCount = 0;
    user.resetPasswordResendWindowStart = undefined;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully")
    );
});

const changePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("password passwordLoginEnabled socialProvider phone_number");
    if (!user) throw new ApiError(404, "User not found");
    const { currentPassword, newPassword } = req.body;
    const isSettingSocialPassword = Boolean(user.socialProvider) && user.passwordLoginEnabled !== true;

    if (!newPassword || newPassword.trim() === '') {
        throw new ApiError(400, isSettingSocialPassword ? "New password is required" : "Current and new password are required");
    }

    if (isSettingSocialPassword && !user.phone_number) {
        throw new ApiError(400, "Add a phone number before setting password login");
    }

    if (!isSettingSocialPassword && !currentPassword) {
        throw new ApiError(400, "Current and new password are required");
    }

    if (!isSettingSocialPassword) {
        const isCorrect = await user.isPasswordCorrect(currentPassword);
        if (!isCorrect) {
            throw new ApiError(400, "Incorrect current password");
        }
    }

    // Update password
    user.password = newPassword;
    user.passwordLoginEnabled = true;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, isSettingSocialPassword ? "Password login enabled successfully" : "Password changed successfully")
    );
});

//profile Management________________________________________________________________________________________________

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password -refreshToken -accessToken");
    if (!user) throw new ApiError(404, "User not found");

    if (isProviderPhoneNumber(user.phone_number)) {
        user.set("phone_number", undefined);
        await user.save({ validateBeforeSave: false });
    }

    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(user) }, "User fetched successfully")
    );
})

const getUserById = asyncHandler(async (req, res) => {
    const userId = req.params.id || req.params.userId || req.user?._id;

    if (!userId) {
        throw new ApiError(400, "User ID not found in request");
    }

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found or invalid userId");
    }

    return res.status(200).json(
        new ApiResponse(200, sanitizeUserForResponse(user), "User fetched successfully")
    );
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, "User not found");
    const { username, email, phone_number, gamename, gameid, dateOfBirth, gender } = req.body;
    // console.log(username, gamename, gameid, dateOfBirth, gender, password)
    const isSocialUser = Boolean(user.socialProvider);
    const wantsPhoneUpdate = Object.prototype.hasOwnProperty.call(req.body, "phone_number");
    const wantsEmailUpdate = Object.prototype.hasOwnProperty.call(req.body, "email");
    const nextPhoneNumber = wantsPhoneUpdate ? normalizePhoneNumber(phone_number) : undefined;
    const nextEmail = wantsEmailUpdate ? normalizeEmail(email) : undefined;
    const currentPhoneNumber = isProviderPhoneNumber(user.phone_number) ? "" : normalizePhoneNumber(user.phone_number);
    const currentEmail = normalizeEmail(user.email);
    const phoneChanged = wantsPhoneUpdate && nextPhoneNumber !== currentPhoneNumber;
    const emailChanged = wantsEmailUpdate && nextEmail !== currentEmail;
    const usernameChanged = Boolean(username?.trim()) && username.trim() !== user.username;
    const gamenameChanged = Boolean(gamename?.trim()) && gamename.trim() !== user.gamename;
    const gameidChanged = Boolean(gameid?.trim()) && gameid.trim() !== user.gameid;
    const nextDateOfBirth = toDateInputString(dateOfBirth);
    if (dateOfBirth?.trim() && !nextDateOfBirth) {
        throw new ApiError(400, "Invalid date of birth");
    }
    const dateOfBirthChanged = Boolean(dateOfBirth?.trim()) && nextDateOfBirth !== toDateInputString(user.dateOfBirth);
    const genderChanged = Boolean(gender?.trim()) && gender.trim() !== user.gender;
    const wantsOtherUpdate = usernameChanged || emailChanged || gamenameChanged || gameidChanged || dateOfBirthChanged || genderChanged;
    const hasAnyUpdate = phoneChanged || wantsOtherUpdate;

    if (wantsEmailUpdate && !nextEmail) {
        throw new ApiError(400, "Email is required");
    }

    if (wantsPhoneUpdate && !nextPhoneNumber) {
        throw new ApiError(400, "Phone number is required");
    }

    if (!wantsEmailUpdate && !currentEmail) {
        throw new ApiError(400, "Email is required");
    }

    if (!wantsPhoneUpdate && !currentPhoneNumber) {
        throw new ApiError(400, "Phone number is required");
    }

    if (emailChanged && nextEmail && !isValidEmail(nextEmail)) {
        throw new ApiError(400, "Invalid email address");
    }

    // Build update object dynamically
    const updates = {};

    if (usernameChanged) {
        const existingUser = await User.findOne({ username: username.trim() });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Username already exists, choose another one");
        }
        updates.username = username.trim();
    }

    if (phoneChanged) {
        const existingPhoneUser = await User.findOne({ phone_number: nextPhoneNumber });
        if (existingPhoneUser && existingPhoneUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Phone number already exists");
        }
        updates.phone_number = nextPhoneNumber;
        updates.phoneVerified = false;
    }

    if (emailChanged) {
        const existingEmailUser = await User.findOne({ email: nextEmail });
        if (existingEmailUser && existingEmailUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Email already exists");
        }
        updates.email = nextEmail;
        updates.emailVerified = false;
    }

    if (gamenameChanged) updates.gamename = gamename.trim();
    if (gameidChanged) updates.gameid = gameid.trim();
    if (dateOfBirthChanged) updates.dateOfBirth = new Date(dateOfBirth);
    if (genderChanged) updates.gender = gender.trim();

    // Update user in DB
    const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
            ...updates,
            ...(phoneChanged || emailChanged ? {
                linkedProviders: [
                    ...(user.linkedProviders || []).filter((link) => !(
                        (phoneChanged && link.provider === "phone") ||
                        (emailChanged && link.provider === "email")
                    )),
                    ...(phoneChanged && nextPhoneNumber ? [{ provider: "phone", providerId: nextPhoneNumber, verified: false }] : []),
                    ...(emailChanged && nextEmail ? [{ provider: "email", providerId: nextEmail, verified: false }] : []),
                ]
            } : {})
        },
        { new: true, runValidators: true }
    ).select("-password -refreshToken -accessToken");

    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "User profile updated successfully")
    );
});

const completeUserOnboarding = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, "User not found");

    const { phone_number, username, dateOfBirth, agreements } = req.body || {};
    const normalizedPhone = normalizePhoneNumber(phone_number);
    const nextDateOfBirth = toDateInputString(dateOfBirth);

    if (!normalizedPhone) throw new ApiError(400, "Phone number is required");
    if (!isValidIndianPhoneNumber(normalizedPhone)) {
        throw new ApiError(400, "Enter a valid 10 digit Indian phone number");
    }
    if (!nextDateOfBirth) throw new ApiError(400, "Date of birth is required");

    const dobDate = new Date(nextDateOfBirth);
    if (Number.isNaN(dobDate.getTime())) throw new ApiError(400, "Invalid date of birth");
    const age = getAgeYears(dobDate);
    if (age > 120) throw new ApiError(400, "Invalid date of birth");

    if (age < 13) {
        throw new ApiError(
            403,
            "Battle4Arena is for players aged 13+. You can't create or use an account right now. If this is a mistake, contact support."
        );
    }

    const acceptedTerms = Boolean(agreements?.terms);
    const acceptedPrivacy = Boolean(agreements?.privacy);
    const acceptedCommunity = Boolean(agreements?.community);
    if (!acceptedTerms || !acceptedPrivacy || !acceptedCommunity) {
        throw new ApiError(400, "You must agree to the Terms, Privacy Policy, and Community Guidelines");
    }

    // Optional username customization
    const wantsUsernameUpdate = Boolean(username?.trim()) && username.trim() !== user.username;
    if (wantsUsernameUpdate) {
        const nextUsername = String(username).trim();
        if (!/^[a-zA-Z0-9_]{4,30}$/.test(nextUsername)) {
            throw new ApiError(400, "Username must be 4-30 letters, numbers, or underscores");
        }
        const existingUser = await User.findOne({ username: nextUsername });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Username already exists, choose another one");
        }
        user.username = nextUsername;
    }

    // Phone uniqueness
    const currentPhone = isProviderPhoneNumber(user.phone_number) ? "" : normalizePhoneNumber(user.phone_number);
    if (normalizedPhone !== currentPhone) {
        const existingPhoneUser = await User.findOne({ phone_number: normalizedPhone });
        if (existingPhoneUser && existingPhoneUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Phone number already exists");
        }
        user.phone_number = normalizedPhone;
        user.phoneVerified = false;
        user.linkedProviders = [
            ...(user.linkedProviders || []).filter((link) => link.provider !== "phone"),
            { provider: "phone", providerId: normalizedPhone, verified: false },
        ];
    }

    // Date of birth
    user.dateOfBirth = dobDate;

    const now = new Date();
    const version = String(req.body?.agreementsVersion || "2026-05-19").trim();
    user.legalAgreements = {
        acceptedAt: now,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        communityAcceptedAt: now,
        version,
    };
    user.onboarding = {
        completedAt: now,
        source: user.socialProvider || "unknown",
        ageBand: age < 18 ? "teen" : "adult",
    };

    await user.save();

    const updatedUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "Onboarding completed successfully")
    );
});

const verifyProfileEmail = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+emailVerificationToken +emailVerificationExpires");
    if (!user) throw new ApiError(404, "User not found");
    if (!user.email || !isValidEmail(user.email)) {
        throw new ApiError(400, "Add a valid email before verification");
    }

    if (user.emailVerified) {
        const currentUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
        return res.status(200).json(
            new ApiResponse(200, { user: await buildUserProfileResponse(currentUser) }, "Email is already verified")
        );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresInMinutes = 30;

    user.emailVerificationToken = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendEmailVerification({
        to: user.email,
        username: user.username,
        token: rawToken,
        expiresInMinutes,
        requestId: req.requestId,
    });

    const updatedUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "Verification email sent")
    );
});

const confirmEmailVerification = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token || String(token).trim() === "") {
        throw new ApiError(400, "Verification token is required");
    }

    const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");
    const user = await User.findOne({
        emailVerificationToken: tokenHash,
        emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
        throw new ApiError(400, "Verification link is invalid or expired");
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.linkedProviders = [
        ...(user.linkedProviders || []).filter((link) => link.provider !== "email"),
        { provider: "email", providerId: normalizeEmail(user.email), verified: true },
    ];
    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "Email verified successfully")
    );
});

const verifyProfilePhone = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+phoneVerificationToken +phoneVerificationExpires");
    if (!user) throw new ApiError(404, "User not found");

    const phoneNumber = normalizePhoneNumber(user.phone_number);
    if (!phoneNumber) {
        throw new ApiError(400, "Add a phone number before verification");
    }

    if (!user.email || !isValidEmail(user.email)) {
        throw new ApiError(400, "Add a valid email before phone verification");
    }

    if (user.phoneVerified) {
        const currentUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
        return res.status(200).json(
            new ApiResponse(200, { user: await buildUserProfileResponse(currentUser) }, "Phone is already verified")
        );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresInMinutes = 30;

    user.phoneVerificationToken = tokenHash;
    user.phoneVerificationExpires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendPhoneVerificationEmail({
        to: user.email,
        username: user.username,
        phoneNumber,
        token: rawToken,
        expiresInMinutes,
        requestId: req.requestId,
    });

    const updatedUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "Phone verification email sent")
    );
});

const confirmPhoneVerification = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token || String(token).trim() === "") {
        throw new ApiError(400, "Verification token is required");
    }

    const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");
    const user = await User.findOne({
        phoneVerificationToken: tokenHash,
        phoneVerificationExpires: { $gt: new Date() },
    }).select("+phoneVerificationToken +phoneVerificationExpires");

    if (!user) {
        throw new ApiError(400, "Verification link is invalid or expired");
    }

    const phoneNumber = normalizePhoneNumber(user.phone_number);
    if (!phoneNumber) {
        throw new ApiError(400, "Phone number is missing");
    }

    user.phoneVerified = true;
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    user.linkedProviders = [
        ...(user.linkedProviders || []).filter((link) => link.provider !== "phone"),
        { provider: "phone", providerId: phoneNumber, verified: true },
    ];
    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).select("-password -refreshToken -accessToken");
    return res.status(200).json(
        new ApiResponse(200, { user: await buildUserProfileResponse(updatedUser) }, "Phone verified successfully")
    );
});
const becomeCreator = asyncHandler(async (req, res) => {
    const user = req.user;
    const roles = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean);

    if (roles.includes("creator")) {
        const updatedUser = await User.findById(user._id).select("-password -refreshToken");
        return res.status(200).json(
            new ApiResponse(200, { user: updatedUser }, "Creator access is already approved")
        );
    }

    if (user.creatorRequest?.status !== "pending") {
        user.creatorRequest = {
            status: "pending",
            requestedAt: new Date(),
            reviewedAt: null,
            reviewedBy: null,
            note: "",
        };
        await user.save({ validateBeforeSave: false });
    }

    const updatedUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "Creator request sent to admin")
    );
});

const leaveCreator = asyncHandler(async (req, res) => {
    const user = req.user;
    const activeTournament = await Tournament.exists({
        organizer: user._id,
        status: { $in: ["draft", "open", "running"] }
    });

    if (activeTournament) {
        throw new ApiError(400, "Complete, cancel, or delete your active tournaments before leaving creator mode");
    }

    const roles = (Array.isArray(user.role) ? user.role : [user.role].filter(Boolean))
        .filter((role) => role !== "creator");
    user.role = roles.length > 0 ? roles : ["user"];
    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "Creator mode disabled")
    );
});
const uploadAvatar = asyncHandler(async (req, res) => {

})
const deleteUser = asyncHandler(async (req, res) => {
    const user = req.user;
    const { password } = req.body;
    const requestedUserId = req.params.id;

    // Validate password
    if (!requestedUserId && (!password || password.trim() === '')) {
        throw new ApiError(400, 'Password is required to delete account');
    }

    // Verify password
    if (!requestedUserId) {
        const passwordUser = await User.findById(user._id).select("password");
        const isCorrect = passwordUser ? await passwordUser.isPasswordCorrect(password) : false;
        if (!isCorrect) {
            throw new ApiError(400, 'Incorrect password');
        }
    }

    if (requestedUserId && !hasRole(user, "admin")) {
        throw new ApiError(403, "Admin access only");
    }

    const targetUserId = requestedUserId || user._id;
    const deletedUser = await User.findByIdAndDelete(targetUserId);

    if (!deletedUser) {
        throw new ApiError(404, "User not found");
    }

    if (targetUserId.toString() === user._id.toString()) {
        res.clearCookie('accessToken', options);
        res.clearCookie('refreshToken', options);
    }

    return res.status(200).json(
        new ApiResponse(200, {}, 'Account deleted successfully')
    );
});

//wallet & transactions_____________________________________________________________________________________________

const CREATOR_CREDIT_CATEGORIES = ["ORGANIZER_EARNING", "TRANSFER"];
const CREATOR_DEBIT_CATEGORIES = ["TRANSFER"];

const getCreatorTransactionMatch = (userId, extra = {}) => ({
    user: userId,
    status: "SUCCESS",
    ...extra,
    $or: [
        { type: "CREDIT", category: { $in: CREATOR_CREDIT_CATEGORIES } },
        { type: "DEBIT", category: { $in: CREATOR_DEBIT_CATEGORIES } }
    ]
});

const getCreatorEarningsTotals = async (userId, extraMatch = {}) => {
    const totals = await WalletTransaction.aggregate([
        { $match: getCreatorTransactionMatch(userId, extraMatch) },
        {
            $group: {
                _id: null,
                credits: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0]
                    }
                },
                debits: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                credits: 1,
                debits: 1,
                total: { $subtract: ["$credits", "$debits"] }
            }
        }
    ]);

    return {
        credits: Number(totals[0]?.credits || 0),
        debits: Number(totals[0]?.debits || 0),
        total: Number(totals[0]?.total || 0),
    };
};

const getWalletBalance = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({
        user: req.user._id
    }).select("balance").lean();
    
    const balance = wallet?.balance || 0;

    return res.status(200).json(
        new ApiResponse(200, { balance }, "Wallet balance fetched successfully")
    );
});

const getWalletTransaction = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { limit = 20, page, skip = 0, type, filter, view = "all" } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const safeSkip = page ? (safePage - 1) * safeLimit : Math.max(Number(skip) || 0, 0);

    const query = { user: userId };
    if (type && ['credit', 'debit'].includes(type)) {
        query.type = type.toUpperCase();
    }
    if (filter === "creator") {
        query.status = "SUCCESS";
        query.$or = [
            { type: "CREDIT", category: { $in: CREATOR_CREDIT_CATEGORIES } },
            { type: "DEBIT", category: { $in: CREATOR_DEBIT_CATEGORIES } }
        ];
    }
    if (filter === "player") {
        query.$nor = [
            { type: "CREDIT", category: { $in: CREATOR_CREDIT_CATEGORIES } },
            { type: "DEBIT", category: { $in: CREATOR_DEBIT_CATEGORIES } }
        ];
    }

    await expireStaleRazorpayPayments({ user: userId });

    const [transactions, walletTotal, walletAggregations] = await Promise.all([
        WalletTransaction.find(query)
        .populate("fromUser", "username phone_number avatar role")
        .populate("toUser", "username phone_number avatar role")
        .sort({ createdAt: -1 })
            .skip(safeSkip)
            .limit(safeLimit)
            .lean(),
        WalletTransaction.countDocuments(query),
        WalletTransaction.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { type: "$type", category: "$category", status: "$status" },
                    count: { $sum: 1 },
                    amount: { $sum: "$amount" },
                    platformFee: { $sum: { $ifNull: ["$platformFee", 0] } }
                }
            },
            { $sort: { count: -1 } }
        ])
    ]);

    if (filter === "creator") {
        return res.status(200).json(
            new ApiResponse(200, {
                transactions,
                walletTransactions: transactions,
                paymentTransactions: [],
                total: walletTotal,
                page: page ? safePage : Math.floor(safeSkip / safeLimit) + 1,
                limit: safeLimit,
                pages: Math.ceil(walletTotal / safeLimit),
                hasMore: safeSkip + transactions.length < walletTotal,
                aggregations: { wallet: walletAggregations, payments: [] }
            }, "Wallet transactions fetched successfully")
        );
    }

    const paymentQuery = { user: userId };
    const [payments, paymentTotal, paymentAggregations] = await Promise.all([
        Payment.find(paymentQuery)
        .sort({ createdAt: -1 })
            .skip(safeSkip)
            .limit(safeLimit)
            .lean(),
        Payment.countDocuments(paymentQuery),
        Payment.aggregate([
            { $match: paymentQuery },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { count: -1 } }
        ])
    ]);

    const paymentTransactions = payments.map((payment) => ({
        _id: payment._id,
        kind: "PAYMENT",
        type: "CREDIT",
        category: "PAYMENT",
        amount: payment.amount,
        status: String(payment.status || "initiated").toUpperCase(),
        provider: payment.provider,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        meta: payment.meta,
    }));

    const mergedTransactions = [...transactions, ...paymentTransactions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, safeLimit);

    const selectedTotal = view === "payments" ? paymentTotal : view === "wallet" ? walletTotal : walletTotal + paymentTotal;
    const selectedCount = view === "payments" ? paymentTransactions.length : view === "wallet" ? transactions.length : mergedTransactions.length;

    return res.status(200).json(
        new ApiResponse(200, {
            transactions: view === "payments" ? paymentTransactions : view === "wallet" ? transactions : mergedTransactions,
            walletTransactions: transactions,
            paymentTransactions,
            total: selectedTotal,
            page: page ? safePage : Math.floor(safeSkip / safeLimit) + 1,
            limit: safeLimit,
            pages: Math.ceil(selectedTotal / safeLimit),
            hasMore: safeSkip + selectedCount < selectedTotal,
            aggregations: {
                wallet: walletAggregations,
                payments: paymentAggregations,
            }
        }, "Wallet transactions fetched successfully")
    );
});
const getTransactionDetails = asyncHandler(async (req, res) => {
    const transactionId = req.params.id

    const transaction = await WalletTransaction.findById(transactionId)
        .populate("fromUser", "username phone_number avatar role")
        .populate("toUser", "username phone_number avatar role")
        .lean();

    return res.status(200).json(
        new ApiResponse(200, transaction, "Wallet transactions fetched successfully")
    );
});

const getCreatorEarnings = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [allTimeTotals, monthlyTotals] = await Promise.all([
        getCreatorEarningsTotals(userId),
        getCreatorEarningsTotals(userId, { createdAt: { $gte: startOfMonth } })
    ]);

    const total = allTimeTotals.total;
    const monthTotal = monthlyTotals.total;
    const monthlyChange = total !== 0 ? Math.round((monthTotal / Math.abs(total)) * 100) : 0;

    return res.status(200).json(
        new ApiResponse(200, {
            total,
            monthlyChange,
            received: allTimeTotals.credits,
            deducted: allTimeTotals.debits,
            monthlyReceived: monthlyTotals.credits,
            monthlyDeducted: monthlyTotals.debits,
        }, "Creator earnings fetched successfully")
    );
});

const getPaymentDetails = asyncHandler(async (req, res) => {
    const paymentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        throw new ApiError(400, "Invalid payment ID");
    }

    await expireStaleRazorpayPayments({ user: req.user._id });

    const payment = await Payment.findOne({
        _id: paymentId,
        user: req.user._id,
    }).lean();

    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    return res.status(200).json(
        new ApiResponse(200, payment, "Payment details fetched successfully")
    );
});

const getPlayerEarnings = asyncHandler(async (req, res) => {
    const stats = await getPlayerStats(req.user._id);

    return res.status(200).json(
        new ApiResponse(200, {
            total: stats.playerEarnings,
            monthlyChange: stats.playerMonthlyChange,
        }, "Player earnings fetched successfully")
    );
});

//notification______________________________________________________________________________________________________

const getUserNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { limit = 20, skip = 0, unreadOnly = false } = req.query;

    const query = { user: userId };
    if (unreadOnly === 'true' || unreadOnly === true) query.read = false;

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

    return res.status(200).json(
        new ApiResponse(200, notifications, "Notifications fetched successfully")
    );
});
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { notificationId } = req.params;

    if (!notificationId) throw new ApiError(400, "Notification ID is required");

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { read: true },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    return res.status(200).json(
        new ApiResponse(200, notification, "Notification marked as read")
    );
});
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const result = await Notification.updateMany(
        { user: userId, read: false },
        { $set: { read: true } }
    );

    return res.status(200).json(
        new ApiResponse(200, { modifiedCount: result.modifiedCount }, "All notifications marked as read")
    );
});

const getNotificationPushConfig = asyncHandler(async (req, res) => {
    const publicKey = getPushPublicKey();

    return res.status(200).json(
        new ApiResponse(200, {
            enabled: Boolean(publicKey),
            publicKey,
        }, publicKey ? "Push notifications are available" : "Push notifications are not configured")
    );
});

const savePushSubscription = asyncHandler(async (req, res) => {
    const { subscription, platform = "web" } = req.body;
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys || {};

    if (!endpoint || !keys.p256dh || !keys.auth) {
        throw new ApiError(400, "Valid push subscription is required");
    }

    const saved = await PushSubscription.findOneAndUpdate(
        { endpoint },
        {
            $set: {
                user: req.user._id,
                endpoint,
                keys: {
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                },
                platform: ["web", "android", "ios"].includes(platform) ? platform : "unknown",
                userAgent: req.headers["user-agent"] || "",
                enabled: true,
                lastSeenAt: new Date(),
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(
        new ApiResponse(200, { subscribed: true, subscriptionId: saved._id }, "Push notifications enabled")
    );
});

const deletePushSubscription = asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint;
    const query = endpoint ? { user: req.user._id, endpoint } : { user: req.user._id };
    const result = await PushSubscription.deleteMany(query);

    return res.status(200).json(
        new ApiResponse(200, { deletedCount: result.deletedCount }, "Push notifications disabled")
    );
});

const deleteNotification = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { notificationId } = req.params;

    if (!notificationId) throw new ApiError(400, "Notification ID is required");

    const deleted = await Notification.findOneAndDelete({
        _id: notificationId,
        user: userId
    });

    if (!deleted) {
        throw new ApiError(404, "Notification not found");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Notification deleted successfully")
    );
});

//Admin-only (options)______________________________________________________________________________________________

const getAllUsers = asyncHandler(async (req, res) => {
    const { limit = 50, skip = 0, role, search } = req.query;

    const query = {};

    // Filter by role
    if (role) {
        query.role = role;
    }

    // Search by username, email, or phone_number
    if (search && search.trim() !== "") {
        const searchText = String(search).trim();
        const searchPattern = escapeRegex(searchText);
        query.$or = [
            { username: { $regex: searchPattern, $options: "i" } },
            { email: { $regex: searchPattern, $options: "i" } },
            { phone_number: { $regex: searchPattern, $options: "i" } }
        ];
    }

    const users = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .select("-password -refreshToken");

    const total = await User.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { users, total }, "Users fetched successfully")
    );
});
const banUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) throw new ApiError(400, "User ID is required");

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: { role: ['banned'], isActive: false } },
        { new: true }
    ).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User has been banned successfully")
    );
});
const unbanUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) throw new ApiError(400, "User ID is required");

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Restore default role
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { role: ['user'], isActive: true } },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User has been unbanned successfully")
    );
});
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Find user
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");

    // Fields allowed to update
    const allowedFields = ["username", "phone_number", "role", "isActive"];
    Object.keys(req.body).forEach((key) => {
        if (allowedFields.includes(key)) {
            user[key] = req.body[key];
        }
    });

    const updatedUser = await user.save();

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User updated successfully")
    );
});


export {
    registerUser,
    loginUser,
    loginWithGoogle,
    loginWithFacebook,
    startOAuthLogin,
    oauthGoogleCallback,
    oauthFacebookCallback,
    completeOAuthLogin,
    logoutUser,
    renewTokens,
    forgotPassword,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,
    prepareForgotPasswordResetFromLink,
    completeForgotPasswordReset,
    resetPassword,
    changePassword,
    getUserProfile,
    getUserById,
    updateUserProfile,
    completeUserOnboarding,
    verifyProfileEmail,
    confirmEmailVerification,
    verifyProfilePhone,
    confirmPhoneVerification,
    becomeCreator,
    leaveCreator,
    uploadAvatar,
    deleteUser,
    updateUser,
    getWalletBalance,
    getWalletTransaction,
    getTransactionDetails,
    getPaymentDetails,
    getCreatorEarnings,
    getPlayerEarnings,
    getUserNotifications,
    getNotificationPushConfig,
    savePushSubscription,
    deletePushSubscription,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getAllUsers,
    banUser,
    unbanUser
}
