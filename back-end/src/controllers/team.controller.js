import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Team } from '../models/team.model.js';
import { Tournament } from '../models/tournament.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

const userCanManageTeam = (user, team) => {
    return hasRole(user, "admin") || team.createdBy?.toString() === user._id.toString();
};

// ---------------------------------
// GET ALL TEAMS (Optional: By Tournament)
// ---------------------------------
const getAllTeams = asyncHandler(async (req, res) => {
    const { tournamentId, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (tournamentId) {
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            throw new ApiError(400, "Invalid tournament ID");
        }
        query.tournament = tournamentId;
    }

    const teams = await Team.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

    const total = await Team.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { teams, total }, "Teams fetched successfully")
    );
});

// ---------------------------------
// GET TEAM BY ID
// ---------------------------------
const getTeamById = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
        throw new ApiError(400, "Invalid team ID");
    }

    const team = await Team.findById(teamId);
    if (!team) throw new ApiError(404, "Team not found");

    return res.status(200).json(
        new ApiResponse(200, team, "Team fetched successfully")
    );
});

// ---------------------------------
// CREATE TEAM (Player or Creator/Admin)
// ---------------------------------
const createTeam = asyncHandler(async (req, res) => {
    const { tournamentId, name, players } = req.body;

    if (!tournamentId || !name || !players || !Array.isArray(players) || players.length === 0) {
        throw new ApiError(400, "Tournament, team name, and at least one player are required");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    // Check max players per tournament
    const totalTeams = await Team.countDocuments({ tournament: tournamentId });
    if (totalTeams >= tournament.maxPlayers) {
        throw new ApiError(400, "Tournament has reached max team limit");
    }

    const team = await Team.create({
        tournament: tournamentId,
        name,
        players,
        createdBy: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(200, team, "Team created successfully")
    );
});

// ---------------------------------
// UPDATE TEAM INFO (Team Creator/Admin Only)
// ---------------------------------
const updateTeam = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");
    const updates = req.body;

    const team = await Team.findById(teamId).lean();
    if (!team) throw new ApiError(404, "Team not found");
    if (!userCanManageTeam(req.user, team)) {
        throw new ApiError(403, "Not authorized to update this team");
    }

    Object.keys(updates).forEach(key => team[key] = updates[key]);
    await team.save();

    return res.status(200).json(
        new ApiResponse(200, team, "Team updated successfully")
    );
});

// ---------------------------------
// ADD PLAYER TO TEAM (Team Creator/Admin Only)
// ---------------------------------
const addPlayerToTeam = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");
    const { playerId } = req.body;

    if (!playerId) throw new ApiError(400, "Player ID is required");

    const team = await Team.findById(teamId);
    if (!team) throw new ApiError(404, "Team not found");
    if (!userCanManageTeam(req.user, team)) {
        throw new ApiError(403, "Not authorized to update this team");
    }

    if (team.players.includes(playerId)) {
        throw new ApiError(400, "Player already in the team");
    }

    team.players.push(playerId);
    await team.save();

    return res.status(200).json(
        new ApiResponse(200, team, "Player added to team successfully")
    );
});

// ---------------------------------
// REMOVE PLAYER FROM TEAM (Team Creator/Admin Only)
// ---------------------------------
const removePlayerFromTeam = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");
    const { playerId } = req.body;

    if (!playerId) throw new ApiError(400, "Player ID is required");

    const team = await Team.findById(teamId);
    if (!team) throw new ApiError(404, "Team not found");
    if (!userCanManageTeam(req.user, team)) {
        throw new ApiError(403, "Not authorized to update this team");
    }

    team.players = team.players.filter(p => p.toString() !== playerId.toString());
    await team.save();

    return res.status(200).json(
        new ApiResponse(200, team, "Player removed from team successfully")
    );
});

// ---------------------------------
// DELETE TEAM (Team Creator/Admin Only)
// ---------------------------------
const deleteTeam = asyncHandler(async (req, res) => {
    const teamId = getParamId(req, "teamId");

    const team = await Team.findById(teamId);
    if (!team) throw new ApiError(404, "Team not found");
    if (!userCanManageTeam(req.user, team)) {
        throw new ApiError(403, "Not authorized to delete this team");
    }

    await team.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Team deleted successfully")
    );
});

export {
    getAllTeams,
    getTeamById,
    createTeam,
    updateTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    deleteTeam
};
