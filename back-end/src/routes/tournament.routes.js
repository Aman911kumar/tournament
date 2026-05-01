import express from "express";
import {
    createTournament,
    getAllTournaments,
    getTournamentById,
    updateTournament,
    deleteTournament,
} from "../controllers/tournament.controller.js";
import { protect, creatorOrAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/", getAllTournaments);
router.get("/:id", getTournamentById);

// Creator/Admin routes
router.post("/", protect, creatorOrAdmin, createTournament);
router.put("/:id", protect, creatorOrAdmin, updateTournament);
router.delete("/:id", protect, creatorOrAdmin, deleteTournament);

export default router;
