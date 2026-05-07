import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Leaderboard } from '../models/leaderboad.model.js';
import { Tournament } from '../models/tournament.model.js';
import mongoose from 'mongoose';

// ---------------------------------
// GET LEADERBOARD FOR A TOURNAMENT
// ---------------------------------
const getLeaderboard = asyncHandler(async (req, res) => {
    const { limit = 20, skip = 0, tournamentId } = req.query;

    const query = {};
    if (tournamentId) {
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            throw new ApiError(400, "Invalid tournament ID");
        }
        query.tournament = tournamentId;
    }

    const leaderboard = await Leaderboard.find(query)
        .populate("tournament", "title game status")
        .populate("entries.user", "username")
        .populate("entries.team", "name")
        .sort({ updatedAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    return res.status(200).json(
        new ApiResponse(200, leaderboard, "Leaderboard fetched successfully")
    );
});

const getLeaderboardByTournament = asyncHandler(async (req, res) => {
    const { tournamentId } = req.params;
    const { limit = 20, skip = 0, sortBy = "points" } = req.query;

    // Validate tournamentId
    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    // Ensure leaderboard exists for the tournament
    const leaderboardEntries = await Leaderboard.find({ tournament: tournamentId })
        .populate("team", "teamName members") // Include team details
        .populate("user", "username") // Include player details if solo
        .sort({ [sortBy]: -1 }) // Sort dynamically (default: highest points)
        .skip(Number(skip))
        .limit(Number(limit));

    // Optional: get tournament name
    const tournament = await Tournament.findById(tournamentId).select("title");
    
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                tournament: tournament?.title || "Unknown Tournament",
                totalEntries: leaderboardEntries.length,
                leaderboard: leaderboardEntries,
            },
            "Leaderboard fetched successfully"
        )
    );
});


const updateLeaderboard = asyncHandler(async (tournamentId) => {
    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId).select("results");
    if (!tournament?.results?.length) return;

    await Leaderboard.findOneAndUpdate(
        { tournament: tournamentId },
        {
            tournament: tournamentId,
            entries: tournament.results.map((result) => ({
                user: result.player,
                points: Number(result.points || 0),
                kills: Number(result.kills || 0),
                rank: Number(result.position || 0),
            })),
        },
        { upsert: true, new: true }
    );
});

// ---------------------------------
// GET TEAM RANK (Optional)
// ---------------------------------
const getTeamRank = asyncHandler(async (tournamentId, teamId) => {
    const leaderboard = await Leaderboard.find({ tournament: tournamentId }).sort({ points: -1 });

    let rank = 1;
    for (const entry of leaderboard) {
        if (entry.team.toString() === teamId.toString()) break;
        rank++;
    }
    return rank;
});

export {
    getLeaderboard,
    updateLeaderboard,
    getLeaderboardByTournament,
    getTeamRank
};
