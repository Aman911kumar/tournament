import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../../env.js";

const getUserRoles = (user) => {
    const roles = user?.role || user?.roles || [];
    return Array.isArray(roles) ? roles : [roles].filter(Boolean);
};

const hasRole = (user, ...allowedRoles) => {
    const userRoles = getUserRoles(user);
    return allowedRoles.some((role) => userRoles.includes(role));
};

const ADMIN_ROLES = ["super_admin", "admin", "moderator", "support", "finance_manager", "tournament_manager"];
const ROLE_PERMISSIONS = {
    super_admin: ["*"],
    admin: ["*"],
    moderator: ["dashboard:read", "users:read", "users:write", "support:read", "support:write", "tournaments:read", "tournaments:write", "moderation:write", "monitoring:read"],
    support: ["dashboard:read", "users:read", "support:read", "support:write", "monitoring:read"],
    finance_manager: ["dashboard:read", "users:read", "finance:read", "finance:write", "monitoring:read"],
    tournament_manager: ["dashboard:read", "users:read", "tournaments:read", "tournaments:write", "monitoring:read"],
};

const getAdminPermissions = (user) => {
    const rolePermissions = getUserRoles(user).flatMap((role) => ROLE_PERMISSIONS[role] || []);
    const directPermissions = Array.isArray(user?.adminPermissions) ? user.adminPermissions : [];
    return new Set([...rolePermissions, ...directPermissions]);
};

const hasAdminPermission = (user, ...requiredPermissions) => {
    const permissions = getAdminPermissions(user);
    return permissions.has("*") || requiredPermissions.some((permission) => permissions.has(permission));
};

const authUserSelect = "_id username email emailVerified phone_number phoneVerified linkedProviders avatar role adminPermissions accountStatus suspendedUntil mutedUntil isActive creatorRequest preferences walletBalance socialProvider passwordLoginEnabled dateOfBirth gender onboarding legalAgreements lastLoginAt createdAt updatedAt";
const AUTH_USER_CACHE_TTL_MS = Math.max(0, Number(process.env.AUTH_USER_CACHE_TTL_MS || 10_000));
const AUTH_USER_CACHE_MAX = Math.max(100, Number(process.env.AUTH_USER_CACHE_MAX || 1000));
const authUserCache = new Map();

const cloneCachedUser = (user) => {
    if (!user) return null;
    return { ...user, role: Array.isArray(user.role) ? [...user.role] : user.role };
};

const trimAuthUserCache = () => {
    if (authUserCache.size <= AUTH_USER_CACHE_MAX) return;
    const now = Date.now();
    for (const [key, value] of authUserCache.entries()) {
        if (value.expiresAt <= now || authUserCache.size > AUTH_USER_CACHE_MAX) authUserCache.delete(key);
        if (authUserCache.size <= AUTH_USER_CACHE_MAX) break;
    }
};

const getAuthUser = async (userId) => {
    const key = userId?.toString?.() || String(userId || "");
    if (!key) return null;

    if (AUTH_USER_CACHE_TTL_MS > 0) {
        const cached = authUserCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cloneCachedUser(cached.user);
        }
        if (cached) authUserCache.delete(key);
    }

    const user = await User.findById(key).select(authUserSelect).lean();

    if (user && AUTH_USER_CACHE_TTL_MS > 0) {
        authUserCache.set(key, {
            user,
            expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
        });
        trimAuthUserCache();
    }

    return cloneCachedUser(user);
};

const assertUsableAccount = (user) => {
    if (!user) return;
    const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil).getTime() : 0;
    const isSuspended = user.accountStatus === "suspended" && (!suspendedUntil || suspendedUntil > Date.now());

    if (!user.isActive || hasRole(user, "banned") || user.accountStatus === "banned") {
        throw new ApiError(403, "Your account is not active");
    }

    if (isSuspended) {
        throw new ApiError(403, "Your account is temporarily suspended");
    }
};

// Middleware to protect routes
const protect = asyncHandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET);
        // const user = await User.findById(decodedToken?._id).select(
        //     "-password -refreshToken"
        // );
        const user = await getAuthUser(decodedToken?._id);

        if (!user) {
            throw new ApiError(402, "Invalid access token");
        }

        assertUsableAccount(user);

        req.user = user; // Attach user to request
        next();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

const optionalProtect = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) return next();

    try {
        const decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET);
        const user = await getAuthUser(decodedToken?._id);

        try {
            assertUsableAccount(user);
            req.user = user;
        } catch {
            // Public routes stay public if the token is unusable.
        }
    } catch {
        // Public routes should stay public; protected routes still use protect().
    }

    next();
});

// Middleware to allow only admin
const admin = (req, res, next) => {
    if (!hasRole(req.user, ...ADMIN_ROLES)) {
        throw new ApiError(403, "Admin access only");
    }
    next();
};

const requireAdminPermission = (...permissions) => (req, res, next) => {
    if (!hasRole(req.user, ...ADMIN_ROLES) || !hasAdminPermission(req.user, ...permissions)) {
        throw new ApiError(403, "You do not have permission for this admin action");
    }
    next();
};

const creatorOrAdmin = (req, res, next) => {
    if (!hasRole(req.user, "creator", ...ADMIN_ROLES)) {
        throw new ApiError(403, "Creator access only");
    }
    next();
};

const requireVerifiedContact = (req, res, next) => {
    if (!req.user?.emailVerified || !req.user?.phoneVerified) {
        throw new ApiError(403, "Verify both email and phone before using this feature", [
            {
                field: "verification",
                message: "Email and phone verification are required for wallet transfers, withdrawals, and tournament registration.",
            },
        ]);
    }
    next();
};

export { protect, optionalProtect, admin, requireAdminPermission, creatorOrAdmin, requireVerifiedContact, hasRole, hasAdminPermission };
