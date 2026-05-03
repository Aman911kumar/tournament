import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

import { joinTournament, giveWinning, refundEntry } from "../services/tournamentWallet.service.js";

const joinTournament = asyncHandler(async (req, res) => {
    const { tournamentId, entryFee } = req.body;

    if (!tournamentId || !entryFee) {
        throw new ApiError("TournamentId and entryFee required", 400);
    }

    const tx = await tournamentWalletService.joinTournament({
        user: req.user._id,
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

    if (!userId || !amount) {
        throw new ApiError("UserId and amount required", 400);
    }

    const tx = await tournamentWalletService.giveWinning({
        user,
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
        throw new ApiError("UserId and amount required", 400);
    }

    const tx = await tournamentWalletService.refundEntry({
        user,
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