import express from "express";
import {
    createTicket,
    getUserTickets,
    getAllTickets,
    getTicketById,
    deleteTicket,
    updateTicketStatus,
} from "../controllers/support.controller.js";
import { protect, admin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Create ticket (user)
router.post("/", protect, createTicket);
router.get("/me", protect, getUserTickets);

// Get tickets (admin)
router.get("/", protect, admin, getAllTickets);
router.get("/:id", protect, admin, getTicketById);

// Update ticket status (admin)
router.put("/:id", protect, admin, updateTicketStatus);

// Delete ticket (admin)
router.delete("/:id", protect, admin, deleteTicket);

export default router;
