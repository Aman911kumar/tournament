import express from "express";
import authRoutes from "./auth.routes.js";
import gameAccount from "./gameAccount.routes.js"
import userRoutes from "./user.routes.js";
import tournamentRoutes from "./tournament.routes.js";
import teamRoutes from "./team.routes.js";
import leaderboardRoutes from "./leaderboard.routes.js";
import supportRoutes from "./support.routes.js";
import channelRoutes from "./channel.routes.js";
import adminRoutes from "./admin.routes.js";
import walletRoutes from "./wallet.routes.js";
import notificationRoutes from "./notification.routes.js";
import healthRoutes from "./health.routes.js";
import monitoringRoutes from "./monitoring.routes.js";
import moderationRoutes from "./moderation.routes.js";
import chatRoutes from "./chat.routes.js";

const router = express.Router();

// Health and readiness checks
router.use("/health", healthRoutes);

// Frontend monitoring ingest. Admin-only reads live under /admin/monitoring.
router.use("/monitoring", monitoringRoutes);

// Auth routes
router.use("/auth", authRoutes);

// Admin dashboard routes
router.use("/admin", adminRoutes);

// User routes
router.use("/user", userRoutes);

// Wallet routes
router.use("/wallet", walletRoutes);

// Notification routes
router.use("/notifications", notificationRoutes);

// Reports and moderation routes
router.use("/moderation", moderationRoutes);

// Tournament room chat routes
router.use("/chat", chatRoutes);

// Game Account routes
router.use("/game-account",gameAccount)

// Tournament routes
router.use("/tournaments", tournamentRoutes);

// Creator channel routes
router.use("/channels", channelRoutes);

// Team routes
router.use("/teams", teamRoutes);

// Leaderboard routes
router.use("/leaderboard", leaderboardRoutes);

// Support/Report routes
router.use("/support", supportRoutes);


export default router;
