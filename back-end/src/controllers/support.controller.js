import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { SupportTicket } from '../models/SupportTicket.model.js';
import { Notification } from '../models/notification.model.js';
import { Tournament } from '../models/tournament.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

// ---------------------------------
// CREATE SUPPORT TICKET
// ---------------------------------
const createTicket = asyncHandler(async (req, res) => {
    const {
        title,
        subject,
        description,
        type = "general",
        tournament,
        targetUser,
        reason = "other",
        evidence = {},
        priority
    } = req.body;
    const ticketTitle = title || subject;

    if (!ticketTitle || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    const ticketType = ["report", "dispute", "general"].includes(type) ? type : "general";
    const ticketPriority = priority || (["cheating", "payout_not_distributed", "wrong_payout"].includes(reason) ? "high" : "normal");
    let tournamentDoc = null;
    if (tournament) {
        if (!mongoose.Types.ObjectId.isValid(tournament)) {
            throw new ApiError(400, "Invalid tournament ID");
        }
        tournamentDoc = await Tournament.findById(tournament).select("title organizer");
        if (!tournamentDoc) throw new ApiError(404, "Tournament not found");
    }

    const ticket = await SupportTicket.create({
        title: ticketTitle,
        description,
        type: ticketType,
        tournament,
        targetUser: targetUser || null,
        reason,
        evidence: {
            screenshots: Array.isArray(evidence.screenshots) ? evidence.screenshots.filter(Boolean).slice(0, 5) : [],
            videoUrl: evidence.videoUrl || "",
            matchProof: evidence.matchProof || "",
        },
        priority: ticketPriority,
        user: req.user._id,
        status: "open"
    });

    if (tournamentDoc?.organizer && tournamentDoc.organizer.toString() !== req.user._id.toString()) {
        await Notification.create({
            user: tournamentDoc.organizer,
            title: ticketType === "dispute" ? "Tournament dispute opened" : "Tournament report opened",
            body: `${req.user.username || "A user"} submitted ${ticketType === "dispute" ? "a dispute" : "a report"} for ${tournamentDoc.title}. Admin will review it.`,
            type: "system",
        });
    }

    return res.status(201).json(
        new ApiResponse(201, ticket, ticketType === "general" ? "Support ticket created successfully" : "Report submitted for admin review")
    );
});

// ---------------------------------
// GET USER TICKETS
// ---------------------------------
const getUserTickets = asyncHandler(async (req, res) => {
    const { limit = 50, skip = 0, status } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;

    const tickets = await SupportTicket.find(query)
        .populate("tournament", "title game status")
        .populate("targetUser", "username avatar phone_number")
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

    const total = await SupportTicket.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { tickets, total }, "User tickets fetched successfully")
    );
});
const getAllTickets = asyncHandler(async (req, res) => {
    const { limit = 20, skip = 0, status, type, search, sortBy = "createdAt", order = "desc" } = req.query;

    const query = {};

    // Filter by status (open, resolved, pending, closed)
    if (status) query.status = status;

    // Filter by type (support, report, etc.)
    if (type) query.type = type;

    // Search by user message or title
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } },
        ];
    }

    // Fetch tickets with user details
    const tickets = await SupportTicket.find(query)
        .populate("user", "username phone_number")
        .populate("targetUser", "username phone_number")
        .populate("tournament", "title game status")
        .sort({ [sortBy]: order === "asc" ? 1 : -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

    const total = await SupportTicket.countDocuments(query);

    if (tickets.length === 0) {
        throw new ApiError(404, "No tickets found");
    }

    return res.status(200).json(
        new ApiResponse(200, { total, tickets }, "Tickets fetched successfully")
    );
});

const getTicketById = asyncHandler(async (req, res) => {
    const ticketId = getParamId(req, "ticketId");

    // Validate ticket ID
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        throw new ApiError(400, "Invalid ticket ID");
    }

    // Fetch ticket with user details and optional replies
    const ticket = await SupportTicket.findById(ticketId)
        .populate("user", "username phone_number")
        .populate("targetUser", "username phone_number")
        .populate("tournament", "title game status")
        .lean();

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    return res.status(200).json(
        new ApiResponse(200, ticket, "Ticket fetched successfully")
    );
});


// ---------------------------------
// UPDATE TICKET STATUS (Admin Only)
// ---------------------------------
const updateTicketStatus = asyncHandler(async (req, res) => {
    const ticketId = getParamId(req, "ticketId");
    const { status, response } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        throw new ApiError(400, "Invalid ticket ID");
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new ApiError(404, "Ticket not found");

    ticket.status = status || ticket.status;
    if (response) ticket.adminResponse = response;
    if (status === "resolved" || status === "closed") ticket.resolvedAt = new Date();

    await ticket.save();

    return res.status(200).json(
        new ApiResponse(200, ticket, "Ticket updated successfully")
    );
});

// ---------------------------------
// DELETE TICKET (Admin or Owner)
// ---------------------------------
const deleteTicket = asyncHandler(async (req, res) => {
    const ticketId = getParamId(req, "ticketId");

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        throw new ApiError(400, "Invalid ticket ID");
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new ApiError(404, "Ticket not found");

    if (ticket.user.toString() !== req.user._id.toString() && !hasRole(req.user, "admin")) {
        throw new ApiError(403, "Not authorized to delete this ticket");
    }

    await ticket.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Ticket deleted successfully")
    );
});

export {
    createTicket,
    getUserTickets,
    getAllTickets,
    getTicketById,
    updateTicketStatus,
    deleteTicket
};
