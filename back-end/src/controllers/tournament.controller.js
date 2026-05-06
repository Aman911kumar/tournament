import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Tournament } from '../models/tournament.model.js';
import { Team } from '../models/team.model.js';
import { Match } from '../models/match.model.js';
import { Channel } from '../models/channel.model.js';
import { Registration } from '../models/registration.model.js';
import { Wallet } from '../models/wallet.model.js';
import { WalletTransaction } from '../models/walletTransaction.model.js';
import { Ledger } from '../models/ledger.model.js';
import { GameAccount } from '../models/gameAccount.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import { calculateFeeSplit, getPlatformFeePercent, roundCurrency } from '../utils/money.js';
import { applyPrizeSettings, assignTournamentResults, updatePrizePool } from '../services/tournamentPrize.service.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from "uuid";

const getParamId = (req, key) => req.params[key] || req.params.id;

const parseDate = (value, fieldName) => {
    const date = new Date(value);

    if (!value || Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${fieldName} must be a valid date`);
    }

    return date;
};

const parseOptionalDate = (value, fieldName) => {
    if (value === undefined || value === null || value === "") return undefined;
    return parseDate(value, fieldName);
};

const normalizeStatus = (status) => {
    const statusMap = {
        upcoming: "open",
        ongoing: "running",
        finished: "completed"
    };

    return statusMap[status] || status;
};

const formatDateTime = (date) =>
    new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    }).format(date);

const isTerminalStatus = (status) => status === "completed" || status === "cancelled";

const resolveLifecycleStatus = (tournament, now = new Date()) => {
    if (isTerminalStatus(tournament.status)) return tournament.status;

    const startAt = tournament.startAt ? new Date(tournament.startAt) : null;
    const endAt = tournament.endAt ? new Date(tournament.endAt) : null;
    const registrationStart = tournament.registrationStart ? new Date(tournament.registrationStart) : null;

    if (endAt && now >= endAt) return "completed";
    if (tournament.status === "running") return "running";
    if (startAt && now >= startAt) return "running";
    if (tournament.status === "draft" && registrationStart && now >= registrationStart) return "open";

    return tournament.status;
};

const syncTournamentLifecycle = async (tournament, options = {}) => {
    const nextStatus = resolveLifecycleStatus(tournament);
    if (nextStatus !== tournament.status) {
        tournament.status = nextStatus;
        if (options.save) await tournament.save();
    }
    return tournament;
};

const getRegistrationWindow = (tournament, now = new Date()) => {
    const registrationStart = new Date(tournament.registrationStart);
    const registrationEnd = new Date(tournament.registrationEnd);

    if (Number.isNaN(registrationStart.getTime()) || Number.isNaN(registrationEnd.getTime())) {
        throw new ApiError(400, "Tournament registration schedule is invalid");
    }

    if (now < registrationStart) {
        return {
            isOpen: false,
            message: `Tournament registration opens at ${formatDateTime(registrationStart)}`
        };
    }

    if (now > registrationEnd) {
        return {
            isOpen: false,
            message: `Tournament registration window is closed. It closed at ${formatDateTime(registrationEnd)}`
        };
    }

    return { isOpen: true };
};

const validateTournamentSchedule = ({ startAt, endAt, registrationStart, registrationEnd }) => {
    if (registrationEnd <= registrationStart) {
        throw new ApiError(400, "Registration close time must be after registration open time");
    }

    if (startAt <= registrationEnd) {
        throw new ApiError(400, "Start date must be after registration end date");
    }

    if (endAt && endAt <= startAt) {
        throw new ApiError(400, "End date must be after start date");
    }
};

const normalizeRoomDetails = (details = {}) => {
    details = details || {};
    const roomJoinTime = parseOptionalDate(details.roomJoinTime || details.joinTime || details.customRoomJoinTime, "roomJoinTime");
    return {
        roomId: details.roomId?.trim?.() || "",
        roomPass: details.roomPass?.trim?.() || "",
        ...(roomJoinTime ? { roomJoinTime } : {})
    };
};

const validateRoomJoinTime = (roomDetails, startAt) => {
    if (roomDetails?.roomJoinTime && startAt && roomDetails.roomJoinTime > startAt) {
        throw new ApiError(400, "Room join time must be before match start time");
    }
};

const GAME_ALIASES = {
    freefire: "freefire",
    ff: "freefire",
    "free-fire": "freefire",
    bgmi: "bgmi",
    pubg: "bgmi",
    callofduty: "callofduty",
    cod: "callofduty",
    codm: "callofduty",
    "call-of-duty": "callofduty",
    valorant: "valorant"
};

const GAME_PRESETS = {
    freefire: { gameMode: "battle_royale", type: "squad", teamSize: 4, defaultTeams: 12, platform: "mobile", perspective: "tpp" },
    bgmi: { gameMode: "classic", type: "squad", teamSize: 4, defaultTeams: 16, platform: "mobile", perspective: "tpp" },
    callofduty: { gameMode: "battle_royale", type: "squad", teamSize: 4, defaultTeams: 16, platform: "mobile", perspective: "tpp" },
    valorant: { gameMode: "competitive", type: "team", teamSize: 5, defaultTeams: 8, platform: "pc", perspective: "na" }
};

const normalizeGame = (game) => {
    const key = String(game || "freefire").toLowerCase().trim().replace(/\s+/g, "").replace(/_/g, "-");
    const normalized = GAME_ALIASES[key];
    if (!normalized) {
        throw new ApiError(400, "Game must be Free Fire, BGMI, Call of Duty, or Valorant");
    }
    return normalized;
};

const normalizeType = (type, teamSize) => {
    if (type) return type;
    if (teamSize === 1) return "solo";
    if (teamSize === 2) return "duo";
    if (teamSize === 4) return "squad";
    return "team";
};

const userCanManageTournament = (user, tournament) => {
    return hasRole(user, "admin") || tournament.organizer?.toString() === user._id.toString();
};

const getGameAccountKey = (game) => game === "callofduty" ? "cod" : game;

const buildGameAccountSnapshot = (account) => ({
    user: account.user,
    game: account.game,
    inGameName: account.inGameName,
    gameId: account.gameId,
    level: account.level,
    verified: account.verified
});

const getParticipantStats = async (tournamentIds) => {
    if (!tournamentIds.length) return new Map();

    const stats = await Registration.aggregate([
        {
            $match: {
                tournament: { $in: tournamentIds.map((id) => new mongoose.Types.ObjectId(id)) },
                status: { $ne: "cancelled" }
            }
        },
        {
            $project: {
                tournament: 1,
                paidAmount: { $ifNull: ["$paidAmount", 0] },
                platformFee: { $ifNull: ["$platformFee", 0] },
                organizerAmount: { $ifNull: ["$organizerAmount", 0] },
                playerCount: {
                    $cond: [
                        { $gt: [{ $size: { $ifNull: ["$team", []] } }, 0] },
                        { $size: { $ifNull: ["$team", []] } },
                        1
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$tournament",
                registrationCount: { $sum: 1 },
                participantCount: { $sum: "$playerCount" },
                paidAmount: { $sum: "$paidAmount" },
                platformFeeAmount: { $sum: "$platformFee" },
                organizerEarnings: { $sum: "$organizerAmount" }
            }
        }
    ]);

    return new Map(stats.map((item) => [item._id.toString(), item]));
};

const getResultRegistrationDetails = async (tournamentIds) => {
    if (!tournamentIds.length) return new Map();

    const registrations = await Registration.find({
        tournament: { $in: tournamentIds },
        status: { $in: ["paid", "confirmed"] }
    }).select("tournament user team paidAmount gameAccounts");

    const details = new Map();
    registrations.forEach((registration) => {
        const tournamentId = registration.tournament?.toString();
        const users = [
            registration.user?.toString?.(),
            ...(registration.team || []).map((member) => member?.toString?.())
        ].filter(Boolean);

        users.forEach((userId) => {
            const account = (registration.gameAccounts || []).find((item) => item.user?.toString?.() === userId)
                || registration.gameAccounts?.[0]
                || null;
            details.set(`${tournamentId}:${userId}`, {
                gameName: account?.inGameName || "",
                gameId: account?.gameId || ""
            });
        });
    });

    return details;
};

const serializeTournament = (tournament, participantStats = new Map(), resultDetails = new Map()) => {
    const plain = tournament?.toObject?.() || tournament;
    const stats = participantStats.get(plain._id?.toString?.() || String(plain._id)) || {};
    const receivedMoney = Number(plain.organizerEarnings || stats.organizerEarnings || 0);
    const platformFeeAmount = Number(plain.platformFeeAmount || stats.platformFeeAmount || 0);
    const paidMoney = (plain.results || []).reduce((sum, result) => sum + Number(result.prizeWon || 0), 0);
    const tournamentId = plain._id?.toString?.() || String(plain._id);
    const results = (plain.results || []).map((result) => {
        const playerId = result.player?._id?.toString?.() || result.player?.toString?.() || String(result.player || "");
        const detail = resultDetails.get(`${tournamentId}:${playerId}`) || {};
        return {
            ...result,
            gameName: detail.gameName || "",
            gameId: detail.gameId || "",
            paidAmount: Number(result.prizeWon || 0)
        };
    });

    return {
        ...plain,
        results,
        organizerEarnings: receivedMoney,
        platformFeeAmount,
        receivedMoney,
        paidMoney,
        registrationCount: stats.registrationCount || 0,
        participantCount: stats.participantCount || 0
    };
};

const buildTournamentPayload = (body, organizerId, channelId = null) => {
    const startAt = parseDate(body.startAt || body.startDate, "startAt");
    const endAt = parseOptionalDate(body.endAt || body.endDate, "endAt");
    const now = new Date();

    let registrationEnd = body.registrationEnd
        ? parseDate(body.registrationEnd, "registrationEnd")
        : new Date(startAt.getTime() - 10 * 60 * 1000);

    let registrationStart = body.registrationStart
        ? parseDate(body.registrationStart, "registrationStart")
        : now;

    validateTournamentSchedule({ startAt, endAt, registrationStart, registrationEnd });
    if (registrationEnd <= now) {
        throw new ApiError(400, "Registration close time must be in the future");
    }

    if (!body.title || body.title.trim() === "") {
        throw new ApiError(400, "Tournament title is required");
    }

    const game = normalizeGame(body.game);
    const preset = GAME_PRESETS[game];
    const teamSize = Number(body.teamSize || preset.teamSize);
    const maxPlayersInput = body.maxPlayers ? Number(body.maxPlayers) : null;
    const maxTeams = Number(body.maxTeams || (maxPlayersInput ? Math.ceil(maxPlayersInput / teamSize) : preset.defaultTeams || 2));
    const maxPlayers = Number(maxPlayersInput || maxTeams * teamSize);

    const roomDetails = normalizeRoomDetails(body.room_details);
    validateRoomJoinTime(roomDetails, startAt);

    const payload = {
        title: body.title.trim(),
        description: body.description,
        game,
        gameMode: body.gameMode || preset.gameMode,
        mapName: body.mapName || "",
        platform: body.platform || preset.platform,
        perspective: body.perspective || preset.perspective,
        organizer: organizerId,
        channel: channelId,
        type: normalizeType(body.type, teamSize),
        startAt,
        endAt,
        registrationStart,
        registrationEnd,
        maxPlayers,
        maxTeams,
        teamSize,
        entryFee: Number(body.entryFee || 0),
        platformFeePercent: Number(body.platformFeePercent ?? getPlatformFeePercent("TOURNAMENT_ENTRY")),
        joinedPlayers: [],
        prizePool: 0,
        rules: body.rules,
        status: normalizeStatus(body.status) || (registrationStart > now ? "draft" : "open"),
        room_details: roomDetails
    };

    const distributionInput = Array.isArray(body.prizeDistribution)
        ? body.prizeDistribution
        : Array.isArray(body.prizePool?.distribution)
            ? body.prizePool.distribution
            : [];

    applyPrizeSettings(payload, {
        prizeMode: body.prizeMode,
        killPrizeAmount: body.killPrizeAmount,
        prizeDistribution: distributionInput
    });

    return payload;
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
    if (!status && req.query.excludeCompleted === "true") query.status = { $ne: "completed" };
    if (game) query.game = normalizeGame(game);
    if (req.query.entryFee === "0") query.entryFee = 0;
    if (organizer && mongoose.Types.ObjectId.isValid(organizer)) query.organizer = organizer;
    if (channel && mongoose.Types.ObjectId.isValid(channel)) query.channel = channel;

    const tournaments = await Tournament.find(query)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .populate("results.player", "username avatar")
        .sort({ createdAt: -1, startAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));
    const syncedTournaments = await Promise.all(
        tournaments.map((tournament) => syncTournamentLifecycle(tournament, { save: true }))
    );
    const participantStats = await getParticipantStats(syncedTournaments.map((tournament) => tournament._id));
    const resultDetails = await getResultRegistrationDetails(syncedTournaments.map((tournament) => tournament._id));

    const total = await Tournament.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { tournaments: syncedTournaments.map((tournament) => serializeTournament(tournament, participantStats, resultDetails)), total }, "Tournaments fetched successfully")
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
        .populate("channel", "name handle avatar")
        .populate("results.player", "username avatar");

    if (!tournament) throw new ApiError(404, "Tournament not found");
    await syncTournamentLifecycle(tournament, { save: true });
    const participantStats = await getParticipantStats([tournament._id]);
    const resultDetails = await getResultRegistrationDetails([tournament._id]);

    return res.status(200).json(
        new ApiResponse(200, serializeTournament(tournament, participantStats, resultDetails), "Tournament fetched successfully")
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
        new ApiResponse(201, serializeTournament(tournament), "Tournament created successfully")
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
    if (Object.prototype.hasOwnProperty.call(updates, "room_details")) updates.room_details = normalizeRoomDetails(updates.room_details);
    if (Object.prototype.hasOwnProperty.call(updates, "startAt")) updates.startAt = parseDate(updates.startAt, "startAt");
    if (Object.prototype.hasOwnProperty.call(updates, "registrationStart")) updates.registrationStart = parseDate(updates.registrationStart, "registrationStart");
    if (Object.prototype.hasOwnProperty.call(updates, "registrationEnd")) updates.registrationEnd = parseDate(updates.registrationEnd, "registrationEnd");
    if (Object.prototype.hasOwnProperty.call(updates, "endAt")) updates.endAt = parseOptionalDate(updates.endAt, "endAt");
    if (updates.teamSize) updates.teamSize = Number(updates.teamSize);
    if (updates.maxTeams) updates.maxTeams = Number(updates.maxTeams);
    if (updates.maxPlayers) updates.maxPlayers = Number(updates.maxPlayers);
    if (!updates.maxPlayers && (updates.teamSize || updates.maxTeams)) {
        updates.maxPlayers = Number(updates.maxTeams || tournament.maxTeams || 1) * Number(updates.teamSize || tournament.teamSize || 1);
    }

    const distributionInput = Array.isArray(updates.prizeDistribution)
        ? updates.prizeDistribution
        : Array.isArray(updates.prizePool?.distribution)
            ? updates.prizePool.distribution
            : null;
    const hasPrizeSettings =
        distributionInput !== null ||
        Object.prototype.hasOwnProperty.call(updates, "prizeMode") ||
        Object.prototype.hasOwnProperty.call(updates, "killPrizeAmount");
    if (hasPrizeSettings) {
        applyPrizeSettings(tournament, {
            prizeMode: updates.prizeMode ?? tournament.prizeMode,
            killPrizeAmount: updates.killPrizeAmount ?? tournament.killPrizeAmount,
            prizeDistribution: distributionInput ?? tournament.prizeDistribution
        });
        delete updates.prizeMode;
        delete updates.killPrizeAmount;
        delete updates.prizeDistribution;
        delete updates.prizePool;
    }

    validateTournamentSchedule({
        startAt: updates.startAt || tournament.startAt,
        endAt: Object.prototype.hasOwnProperty.call(updates, "endAt") ? updates.endAt : tournament.endAt,
        registrationStart: updates.registrationStart || tournament.registrationStart,
        registrationEnd: updates.registrationEnd || tournament.registrationEnd
    });
    validateRoomJoinTime(
        Object.prototype.hasOwnProperty.call(updates, "room_details") ? updates.room_details : tournament.room_details,
        updates.startAt || tournament.startAt
    );

    const allowedFields = [
        "title",
        "description",
        "game",
        "gameMode",
        "mapName",
        "platform",
        "perspective",
        "type",
        "startAt",
        "endAt",
        "registrationStart",
        "registrationEnd",
        "maxPlayers",
        "maxTeams",
        "teamSize",
        "entryFee",
        "platformFeePercent",
        "rules",
        "status",
        "room_details"
    ];

    allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            tournament[field] = updates[field];
        }
    });

    updatePrizePool(tournament);
    await tournament.save();
    await syncTournamentLifecycle(tournament, { save: true });
    const participantStats = await getParticipantStats([tournament._id]);

    return res.status(200).json(
        new ApiResponse(200, serializeTournament(tournament, participantStats), "Tournament updated successfully")
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

    const hasPaidRegistrations = await Registration.exists({
        tournament: tournamentId,
        status: { $in: ["paid", "confirmed"] },
        paidAmount: { $gt: 0 }
    });

    if (hasPaidRegistrations && !hasRole(req.user, "admin")) {
        throw new ApiError(400, "Tournament has paid registrations and cannot be deleted by creator");
    }

    await Match.deleteMany({ tournament: tournamentId });
    await Team.deleteMany({ tournament: tournamentId });
    await Registration.deleteMany({ tournament: tournamentId });
    await tournament.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Tournament deleted successfully")
    );
});

// ---------------------------------
// REGISTER USER TO TOURNAMENT
// ---------------------------------
const joinTournament = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const { slotNumber, teamName, players = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");
    await syncTournamentLifecycle(tournament, { save: true });
    if (tournament.status !== "open") throw new ApiError(400, "Tournament registration is not open");

    const registrationWindow = getRegistrationWindow(tournament);
    if (!registrationWindow.isOpen) {
        throw new ApiError(400, registrationWindow.message);
    }
    // if (tournament.organizer.toString() === req.user._id.toString()) {
    //     throw new ApiError(400, "Organizers cannot join their own tournament");
    // }

    const existing = await Registration.findOne({
        tournament: tournamentId,
        $or: [
            { user: req.user._id, status: { $ne: "cancelled" } },
            { team: req.user._id, status: { $ne: "cancelled" } }
        ]
    });
    if (existing) throw new ApiError(400, "You are already registered for this tournament");

    const activeRegistrations = await Registration.countDocuments({
        tournament: tournamentId,
        status: { $in: ["paid", "confirmed"] }
    });
    if (activeRegistrations >= tournament.maxPlayers) {
        throw new ApiError(400, "Tournament has reached max player limit");
    }

    const requestedSlot = Number(slotNumber || 0);
    if (requestedSlot > 0) {
        if (requestedSlot > tournament.maxPlayers) throw new ApiError(400, "Selected slot is outside tournament capacity");
        const slotTaken = await Registration.exists({
            tournament: tournamentId,
            slotNumber: requestedSlot,
            status: { $in: ["paid", "confirmed"] }
        });
        if (slotTaken) throw new ApiError(400, "Selected slot is already taken");
    }

    const memberIds = Array.isArray(players) && players.length > 0 ? players : [req.user._id];
    const accountGame = getGameAccountKey(tournament.game);
    const gameAccounts = await GameAccount.find({
        user: { $in: memberIds },
        game: accountGame
    });
    const accountByUser = new Map(gameAccounts.map((account) => [account.user.toString(), account]));
    const missingGameAccount = memberIds.find((userId) => !accountByUser.has(userId.toString()));
    if (missingGameAccount) {
        throw new ApiError(400, `Required ${tournament.game} game account is not linked`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const entryFee = Number(tournament.entryFee || 0);
        const entryFeePercent = Number(tournament.platformFeePercent ?? getPlatformFeePercent("TOURNAMENT_ENTRY"));
        const { platformFee, netAmount: organizerAmount } = calculateFeeSplit(entryFee, entryFeePercent);
        let paymentRef = null;

        if (entryFee > 0) {
            const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
            if (!wallet) throw new ApiError(404, "Wallet not found");
            if (wallet.balance < entryFee) throw new ApiError(400, "Insufficient wallet balance");

            const before = wallet.balance;
            wallet.balance = before - entryFee;
            wallet.lastTransactionAt = new Date();
            await wallet.save({ session });

            const debitTx = await WalletTransaction.create([{
                transactionId: uuidv4(),
                user: req.user._id,
                walletId: wallet._id,
                type: "DEBIT",
                category: "TOURNAMENT_ENTRY",
                amount: entryFee,
                grossAmount: entryFee,
                platformFee,
                netAmount: organizerAmount,
                balanceBefore: before,
                balanceAfter: wallet.balance,
                status: "SUCCESS",
                referenceId: tournamentId,
                fromUser: req.user._id,
                toUser: tournament.organizer,
                description: `Entry fee for ${tournament.title}`,
                metadata: { tournament: tournamentId, platformFee, organizerAmount, feePercent: entryFeePercent }
            }], { session, ordered: true });

            paymentRef = debitTx[0].transactionId;

            let organizerTx = null;
            if (organizerAmount > 0) {
                const organizerWallet = await Wallet.findOne({ user: tournament.organizer }).session(session);
                if (!organizerWallet) throw new ApiError(404, "Organizer wallet not found");

                const organizerBefore = organizerWallet.balance;
                organizerWallet.balance = organizerBefore + organizerAmount;
                organizerWallet.lastTransactionAt = new Date();
                await organizerWallet.save({ session });

                organizerTx = await WalletTransaction.create([{
                    transactionId: uuidv4(),
                    user: tournament.organizer,
                    walletId: organizerWallet._id,
                    type: "CREDIT",
                    category: "ORGANIZER_EARNING",
                    amount: organizerAmount,
                    grossAmount: entryFee,
                    platformFee,
                    netAmount: organizerAmount,
                    balanceBefore: organizerBefore,
                    balanceAfter: organizerWallet.balance,
                    status: "SUCCESS",
                    referenceId: tournamentId,
                    fromUser: req.user._id,
                    toUser: tournament.organizer,
                    description: `Organizer earning from ${tournament.title}`,
                    metadata: { tournament: tournamentId, player: req.user._id, platformFee, feePercent: entryFeePercent }
                }], { session, ordered: true });
            }

            await Ledger.create([
                ...(organizerAmount > 0 ? [{
                    transactionId: debitTx[0].transactionId,
                    debitAccount: "USER_WALLET",
                    creditAccount: "ORGANIZER_WALLET",
                    fromUser: req.user._id,
                    toUser: tournament.organizer,
                    category: "TOURNAMENT_ENTRY",
                    referenceId: tournamentId,
                    amount: organizerAmount,
                    currency: "INR",
                    platformFee,
                    netAmount: organizerAmount,
                    status: "SUCCESS",
                    metadata: { tournament: tournamentId, organizerTransactionId: organizerTx?.[0]?.transactionId, feePercent: entryFeePercent }
                }] : []),
                ...(platformFee > 0 ? [{
                    transactionId: debitTx[0].transactionId,
                    debitAccount: "USER_WALLET",
                    creditAccount: "PLATFORM_FEE",
                    fromUser: req.user._id,
                    toUser: null,
                    category: "TOURNAMENT_ENTRY_FEE",
                    referenceId: tournamentId,
                    amount: platformFee,
                    currency: "INR",
                    platformFee,
                    netAmount: 0,
                    status: "SUCCESS",
                    metadata: { tournament: tournamentId, feePercent: entryFeePercent }
                }] : [])
            ].filter(Boolean), { session, ordered: true });

            tournament.platformFeeAmount = Number(tournament.platformFeeAmount || 0) + platformFee;
            tournament.organizerEarnings = Number(tournament.organizerEarnings || 0) + organizerAmount;
            await tournament.save({ session });
        }

        const registrationArr = await Registration.create([{
            tournament: tournamentId,
            user: tournament.type === "solo" ? req.user._id : undefined,
            team: tournament.type === "solo" ? [] : memberIds,
            slotNumber: requestedSlot > 0 ? requestedSlot : null,
            status: entryFee > 0 ? "paid" : "confirmed",
            paidAmount: entryFee,
            platformFee,
            organizerAmount,
            paymentRef,
            gameAccounts: memberIds.map((userId) => buildGameAccountSnapshot(accountByUser.get(userId.toString())))
        }], { session, ordered: true });

        const joinedPlayerIds = new Set((tournament.joinedPlayers || []).map((playerId) => playerId.toString()));
        memberIds.forEach((userId) => joinedPlayerIds.add(userId.toString()));
        tournament.joinedPlayers = Array.from(joinedPlayerIds).map((userId) => new mongoose.Types.ObjectId(userId));
        await tournament.save({ session });

        if (tournament.type !== "solo") {
            await Team.create([{
                name: teamName?.trim() || `${req.user.username}-${tournament._id}-${Date.now()}`,
                tournament: tournamentId,
                players: memberIds,
                createdBy: req.user._id
            }], { session, ordered: true });
        }

        await session.commitTransaction();

        return res.status(201).json(
            new ApiResponse(201, registrationArr[0], "Tournament registered successfully")
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

const getTournamentParticipants = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId).select("game");
    if (!tournament) throw new ApiError(404, "Tournament not found");

    const registrations = await Registration.find({
        tournament: tournamentId,
        status: { $ne: "cancelled" }
    })
        .populate("user", "username avatar")
        .populate("team", "username avatar")
        .sort({ slotNumber: 1, createdAt: 1 });

    const userIds = new Set();
    registrations.forEach((registration) => {
        if (registration.user?._id) userIds.add(registration.user._id.toString());
        registration.team?.forEach((member) => {
            if (member?._id) userIds.add(member._id.toString());
        });
    });

    const accountGame = getGameAccountKey(tournament.game);
    const gameAccounts = await GameAccount.find({
        user: { $in: Array.from(userIds) },
        game: accountGame
    }).select("user game inGameName gameId level verified");
    const gameAccountByUser = new Map(gameAccounts.map((account) => [account.user.toString(), account]));

    const registrationsWithGameAccounts = registrations.map((registration) => {
        const plain = registration.toObject();
        if (plain.user?._id) {
            plain.user.gameAccount = plain.gameAccounts?.find((account) => account.user?.toString?.() === plain.user._id.toString()) || gameAccountByUser.get(plain.user._id.toString()) || null;
        }
        if (Array.isArray(plain.team)) {
            plain.team = plain.team.map((member) => ({
                ...member,
                gameAccount: plain.gameAccounts?.find((account) => account.user?.toString?.() === member._id.toString()) || gameAccountByUser.get(member._id.toString()) || null
            }));
            plain.gameAccount = plain.team[0]?.gameAccount || null;
        } else {
            plain.gameAccount = plain.user?.gameAccount || null;
        }
        return plain;
    });

    return res.status(200).json(
        new ApiResponse(200, registrationsWithGameAccounts, "Participants fetched successfully")
    );
});

const getMyTournamentRegistrations = asyncHandler(async (req, res) => {
    const registrations = await Registration.find({
        status: { $ne: "cancelled" },
        $or: [
            { user: req.user._id },
            { team: req.user._id }
        ]
    })
        .populate({
            path: "tournament",
            populate: [
                { path: "organizer", select: "username avatar stats" },
                { path: "channel", select: "name handle avatar" }
            ]
        })
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, registrations, "Registered tournaments fetched successfully")
    );
});

const getRegistrationRecipient = (registration) => {
    if (registration.user?._id) return registration.user._id;
    if (registration.user) return registration.user;
    if (Array.isArray(registration.team) && registration.team[0]?._id) return registration.team[0]._id;
    if (Array.isArray(registration.team) && registration.team[0]) return registration.team[0];
    return null;
};

// ---------------------------------
// DISTRIBUTE PRIZE MONEY
// ---------------------------------
const distributeTournamentPrizes = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const resultRows = Array.isArray(req.body?.results)
        ? req.body.results
        : Array.isArray(req.body?.payouts)
            ? req.body.payouts
            : [];
    const requestedPrizeMode = ["position", "kill", "both"].includes(req.body?.payoutMode)
        ? req.body.payoutMode
        : undefined;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    if (resultRows.length === 0) {
        throw new ApiError(400, "Assign at least one tournament result");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");
    await syncTournamentLifecycle(tournament, { save: true });

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to distribute prizes for this tournament");
    }
    if (tournament.status !== "completed") {
        throw new ApiError(400, "Mark the tournament as completed before distributing prizes");
    }

    if (Array.isArray(tournament.results) && tournament.results.length > 0) {
        const populatedTournament = await Tournament.findById(tournamentId).populate("results.player", "username avatar");
        return res.status(200).json(
            new ApiResponse(200, {
                tournament: populatedTournament,
                payoutTotal: tournament.results.reduce((sum, result) => sum + Number(result.prizeWon || 0), 0),
                transactions: []
            }, "Tournament prizes already distributed")
        );
    }

    const payoutMode = requestedPrizeMode || tournament.prizeMode || "position";
    const killPrizeAmount = req.body?.killPrizeAmount ?? tournament.killPrizeAmount;
    const normalizedResults = resultRows.map((row) => ({
        registrationId: row.registrationId ? String(row.registrationId) : "",
        position: row.position ?? row.place ?? null,
        kills: row.kills ?? 0,
        points: row.points ?? 0,
        playerId: row.playerId || row.player ? String(row.playerId || row.player) : "",
    }));

    const registrationIds = Array.from(new Set(normalizedResults.map((row) => row.registrationId).filter(Boolean)));
    const registrationMap = new Map();
    if (registrationIds.length > 0) {
        const registrations = await Registration.find({
            _id: { $in: registrationIds },
            tournament: tournamentId,
            status: { $in: ["paid", "confirmed"] }
        });

        if (registrations.length !== registrationIds.length) {
            throw new ApiError(400, "One or more selected participants are not registered for this tournament");
        }

        registrations.forEach((registration) => {
            registrationMap.set(registration._id.toString(), registration);
        });
    }

    const resultInput = normalizedResults.map((row) => {
        const registration = row.registrationId ? registrationMap.get(row.registrationId) : null;
        const player = row.playerId || (registration ? getRegistrationRecipient(registration)?.toString() : "");
        return { position: row.position, playerId: player, kills: row.kills, points: row.points };
    });

    assignTournamentResults(tournament, resultInput, { prizeMode: payoutMode, killPrizeAmount });
    const normalizedPayouts = tournament.results.map((result) => ({
        place: Number(result.position),
        recipient: result.player,
        amount: Number(result.prizeWon || 0),
        kills: Number(result.kills || 0),
        points: Number(result.points || 0),
        positionPrizeWon: Number(result.positionPrizeWon || 0),
        killPrizeWon: Number(result.killPrizeWon || 0),
        prizeMode: result.prizeMode || payoutMode,
    }));
    const payoutTotal = normalizedPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const transferFeePercent = getPlatformFeePercent("TRANSFER");
    const { platformFee: transferPlatformFee } = calculateFeeSplit(payoutTotal, transferFeePercent);
    const organizerDebitAmount = roundCurrency(payoutTotal + transferPlatformFee);
    const winningFeePercent = getPlatformFeePercent("WINNING");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const organizerWallet = await Wallet.findOne({ user: tournament.organizer }).session(session);
        if (!organizerWallet) throw new ApiError(404, "Organizer wallet not found");
        if (organizerWallet.balance < organizerDebitAmount) {
            throw new ApiError(400, "Organizer wallet does not have enough balance for prize payouts");
        }

        const organizerBefore = organizerWallet.balance;
        organizerWallet.balance = organizerBefore - organizerDebitAmount;
        organizerWallet.lastTransactionAt = new Date();
        await organizerWallet.save({ session });

        const payoutRef = uuidv4();
        const organizerDebitTx = await WalletTransaction.create([{
            transactionId: uuidv4(),
            user: tournament.organizer,
            walletId: organizerWallet._id,
            type: "DEBIT",
            category: "TRANSFER",
            amount: organizerDebitAmount,
            grossAmount: organizerDebitAmount,
            platformFee: transferPlatformFee,
            netAmount: payoutTotal,
            balanceBefore: organizerBefore,
            balanceAfter: organizerWallet.balance,
            status: "SUCCESS",
            referenceId: tournamentId,
            fromUser: tournament.organizer,
            description: `Prize distribution for ${tournament.title}`,
            metadata: { tournament: tournamentId, prizePayout: true, payoutRef, payoutCount: normalizedPayouts.length, payoutMode, feePercent: transferFeePercent }
        }], { session, ordered: true });

        const transactions = [];
        const ledgerEntries = [];
        if (transferPlatformFee > 0) {
            ledgerEntries.push({
                transactionId: organizerDebitTx[0].transactionId,
                debitAccount: "ORGANIZER_WALLET",
                creditAccount: "PLATFORM_FEE",
                fromUser: tournament.organizer,
                toUser: null,
                category: "TRANSFER_FEE",
                referenceId: tournamentId,
                amount: transferPlatformFee,
                currency: "INR",
                platformFee: transferPlatformFee,
                netAmount: 0,
                status: "SUCCESS",
                metadata: { tournament: tournamentId, prizePayout: true, payoutRef, payoutMode, feePercent: transferFeePercent }
            });
        }

        for (const payout of normalizedPayouts) {
            const winnerWallet = await Wallet.findOne({ user: payout.recipient }).session(session);
            if (!winnerWallet) throw new ApiError(404, "Winner wallet not found");

            const { platformFee: winningPlatformFee, netAmount: winningNetAmount } = calculateFeeSplit(payout.amount, winningFeePercent);
            const before = winnerWallet.balance;
            winnerWallet.balance = before + winningNetAmount;
            winnerWallet.lastTransactionAt = new Date();
            await winnerWallet.save({ session });

            const tx = await WalletTransaction.create([{
                transactionId: uuidv4(),
                user: payout.recipient,
                walletId: winnerWallet._id,
                type: "CREDIT",
                category: "WINNING",
                amount: winningNetAmount,
                grossAmount: payout.amount,
                platformFee: winningPlatformFee,
                netAmount: winningNetAmount,
                balanceBefore: before,
                balanceAfter: winnerWallet.balance,
                status: "SUCCESS",
                referenceId: tournamentId,
                fromUser: tournament.organizer,
                toUser: payout.recipient,
                description: payout.prizeMode === "kill"
                    ? `${payout.kills} kill prize for ${tournament.title}`
                    : payout.prizeMode === "both"
                        ? `Position and kill prize for ${tournament.title}`
                        : `Place #${payout.place} prize for ${tournament.title}`,
                metadata: {
                    tournament: tournamentId,
                    place: payout.place,
                    kills: payout.kills,
                    points: payout.points,
                    payoutMode: payout.prizeMode,
                    positionPrizeWon: payout.positionPrizeWon,
                    killPrizeWon: payout.killPrizeWon,
                    prizePayout: true,
                    payoutRef,
                    feePercent: winningFeePercent
                }
            }], { session, ordered: true });

            transactions.push(tx[0]);
            ledgerEntries.push({
                transactionId: tx[0].transactionId,
                debitAccount: "ORGANIZER_WALLET",
                creditAccount: "USER_WALLET",
                fromUser: tournament.organizer,
                toUser: payout.recipient,
                category: "WINNING",
                referenceId: tournamentId,
                amount: winningNetAmount,
                currency: "INR",
                platformFee: winningPlatformFee,
                netAmount: winningNetAmount,
                status: "SUCCESS",
                metadata: {
                    tournament: tournamentId,
                    place: payout.place,
                    kills: payout.kills,
                    points: payout.points,
                    payoutMode: payout.prizeMode,
                    positionPrizeWon: payout.positionPrizeWon,
                    killPrizeWon: payout.killPrizeWon,
                    prizePayout: true,
                    payoutRef,
                    feePercent: winningFeePercent,
                    organizerDebitTransactionId: organizerDebitTx[0].transactionId
                }
            });
            if (winningPlatformFee > 0) {
                ledgerEntries.push({
                    transactionId: tx[0].transactionId,
                    debitAccount: "ORGANIZER_WALLET",
                    creditAccount: "PLATFORM_FEE",
                    fromUser: tournament.organizer,
                    toUser: null,
                    category: "WINNING_FEE",
                    referenceId: tournamentId,
                    amount: winningPlatformFee,
                    currency: "INR",
                    platformFee: winningPlatformFee,
                    netAmount: 0,
                    status: "SUCCESS",
                    metadata: {
                        tournament: tournamentId,
                        place: payout.place,
                        kills: payout.kills,
                        points: payout.points,
                        payoutMode: payout.prizeMode,
                        positionPrizeWon: payout.positionPrizeWon,
                        killPrizeWon: payout.killPrizeWon,
                        prizePayout: true,
                        payoutRef,
                        feePercent: winningFeePercent,
                        organizerDebitTransactionId: organizerDebitTx[0].transactionId
                    }
                });
            }
        }

        if (ledgerEntries.length > 0) {
            await Ledger.create(ledgerEntries, { session, ordered: true });
        }

        tournament.status = "completed";
        await tournament.save({ session });

        await session.commitTransaction();

        const populatedTournament = await Tournament.findById(tournamentId).populate("results.player", "username avatar");
        return res.status(200).json(
            new ApiResponse(200, { tournament: populatedTournament, payoutTotal, transactions, organizerTransaction: organizerDebitTx[0] }, "Prize money transferred successfully")
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
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
    joinTournament,
    getTournamentParticipants,
    getMyTournamentRegistrations,
    distributeTournamentPrizes,
    registerTeam,
    unregisterTeam
};
