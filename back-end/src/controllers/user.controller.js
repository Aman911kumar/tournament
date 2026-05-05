import asyncHandler from '../utils/AsyncHandler.js'
import ApiError from '../utils/ApiError.js'
import ApiResponse from '../utils/ApiResponse.js'
import { User } from '../models/user.model.js'
import { WalletTransaction } from '../models/walletTransaction.model.js'
import { Wallet } from '../models/wallet.model.js'
import { Notification } from '../models/notification.model.js'
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

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, error || 'something went while generating refresh and access token')
    }
}
const options = {
    httpOnly: true,
    secure: true
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

    const [wallet, allTimeWinnings, monthlyWinnings, matchesPlayed] = await Promise.all([
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
            matchesPlayed,
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
                    socialProvider: provider,
                    socialProviderId: providerId,
                    password,
                    avatar: picture ? { url: picture } : undefined,
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

    // Validate required fields
    [
        { field: username, name: "username" },
        { field: phone_number, name: "phone number" },
        { field: password, name: "password" }
    ].forEach(item => {
        if (!item.field || item.field.trim() === '') {
            throw new ApiError(400, `${item.name} is required`);
        }
    });

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [
            { username: { $regex: `^${username}$`, $options: "i" } },
            { phone_number }
        ]
    });

    if (existedUser) {
        throw new ApiError(400, 'Username or phone number already exists');
    }

    // 🔥 START TRANSACTION
    const session = await mongoose.startSession();
    session.startTransaction();

    let user;

    try {
        // 1️⃣ Create user
        const createdUserArr = await User.create(
            [{ username, phone_number, password, email }],
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
    const { phone_number, password } = req.body;

    // console.log(phone_number, "\n", password)
    // Validate input
    [{ field: phone_number, name: "phone number" },
    { field: password, name: "password" }].forEach(item => {
        if (!item.field || item.field.trim() === '') {
            throw new ApiError(400, `${item.name} is required`);
        }
    });

    // Find user
    let user = await User.findOne({ phone_number });
    if (!user) {
        user = await User.findOne({ email: phone_number });
    }
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
            new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "logged in successfully")
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
    const receivedRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
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

        // Generate new tokens
        const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

        // Optional: update last token renewal time
        user.lastTokenRenewed = new Date();
        await user.save({ validateBeforeSave: false });

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken }, "New tokens generated successfully")
            );

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});
const forgotPassword = asyncHandler(async (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number || phone_number.trim() === '') {
        throw new ApiError(400, "Phone number is required");
    }

    const user = await User.findOne({ phone_number });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Generate a reset token (expires in 10 min)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 10 * 60 * 1000; // 1 min

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save({ validateBeforeSave: false });


    // TODO: send token via SMS or email
    // e.g., sendSMS(user.phone_number, `Your reset code: ${resetToken}`)

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset token sent successfully")
    );
});
const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.trim() === '') {
        throw new ApiError(400, "Token and new password are required");
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() } // token not expired
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully")
    );
});
const changePassword = asyncHandler(async (req, res) => {
    const user = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.trim() === '') {
        throw new ApiError(400, "Current and new password are required");
    }

    // Verify current password
    const isCorrect = await user.isPasswordCorrect(currentPassword);
    if (!isCorrect) {
        throw new ApiError(400, "Incorrect current password");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

//profile Management________________________________________________________________________________________________

const getUserProfile = asyncHandler(async (req, res) => {
    const user = req.user;
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
    const user = req.user
    const { username, gamename, gameid, dateOfBirth, gender, password } = req.body;
    // console.log(username, gamename, gameid, dateOfBirth, gender, password)

    // Validate current password
    if (!password || password.trim() === "") {
        throw new ApiError(400, "Password is required to update profile");
    }

    const isCorrect = await user.isPasswordCorrect(password);
    if (!isCorrect) {
        throw new ApiError(400, "Incorrect password");
    }

    // Build update object dynamically
    const updates = {};

    if (username && username.trim() !== "") {
        const existingUser = await User.findOne({ username });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            throw new ApiError(400, "Username already exists, choose another one");
        }
        updates.username = username.trim();
    }

    if (gamename && gamename.trim() !== "") updates.gamename = gamename.trim();
    if (gameid && gameid.trim() !== "") updates.gameid = gameid.trim();
    if (dateOfBirth && dateOfBirth.trim() !== "") updates.dateOfBirth = new Date(dateOfBirth);
    if (gender && gender.trim() !== "") updates.gender = gender.trim();

    // Update user in DB
    const updatedUser = await User.findByIdAndUpdate(
        user._id,
        updates,
        { new: true, runValidators: true }
    ).select("-password -refreshToken -accessToken");

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User profile updated successfully")
    );
});
const becomeCreator = asyncHandler(async (req, res) => {
    const user = req.user;
    const roles = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean);

    if (!roles.includes("creator")) {
        user.role = [...new Set([...roles, "user", "creator"])];
        await user.save({ validateBeforeSave: false });
    }

    const updatedUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "Creator mode enabled")
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
        const isCorrect = await user.isPasswordCorrect(password);
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

const getWalletBalance = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({
        user: req.user._id
    })
    
    const balance = wallet.balance || 0;

    return res.status(200).json(
        new ApiResponse(200, { balance }, "Wallet balance fetched successfully")
    );
});

const getWalletTransaction = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { limit = 20, skip = 0, type, filter } = req.query;

    const query = { user: userId };
    if (type && ['credit', 'debit'].includes(type)) {
        query.type = type.toUpperCase();
    }
    if (filter === "creator") {
        query.type = "CREDIT";
        query.category = { $in: ["ORGANIZER_EARNING", "TRANSFER"] };
    }
    if (filter === "player") {
        query.$or = [
            { type: { $ne: "CREDIT" } },
            { category: { $nin: ["ORGANIZER_EARNING", "TRANSFER"] } }
        ];
    }

    const transactions = await WalletTransaction.find(query)
        .populate("fromUser", "username phone_number avatar role")
        .populate("toUser", "username phone_number avatar role")
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    return res.status(200).json(
        new ApiResponse(200, transactions, "Wallet transactions fetched successfully")
    );
});
const getTransactionDetails = asyncHandler(async (req, res) => {
    const transactionId = req.params.id

    const transaction = await WalletTransaction.findById(transactionId)
        .populate("fromUser", "username phone_number avatar role")
        .populate("toUser", "username phone_number avatar role")

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
        WalletTransaction.aggregate([
            { $match: { user: userId, type: "CREDIT", category: { $in: ["ORGANIZER_EARNING", "TRANSFER"] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        WalletTransaction.aggregate([
            { $match: { user: userId, type: "CREDIT", category: { $in: ["ORGANIZER_EARNING", "TRANSFER"] }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
    ]);

    const total = Number(allTimeTotals[0]?.total || 0);
    const monthTotal = Number(monthlyTotals[0]?.total || 0);
    const monthlyChange = total > 0 ? Math.round((monthTotal / total) * 100) : 0;

    return res.status(200).json(
        new ApiResponse(200, { total, monthlyChange }, "Creator earnings fetched successfully")
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
        .limit(Number(limit));

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

    // Search by username or phone_number
    if (search && search.trim() !== "") {
        query.$or = [
            { username: { $regex: search, $options: "i" } },
            { phone_number: { $regex: search, $options: "i" } }
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
    becomeCreator,
    leaveCreator,
    uploadAvatar,
    deleteUser,
    updateUser,
    getWalletBalance,
    getWalletTransaction,
    getTransactionDetails,
    getCreatorEarnings,
    getPlayerEarnings,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getAllUsers,
    banUser,
    unbanUser
}
