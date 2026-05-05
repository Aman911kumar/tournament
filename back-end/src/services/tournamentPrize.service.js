import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const ensureUnique = (items, key, message) => {
    const seen = new Set();
    for (const item of items) {
        const value = String(item[key]);
        if (seen.has(value)) throw new ApiError(400, message);
        seen.add(value);
    }
};

export const updatePrizePool = (tournament) => {
    tournament.prizeMode = ["position", "kill", "both"].includes(tournament.prizeMode) ? tournament.prizeMode : "position";
    tournament.killPrizeAmount = roundCurrency(tournament.killPrizeAmount || 0);

    if (Array.isArray(tournament.prizeDistribution) && tournament.prizeDistribution.length > 0) {
        tournament.prizeDistribution = tournament.prizeDistribution.map((row) => ({
            position: Number(row.position),
            prizeAmount: roundCurrency(row.prizeAmount),
        }));
    }

    tournament.prizePool = roundCurrency(
        (tournament.prizeDistribution || []).reduce((sum, row) => sum + Number(row.prizeAmount || 0), 0)
    );

    return tournament.prizePool;
};

export const applyPrizeSettings = (tournament, { prizeMode, killPrizeAmount, prizeDistribution } = {}) => {
    const mode = ["position", "kill", "both"].includes(prizeMode) ? prizeMode : "position";
    const killAmount = roundCurrency(killPrizeAmount || 0);
    const usesPositions = mode === "position" || mode === "both";
    const usesKills = mode === "kill" || mode === "both";

    if (usesKills && (!Number.isFinite(killAmount) || killAmount <= 0)) {
        throw new ApiError(400, "Kill based prize amount must be greater than zero");
    }

    tournament.prizeMode = mode;
    tournament.killPrizeAmount = usesKills ? killAmount : 0;

    if (usesPositions) {
        calculatePrizeDistribution(tournament, prizeDistribution);
    } else {
        tournament.prizeDistribution = [];
        tournament.prizePool = 0;
    }

    updatePrizePool(tournament);
    return tournament;
};

export const calculatePrizeDistribution = (tournament, distributionInput = []) => {
    if (!Array.isArray(distributionInput) || distributionInput.length === 0) {
        throw new ApiError(400, "Prize distribution is required");
    }

    const normalized = distributionInput.map((row) => ({
        position: Number(row.position ?? row.place),
        prizeAmount: roundCurrency(row.prizeAmount ?? row.amount),
    }));

    normalized.forEach((row) => {
        if (!Number.isInteger(row.position) || row.position < 1) {
            throw new ApiError(400, "Every prize position must be a positive number");
        }
        if (!Number.isFinite(row.prizeAmount) || row.prizeAmount <= 0) {
            throw new ApiError(400, "Every prize amount must be greater than zero");
        }
    });

    ensureUnique(normalized, "position", "Duplicate prize positions are not allowed");

    const totalPrizeAmount = roundCurrency(normalized.reduce((sum, row) => sum + row.prizeAmount, 0));
    tournament.prizeDistribution = normalized;
    tournament.prizePool = totalPrizeAmount;

    return tournament.prizeDistribution;
};

export const assignTournamentResults = (tournament, resultInput = []) => {
    if (!Array.isArray(resultInput) || resultInput.length === 0) {
        throw new ApiError(400, "At least one result is required");
    }

    const normalized = resultInput.map((row) => ({
        position: Number(row.position ?? row.place),
        player: String(row.playerId || row.player || ""),
    }));

    normalized.forEach((row) => {
        if (!Number.isInteger(row.position) || row.position < 1) {
            throw new ApiError(400, "Every result position must be a positive number");
        }
        if (!mongoose.Types.ObjectId.isValid(row.player)) {
            throw new ApiError(400, "Every result must include a valid player");
        }
    });

    ensureUnique(normalized, "position", "Duplicate result positions are not allowed");
    ensureUnique(normalized, "player", "One player cannot have multiple positions");

    const joinedPlayers = new Set((tournament.joinedPlayers || []).map((id) => id.toString()));
    const distributionByPosition = new Map(
        (tournament.prizeDistribution || []).map((row) => [Number(row.position), Number(row.prizeAmount || 0)])
    );

    tournament.results = normalized.map((row) => {
        if (!joinedPlayers.has(row.player)) {
            throw new ApiError(400, "Selected player has not joined this tournament");
        }
        if (!distributionByPosition.has(row.position)) {
            throw new ApiError(400, "Result position must exist in prize distribution");
        }

        return {
            position: row.position,
            player: row.player,
            prizeWon: distributionByPosition.get(row.position),
        };
    });

    return tournament.results;
};
