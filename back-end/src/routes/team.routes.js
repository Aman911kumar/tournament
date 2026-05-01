import express from "express";
import {
    createTeam,
    getAllTeams,
    getTeamById,
    updateTeam,
    deleteTeam,
} from "../controllers/team.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllTeams);
router.get("/:id", getTeamById);

// Protected routes
router.post("/", protect, createTeam);
router.put("/:id", protect, updateTeam);

router.delete("/:id", protect, deleteTeam);

export default router;
