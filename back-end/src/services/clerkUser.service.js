import crypto from "crypto";
import mongoose from "mongoose";
import { createClerkClient, getAuth, verifyToken } from "@clerk/express";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Wallet } from "../models/wallet.model.js";
import { CLERK_JWT_KEY, CLERK_SECRET_KEY } from "../../env.js";

const USER_SAFE_SELECT = "-password -refreshToken -emailVerificationToken -phoneVerificationToken -resetPasswordToken";
let clerkClientInstance = null;

const getClerkClient = () => {
    if (!CLERK_SECRET_KEY) throw new ApiError(500, "CLERK_SECRET_KEY is not configured on the backend");
    if (!clerkClientInstance) {
        clerkClientInstance = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    }
    return clerkClientInstance;
};

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const normalizePersonName = (value = "") => String(value || "").trim().slice(0, 50);

const normalizePhoneNumber = (value = "") => {
    const compact = String(value || "").trim().replace(/\s+/g, "");
    const digits = compact.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 10) return digits;
    return compact || undefined;
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeUsername = (value = "") => {
    const base = String(value || "")
        .toLowerCase()
        .replace(/@.*/, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24);

    return base.length >= 4 ? base : `user_${base || "player"}`;
};

const createUniqueUsername = async (preferred, fallback) => {
    const base = normalizeUsername(preferred || fallback);
    let username = base.slice(0, 30);
    let suffix = 0;

    while (await User.exists({ username: { $regex: `^${escapeRegex(username)}$`, $options: "i" } })) {
        suffix += 1;
        const nextSuffix = `_${suffix}`;
        username = `${base.slice(0, 30 - nextSuffix.length)}${nextSuffix}`;
    }

    return username;
};

const getPrimaryEmail = (clerkUser) => {
    const primary = clerkUser?.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)
        || clerkUser?.emailAddresses?.[0];
    const email = normalizeEmail(primary?.emailAddress);
    return {
        email: email || undefined,
        verified: primary?.verification?.status === "verified" || primary?.verification?.status === "transferable",
    };
};

const getPrimaryPhone = (clerkUser) => {
    const primary = clerkUser?.phoneNumbers?.find((item) => item.id === clerkUser.primaryPhoneNumberId)
        || clerkUser?.phoneNumbers?.[0];
    const phone = normalizePhoneNumber(primary?.phoneNumber);
    return {
        phone,
        verified: primary?.verification?.status === "verified",
    };
};

const getDisplayName = (clerkUser) => {
    const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
    return clerkUser?.username || fullName || clerkUser?.fullName || "";
};

const providerFromStrategy = (strategy = "") => {
    const value = String(strategy || "").toLowerCase();
    if (value.includes("google")) return "google";
    if (value.includes("facebook")) return "facebook";
    return null;
};

const getLinkedProviders = ({ clerkUser, email, emailVerified, phone, phoneVerified }) => {
    const links = [{ provider: "clerk", providerId: clerkUser.id, verified: true }];

    if (email) links.push({ provider: "email", providerId: email, verified: Boolean(emailVerified) });
    if (phone) links.push({ provider: "phone", providerId: phone, verified: Boolean(phoneVerified) });

    for (const account of clerkUser?.externalAccounts || []) {
        const provider = providerFromStrategy(account?.provider || account?.verification?.strategy);
        const providerId = account?.providerUserId || account?.externalId || account?.id;
        if (provider && providerId) {
            links.push({ provider, providerId, verified: true });
        }
    }

    return links;
};

const mergeLinkedProviders = (current = [], next = []) => {
    const merged = [...current];
    for (const link of next) {
        if (!link?.provider) continue;
        const exists = merged.some((item) => item.provider === link.provider && item.providerId === link.providerId);
        if (!exists) merged.push(link);
    }
    return merged;
};

const buildLookup = ({ clerkUserId, email, phone }) => ({
    $or: [
        { clerkId: clerkUserId },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone_number: phone }] : []),
    ],
});

export const getClerkAuth = (req) => {
    try {
        return getAuth(req);
    } catch {
        return null;
    }
};

export const verifyClerkSessionToken = async (token) => {
    if (!token || (!CLERK_SECRET_KEY && !CLERK_JWT_KEY)) return null;

    const verified = await verifyToken(token, {
        ...(CLERK_JWT_KEY ? { jwtKey: CLERK_JWT_KEY } : {}),
        ...(CLERK_SECRET_KEY ? { secretKey: CLERK_SECRET_KEY } : {}),
    });

    return verified?.sub ? verified : null;
};

export const getMongoUserForClerkId = async (clerkUserId, select = USER_SAFE_SELECT) => {
    if (!clerkUserId) return null;
    return User.findOne({ clerkId: clerkUserId }).select(select);
};

