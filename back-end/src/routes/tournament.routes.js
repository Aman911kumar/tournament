import express from "express";
import {
    createTournament,
    getAllTournaments,
    getTournamentById,
    updateTournament,
    deleteTournament,
    cancelTournament,
    joinTournament,
    getTournamentParticipants,
    getMyTournamentRegistrations,
    distributeTournamentPrizes,
} from "../controllers/tournament.controller.js";
import { protect, optionalProtect, creatorOrAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/", optionalProtect, getAllTournaments);
router.get("/me/registrations", protect, getMyTournamentRegistrations);
router.get("/:id", optionalProtect, getTournamentById);
router.get("/:id/participants", getTournamentParticipants);
router.post("/:id/join", protect, joinTournament);

// Creator/Admin routes
router.post("/", protect, creatorOrAdmin, createTournament);
router.put("/:id", protect, creatorOrAdmin, updateTournament);
router.post("/:id/cancel", protect, creatorOrAdmin, cancelTournament);
router.post("/:id/distribute-prizes", protect, creatorOrAdmin, distributeTournamentPrizes);
router.delete("/:id", protect, creatorOrAdmin, deleteTournament);

export default router;
