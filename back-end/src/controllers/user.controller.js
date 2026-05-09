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
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_GRAPH_VERSION,
    GOOGLE_CLIENT_ID,
    REFRESH_TOKEN_SECRET
} from '../../env.js'
import { expireStaleRazorpayPayments } from '../services/paymentExpiry.service.js'
import { sendEmailVerification, sendPasswordResetEmail, sendPhoneVerificationEmail } from '../services/auth.service.js'
import { getPushPublicKey } from '../services/notification.service.js'

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

    // 🔁 EXISTING USER FLOW
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

    // 🆕 NEW USER FLOW (WITH TRANSACTION)
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
        user = await findUserByIdentifier(identifier);
        // console.log("Found user:", user, "for identifier:", identifier);
        if (user) break;
    }

    if (!user) {
        throw new ApiError(
            404,
            "User not found",
            process.env.NODE_ENV === "production"
                ? []
                : identifiers.map((identifier) => ({
                    field: "lookup",
                    message: "No user matched this identifier",
                    searched: getIdentifierDebugInfo(identifier),
                }))
        );
    }

    if (!user.email || !isValidEmail(user.email)) {
        throw new ApiError(400, "This account does not have a valid email for password reset");
    }

    // Generate a reset token (expires in 10 min)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expiresInMinutes = 10;
    const resetTokenExpires = Date.now() + expiresInMinutes * 60 * 1000;

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        token: resetToken,
        expiresInMinutes,
    });

    const responseData = {
        delivery: "email",
        expiresInMinutes,
        ...(process.env.NODE_ENV !== "production" ? { resetToken } : {})
    };

    return res.status(200).json(
        new ApiResponse(200, responseData, "Password reset email sent")
    );
});
const resetPassword = asyncHandler(async (req, res) => {
    const token = req.params.token || req.body?.token;
    const { newPassword } = req.body;

    if (!token || !newPassword || newPassword.trim() === '') {
        throw new ApiError(400, "Token and new password are required");
    }

    const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: Date.now() } // token not expired
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }

    user.password = newPassword;
    user.passwordLoginEnabled = true;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
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
    logoutUser,
    renewTokens,
    forgotPassword,
    resetPassword,
    changePassword,
    getUserProfile,
    getUserById,
    updateUserProfile,
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
