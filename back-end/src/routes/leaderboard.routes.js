import express from "express";
import {
    getLeaderboard,
    getLeaderboardByTournament,
    updateLeaderboard,
} from "../controllers/leaderboard.controller.js";
import { protect, admin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/", getLeaderboard);
router.get("/:tournamentId", getLeaderboardByTournament);

// Admin-only route
router.post("/", protect, admin, updateLeaderboard);

export default router;
