import express from "express";
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  loginWithFacebook,
  syncClerkUserAccount,
  logoutUser,
  renewTokens,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authLimiter, passwordResetLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Public routes
router.post("/google", authLimiter, loginWithGoogle);
router.post("/facebook", authLimiter, loginWithFacebook);
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/refresh-token", renewTokens);
router.post("/renew-token", renewTokens);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.put("/reset-password/:token", passwordResetLimiter, resetPassword);

// Protected routes
router.post("/clerk/sync", protect, syncClerkUserAccount);
router.get("/logout", protect, logoutUser);
router.patch("/change-password", protect, changePassword);

export default router;
