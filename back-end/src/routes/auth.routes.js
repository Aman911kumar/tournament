import express from "express";
import {
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
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authLimiter, passwordResetLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Public routes
router.post("/google", authLimiter, loginWithGoogle);
router.post("/facebook", authLimiter, loginWithFacebook);

// Redirect-based OAuth flow (Web + Android WebView/APK compatible)
router.get("/oauth/:provider/start", authLimiter, startOAuthLogin);
router.get("/oauth/google/callback", authLimiter, oauthGoogleCallback);
router.get("/oauth/facebook/callback", authLimiter, oauthFacebookCallback);
router.post("/oauth/complete", authLimiter, completeOAuthLogin);
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/refresh-token", authLimiter, renewTokens);
router.post("/renew-token", authLimiter, renewTokens);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/forgot-password/verify-otp", passwordResetLimiter, verifyForgotPasswordOtp);
router.post("/forgot-password/resend", passwordResetLimiter, resendForgotPasswordOtp);
router.post("/forgot-password/prepare", passwordResetLimiter, prepareForgotPasswordResetFromLink);
router.put("/forgot-password/complete", passwordResetLimiter, completeForgotPasswordReset);
router.put("/reset-password/:token", passwordResetLimiter, resetPassword);

// Protected routes
router.get("/logout", protect, logoutUser);
router.patch("/change-password", protect, changePassword);

export default router;
