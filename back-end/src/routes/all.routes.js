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

const router = express.Router();

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
