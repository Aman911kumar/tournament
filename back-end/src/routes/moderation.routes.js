import express from "express";
import {
    banTournamentPlayer,
    getModerationActions,
    getMyReports,
    getReports,
    getTournamentBans,
    reviewModerationReport,
    submitReport,
    unbanTournamentPlayer,
} from "../controllers/moderation.controller.js";
import { creatorOrAdmin, protect, requireAdminPermission } from "../middlewares/auth.middleware.js";
import { moderationLimiter, reportLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/reports", protect, reportLimiter, submitReport);
router.get("/reports/me", protect, getMyReports);
router.get("/reports", protect, requireAdminPermission("support:read", "moderation:read"), getReports);
router.patch("/reports/:reportId/review", protect, requireAdminPermission("support:write", "moderation:write"), reviewModerationReport);

router.get("/actions", protect, requireAdminPermission("support:read", "moderation:read"), getModerationActions);

router.get("/tournaments/:tournamentId/bans", protect, creatorOrAdmin, getTournamentBans);
router.post("/tournaments/:tournamentId/bans", protect, creatorOrAdmin, moderationLimiter, banTournamentPlayer);
router.delete("/tournaments/:tournamentId/bans/:playerId", protect, creatorOrAdmin, moderationLimiter, unbanTournamentPlayer);

export default router;
