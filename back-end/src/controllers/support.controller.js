import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { SupportTicket } from '../models/SupportTicket.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

// ---------------------------------
// CREATE SUPPORT TICKET
// ---------------------------------
const createTicket = asyncHandler(async (req, res) => {
    const { title, subject, description, type, tournament, match } = req.body;
    const ticketTitle = title || subject;

    if (!ticketTitle || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    const ticket = await SupportTicket.create({
        title: ticketTitle,
        description,
        type,
        tournament,
        match,
        user: req.user._id,
        status: "open"
    });

    return res.status(201).json(
        new ApiResponse(200, ticket, "Support ticket created successfully")
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
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

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
        .sort({ [sortBy]: order === "asc" ? 1 : -1 })
        .skip(Number(skip))
        .limit(Number(limit));

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
        .exec();

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
