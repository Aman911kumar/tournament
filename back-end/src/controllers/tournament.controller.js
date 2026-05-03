import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Tournament } from '../models/tournament.model.js';
import { Team } from '../models/team.model.js';
import { Match } from '../models/match.model.js';
import { Channel } from '../models/channel.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

const parseDate = (value, fieldName) => {
    const date = new Date(value);

    if (!value || Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${fieldName} must be a valid date`);
    }

    return date;
};

const normalizeStatus = (status) => {
    const statusMap = {
        upcoming: "open",
        delay:"delay",
        ongoing: "running",
        finished: "completed"
    };

    return statusMap[status] || status;
};

const normalizeGame = (game) => {
    if (!game) return "freefire";
    return String(game).toLowerCase().replace(/\s+/g, "");
};

const userCanManageTournament = (user, tournament) => {
    return hasRole(user, "admin") || tournament.organizer?.toString() === user._id.toString();
};

const buildTournamentPayload = (body, organizerId, channelId = null) => {
    const startAt = parseDate(body.startAt || body.startDate, "startAt");
    const endAt = body.endAt || body.endDate ? parseDate(body.endAt || body.endDate, "endAt") : undefined;

    let registrationEnd = body.registrationEnd
        ? parseDate(body.registrationEnd, "registrationEnd")
        : new Date(startAt.getTime() - 10 * 60 * 1000);

    let registrationStart = body.registrationStart
        ? parseDate(body.registrationStart, "registrationStart")
        : new Date();

    if (registrationEnd <= registrationStart) {
        registrationStart = new Date(registrationEnd.getTime() - 10 * 60 * 1000);
    }

    if (startAt <= registrationEnd) {
        throw new ApiError(400, "Start date must be after registration end date");
    }

    if (!body.title || body.title.trim() === "") {
        throw new ApiError(400, "Tournament title is required");
    }

    return {
        title: body.title.trim(),
        description: body.description,
        game: normalizeGame(body.game),
        organizer: organizerId,
        channel: channelId,
        type: body.type || "solo",
        format: body.format || "single_elim",
        startAt,
        endAt,
        registrationStart,
        registrationEnd,
        maxPlayers: Number(body.maxPlayers || 2),
        entryFee: Number(body.entryFee || 0),
        prizePool: body.prizePool,
        rules: body.rules,
        status: normalizeStatus(body.status) || "open",
        room_details: body.room_details
    };
};

// ---------------------------------
// GET ALL TOURNAMENTS
// ---------------------------------
const getAllTournaments = asyncHandler(async (req, res) => {
    const { limit = 50, skip = 0, search, status, game, organizer, channel } = req.query;
    const query = {};

    if (search && search.trim() !== "") {
        query.title = { $regex: search.trim(), $options: "i" };
    }

    if (status) query.status = normalizeStatus(status);
    if (game) query.game = game.toLowerCase();
    if (organizer && mongoose.Types.ObjectId.isValid(organizer)) query.organizer = organizer;
    if (channel && mongoose.Types.ObjectId.isValid(channel)) query.channel = channel;

    const tournaments = await Tournament.find(query)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .sort({ startAt: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const total = await Tournament.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { tournaments, total }, "Tournaments fetched successfully")
    );
});

// ---------------------------------
// GET TOURNAMENT BY ID
// ---------------------------------
const getTournamentById = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar");

    if (!tournament) throw new ApiError(404, "Tournament not found");

    return res.status(200).json(
        new ApiResponse(200, tournament, "Tournament fetched successfully")
    );
});

// ---------------------------------
// CREATE TOURNAMENT (Creator/Admin)
// ---------------------------------
const createTournament = asyncHandler(async (req, res) => {
    const creatorChannel = await Channel.findOne({ owner: req.user._id, isActive: true });
    const payload = buildTournamentPayload(req.body, req.user._id, creatorChannel?._id || null);
    const tournament = await Tournament.create(payload);

    return res.status(201).json(
        new ApiResponse(201, tournament, "Tournament created successfully")
    );
});

// ---------------------------------
// UPDATE TOURNAMENT (Owner/Admin)
// ---------------------------------
const updateTournament = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to update this tournament");
    }

    const updates = { ...req.body };

    if (updates.startDate && !updates.startAt) updates.startAt = updates.startDate;
    if (updates.endDate && !updates.endAt) updates.endAt = updates.endDate;
    if (updates.status) updates.status = normalizeStatus(updates.status);
    if (updates.game) updates.game = normalizeGame(updates.game);

    const allowedFields = [
        "title",
        "description",
        "game",
        "type",
        "format",
        "startAt",
        "endAt",
        "registrationStart",
        "registrationEnd",
        "maxPlayers",
        "entryFee",
        "prizePool",
        "rules",
        "status",
        "room_details"
    ];

    allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            tournament[field] = updates[field];
        }
    });

    await tournament.save();

    return res.status(200).json(
        new ApiResponse(200, tournament, "Tournament updated successfully")
    );
});

// ---------------------------------
// DELETE TOURNAMENT (Owner/Admin)
// ---------------------------------
const deleteTournament = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to delete this tournament");
    }

    await Match.deleteMany({ tournament: tournamentId });
    await Team.deleteMany({ tournament: tournamentId });
    await tournament.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Tournament deleted successfully")
    );
});

// ---------------------------------
// REGISTER PLAYER / TEAM TO TOURNAMENT
// ---------------------------------
const registerTeam = asyncHandler(async (req, res) => {
    const { tournamentId, teamName, players } = req.body;

    if (!tournamentId || !teamName || !players || !Array.isArray(players)) {
        throw new ApiError(400, "All fields are required");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    const totalRegistered = await Team.countDocuments({ tournament: tournamentId });
    if (totalRegistered >= tournament.maxPlayers) {
        throw new ApiError(400, "Tournament has reached max player limit");
    }

    const team = await Team.create({
        name: teamName,
        tournament: tournamentId,
        players,
        createdBy: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(201, team, "Team registered successfully")
    );
});

// ---------------------------------
// UNREGISTER PLAYER / TEAM
// ---------------------------------
const unregisterTeam = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");

    const team = await Team.findById(teamId);
    if (!team) throw new ApiError(404, "Team not found");

    if (team.createdBy?.toString() !== req.user._id.toString() && !hasRole(req.user, "admin")) {
        throw new ApiError(403, "Not authorized to unregister this team");
    }

    await team.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Team unregistered successfully")
    );
});

export {
    getAllTournaments,
    getTournamentById,
    createTournament,
    updateTournament,
    deleteTournament,
    registerTeam,
    unregisterTeam
};
