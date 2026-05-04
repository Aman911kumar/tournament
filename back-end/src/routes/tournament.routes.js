import express from "express";
import {
    createTournament,
    getAllTournaments,
    getTournamentById,
    updateTournament,
    deleteTournament,
    joinTournament,
    getTournamentParticipants,
    getMyTournamentRegistrations,
    distributeTournamentPrizes,
} from "../controllers/tournament.controller.js";
import { protect, creatorOrAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/", getAllTournaments);
router.get("/me/registrations", protect, getMyTournamentRegistrations);
router.get("/:id", getTournamentById);
router.get("/:id/participants", getTournamentParticipants);
router.post("/:id/join", protect, joinTournament);

// Creator/Admin routes
router.post("/", protect, creatorOrAdmin, createTournament);
router.put("/:id", protect, creatorOrAdmin, updateTournament);
router.post("/:id/distribute-prizes", protect, creatorOrAdmin, distributeTournamentPrizes);
router.delete("/:id", protect, creatorOrAdmin, deleteTournament);

export default router;
