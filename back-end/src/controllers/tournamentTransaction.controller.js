import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

import { giveWinning, joinTournament as debitTournamentEntry, refundEntry } from "../services/tournamentWallet.service.js";

const joinTournament = asyncHandler(async (req, res) => {
    const { tournamentId, entryFee } = req.body;

    if (!tournamentId || !entryFee) {
        throw new ApiError(400, "TournamentId and entryFee required");
    }

    const tx = await debitTournamentEntry({
        userId: req.user._id,
        entryFee,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                transaction: tx,
                tournamentId,
            },
            "Joined tournament successfully",
        )
    );
});

const distributeWinning = asyncHandler(async (req, res) => {
    const { user, amount, tournamentId } = req.body;

    if (!user || !amount) {
        throw new ApiError(400, "UserId and amount required");
    }

    const tx = await giveWinning({
        userId: user,
        amount,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                transaction: tx,
                tournamentId,
            },
            "Winning distributed",
        )
    );
});

const refundTournament = asyncHandler(async (req, res) => {
    const { user, amount, tournamentId } = req.body;

    if (!user || !amount) {
        throw new ApiError(400, "UserId and amount required");
    }

    const tx = await refundEntry({
        userId: user,
        amount,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                transaction: tx,
                tournamentId,
            },
            "Refund processed",
        )
    );
});

export {
    joinTournament,
    distributeWinning,
    refundTournament
}
