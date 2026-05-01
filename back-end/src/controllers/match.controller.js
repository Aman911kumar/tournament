import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Match } from '../models/match.model.js';
import { Tournament } from '../models/tournament.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

const userCanManageTournament = (user, tournament) => {
    return hasRole(user, "admin") || tournament.organizer?.toString() === user._id.toString();
};

const userCanManageMatch = async (user, match) => {
    if (hasRole(user, "admin") || match.createdBy?.toString() === user._id.toString()) {
        return true;
    }

    const tournament = await Tournament.findById(match.tournament);
    return tournament ? userCanManageTournament(user, tournament) : false;
};

// ---------------------------------
// GET ALL MATCHES (Optional: By Tournament)
// ---------------------------------
const getAllMatches = asyncHandler(async (req, res) => {
    const { tournamentId, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (tournamentId) {
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            throw new ApiError(400, "Invalid tournament ID");
        }
        query.tournament = tournamentId;
    }

    const matches = await Match.find(query)
        .sort({ scheduledAt: 1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const total = await Match.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { matches, total }, "Matches fetched successfully")
    );
});

// ---------------------------------
// GET MATCH BY ID
// ---------------------------------
const getMatchById = asyncHandler(async (req, res) => {
    const matchId = getParamId(req, "matchId");

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
        throw new ApiError(400, "Invalid match ID");
    }

    const match = await Match.findById(matchId);
    if (!match) throw new ApiError(404, "Match not found");

    return res.status(200).json(
        new ApiResponse(200, match, "Match fetched successfully")
    );
});

// ---------------------------------
// CREATE MATCH (Creator/Admin Only)
// ---------------------------------
const createMatch = asyncHandler(async (req, res) => {
    const { tournamentId, round, scheduledAt } = req.body;

    if (!tournamentId || round == null || !scheduledAt) {
        throw new ApiError(400, "All fields are required");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");
    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to create match for this tournament");
    }

    const match = await Match.create({
        tournament: tournamentId,
        round,
        scheduledAt: new Date(scheduledAt),
        createdBy: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(200, match, "Match created successfully")
    );
});

// ---------------------------------
// UPDATE MATCH (Creator/Admin Only)
// ---------------------------------
const updateMatch = asyncHandler(async (req, res) => {
    const matchId = getParamId(req, "matchId");
    const updates = req.body;

    const match = await Match.findById(matchId);
    if (!match) throw new ApiError(404, "Match not found");
    if (!(await userCanManageMatch(req.user, match))) {
        throw new ApiError(403, "Not authorized to update this match");
    }

    Object.keys(updates).forEach(key => match[key] = updates[key]);
    await match.save();

    return res.status(200).json(
        new ApiResponse(200, match, "Match updated successfully")
    );
});

// ---------------------------------
// DELETE MATCH (Creator/Admin Only)
// ---------------------------------
const deleteMatch = asyncHandler(async (req, res) => {
    const matchId = getParamId(req, "matchId");

    const match = await Match.findById(matchId);
    if (!match) throw new ApiError(404, "Match not found");
    if (!(await userCanManageMatch(req.user, match))) {
        throw new ApiError(403, "Not authorized to delete this match");
    }

    await match.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Match deleted successfully")
    );
});

// ---------------------------------
// RECORD MATCH RESULT (Creator/Admin Only)
// ---------------------------------
const recordMatchResult = asyncHandler(async (req, res) => {
    const matchId = getParamId(req, "matchId");
    const { result } = req.body; // Example: { winnerTeam: teamId, scores: [...] }

    if (!result) throw new ApiError(400, "Result data is required");

    const match = await Match.findById(matchId);
    if (!match) throw new ApiError(404, "Match not found");
    if (!(await userCanManageMatch(req.user, match))) {
        throw new ApiError(403, "Not authorized to record result for this match");
    }

    match.result = result;
    match.status = "finished";
    await match.save();

    return res.status(200).json(
        new ApiResponse(200, match, "Match result recorded successfully")
    );
});

export {
    getAllMatches,
    getMatchById,
    createMatch,
    updateMatch,
    deleteMatch,
    recordMatchResult
};
