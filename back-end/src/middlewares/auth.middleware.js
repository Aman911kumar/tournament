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

const authUserSelect = "_id username email emailVerified phone_number phoneVerified linkedProviders avatar role isActive creatorRequest preferences walletBalance socialProvider passwordLoginEnabled dateOfBirth gender lastLoginAt createdAt updatedAt";

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
        const user = await User.findById(decodedToken?._id).select(authUserSelect);

        if (!user) {
            throw new ApiError(402, "Invalid access token");
        }

        if (!user.isActive || hasRole(user, "banned")) {
            throw new ApiError(403, "Your account is not active");
        }

        req.user = user; // Attach user to request
        next();
    } catch (error) {
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
        const user = await User.findById(decodedToken?._id).select(authUserSelect);

        if (user && user.isActive && !hasRole(user, "banned")) {
            req.user = user;
        }
    } catch {
        // Public routes should stay public; protected routes still use protect().
    }

    next();
});

// Middleware to allow only admin
const admin = (req, res, next) => {
    if (!hasRole(req.user, "admin")) {
        throw new ApiError(403, "Admin access only");
    }
    next();
};

const creatorOrAdmin = (req, res, next) => {
    if (!hasRole(req.user, "creator", "admin")) {
        throw new ApiError(403, "Creator access only");
    }
    next();
};

export { protect, optionalProtect, admin, creatorOrAdmin, hasRole };
