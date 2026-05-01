import express from "express";
import {
    createMatch,
    getAllMatches,
    getMatchById,
    updateMatch,
    deleteMatch,
} from "../controllers/match.controller.js";
import { protect, creatorOrAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/", getAllMatches);
router.get("/:id", getMatchById);

// Creator/Admin routes
router.post("/", protect, creatorOrAdmin, createMatch);
router.put("/:id", protect, creatorOrAdmin, updateMatch);
router.delete("/:id", protect, creatorOrAdmin, deleteMatch);

export default router;