export const syncClerkUser = async ({
    clerkUserId,
    profile = {},
    select = USER_SAFE_SELECT,
    force = false,
} = {}) => {
    if (!clerkUserId) throw new ApiError(401, "Clerk session is missing user id");
    if (!force) {
        const existing = await getMongoUserForClerkId(clerkUserId, select);
        if (existing) return existing;
    }

    const clerkUser = await getClerkClient().users.getUser(clerkUserId);
    const { email, verified: emailVerified } = getPrimaryEmail(clerkUser);
    const { phone, verified: phoneVerified } = getPrimaryPhone(clerkUser);
    const requestedPhone = normalizePhoneNumber(profile.phone_number || profile.phoneNumber);
    const requestedEmail = normalizeEmail(profile.email);
    const profileHasFirstName = Object.prototype.hasOwnProperty.call(profile, "firstName") || Object.prototype.hasOwnProperty.call(profile, "first_name");
    const profileHasLastName = Object.prototype.hasOwnProperty.call(profile, "lastName") || Object.prototype.hasOwnProperty.call(profile, "last_name");
    const finalFirstName = normalizePersonName(
        profile.firstName ?? profile.first_name ?? clerkUser?.firstName
    );
    const finalLastName = normalizePersonName(
        profile.lastName ?? profile.last_name ?? clerkUser?.lastName
    );
    const finalEmail = requestedEmail || email;
    const finalPhone = requestedPhone || phone;
    const preferredUsername = profile.username
        || clerkUser?.unsafeMetadata?.username
        || clerkUser?.publicMetadata?.username
        || clerkUser?.username
        || finalEmail
        || getDisplayName(clerkUser)
        || clerkUserId;
    const linkedProviders = getLinkedProviders({
        clerkUser,
        email: finalEmail,
        emailVerified,
        phone: finalPhone,
        phoneVerified,
    });

    let user = await User.findOne(buildLookup({ clerkUserId, email: finalEmail, phone: finalPhone }));

    if (user) {
        let changed = false;
        if (!user.clerkId) {
            user.clerkId = clerkUserId;
            changed = true;
        }
        if (finalEmail && !user.email) {
            user.email = finalEmail;
            changed = true;
        }
        if (finalEmail && emailVerified && !user.emailVerified) {
            user.emailVerified = true;
            changed = true;
        }
        if (finalPhone && !user.phone_number) {
            user.phone_number = finalPhone;
            changed = true;
        }
        if (finalPhone && phoneVerified && !user.phoneVerified) {
            user.phoneVerified = true;
            changed = true;
        }
        if (!user.avatar?.url && clerkUser.imageUrl) {
            user.avatar = { ...(user.avatar || {}), url: clerkUser.imageUrl };
            changed = true;
        }
        if ((profileHasFirstName || !user.firstName) && user.firstName !== finalFirstName) {
            user.firstName = finalFirstName;
            changed = true;
        }
        if ((profileHasLastName || !user.lastName) && user.lastName !== finalLastName) {
            user.lastName = finalLastName;
            changed = true;
        }

        const mergedProviders = mergeLinkedProviders(user.linkedProviders || [], linkedProviders);
        if (mergedProviders.length !== (user.linkedProviders || []).length) {
            user.linkedProviders = mergedProviders;
            changed = true;
        }

        user.lastLoginAt = new Date();
        if (changed) await user.save({ validateBeforeSave: false });
        else await user.save({ validateBeforeSave: false });

        await Wallet.updateOne(
            { user: user._id },
            { $setOnInsert: { user: user._id, balance: 0, lockedBalance: 0 } },
            { upsert: true }
        );

        return User.findById(user._id).select(select);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const username = await createUniqueUsername(preferredUsername, clerkUserId);
        const password = crypto.randomBytes(32).toString("hex");
        const [createdUser] = await User.create(
            [
                {
                    clerkId: clerkUserId,
                    username,
                    firstName: finalFirstName,
                    lastName: finalLastName,
                    ...(finalEmail ? { email: finalEmail } : {}),
                    emailVerified: Boolean(emailVerified),
                    ...(finalPhone ? { phone_number: finalPhone } : {}),
                    phoneVerified: Boolean(phoneVerified),
                    password,
                    passwordLoginEnabled: false,
                    avatar: clerkUser.imageUrl ? { url: clerkUser.imageUrl } : undefined,
                    linkedProviders,
                    lastLoginAt: new Date(),
                },
            ],
            { session }
        );

        await Wallet.create(
            [{ user: createdUser._id, balance: 0, lockedBalance: 0 }],
            { session }
        );

        await session.commitTransaction();
        return User.findById(createdUser._id).select(select);
    } catch (error) {
        await session.abortTransaction();
        if (error?.code === 11000) {
            const existingUser = await User.findOne(buildLookup({ clerkUserId, email: finalEmail, phone: finalPhone })).select(select);
            if (existingUser) return existingUser;
        }
        throw error;
    } finally {
        session.endSession();
    }
};

export const syncClerkUserFromRequest = async (req, options = {}) => {
    const auth = getClerkAuth(req);
    if (!auth?.userId) return null;
    return syncClerkUser({
        clerkUserId: auth.userId,
        profile: req.body || {},
        ...options,
    });
};

export const updateClerkUserName = async (clerkUserId, { firstName, lastName } = {}) => {
    if (!clerkUserId || !CLERK_SECRET_KEY) return false;

    await getClerkClient().users.updateUser(clerkUserId, {
        firstName: normalizePersonName(firstName),
        lastName: normalizePersonName(lastName),
    });

    return true;
};
