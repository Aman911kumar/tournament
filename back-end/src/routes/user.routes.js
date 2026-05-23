import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  completeUserOnboarding,
  verifyProfileEmail,
  confirmEmailVerification,
  verifyProfilePhone,
  confirmPhoneVerification,
  becomeCreator,
  leaveCreator,
  uploadAvatar,
  removeAvatar,
  uploadBanner,
  removeBanner,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import { protect, admin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Protected routes
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);
router.post("/profile/onboarding", protect, completeUserOnboarding);
router.post("/profile/verify-email", protect, verifyProfileEmail);
router.post("/profile/confirm-email", confirmEmailVerification);
router.post("/profile/verify-phone", protect, verifyProfilePhone);
router.post("/profile/confirm-phone", confirmPhoneVerification);
router.post(
  "/profile/avatar",
  protect,
  express.raw({
    type: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    limit: process.env.PROFILE_AVATAR_UPLOAD_LIMIT || "2mb",
  }),
  uploadAvatar
);
router.delete("/profile/avatar", protect, removeAvatar);
router.post(
  "/profile/banner",
  protect,
  express.raw({
    type: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    limit: process.env.PROFILE_BANNER_UPLOAD_LIMIT || "4mb",
  }),
  uploadBanner
);
router.delete("/profile/banner", protect, removeBanner);
router.post("/creator", protect, becomeCreator);
router.delete("/creator", protect, leaveCreator);

// Admin-only routes
router.get("/", protect, admin, getAllUsers);
router.get("/:id", protect, admin, getUserById);
router.put("/:id", protect, admin, updateUser);
router.delete("/:id", protect, admin, deleteUser);

export default router;
