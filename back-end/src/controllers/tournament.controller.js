import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Tournament } from '../models/tournament.model.js';
import { Team } from '../models/team.model.js';
import { Channel } from '../models/channel.model.js';
import { ChannelSubscription } from '../models/channelSubscription.model.js';
import { Registration } from '../models/registration.model.js';
import { Wallet } from '../models/wallet.model.js';
import { WalletTransaction } from '../models/walletTransaction.model.js';
import { Ledger } from '../models/ledger.model.js';
import { GameAccount } from '../models/gameAccount.model.js';
import { Notification } from '../models/notification.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import { calculateFeeSplit, getPlatformFeePercent, roundCurrency } from '../utils/money.js';
import { applyPrizeSettings, assignTournamentResults, updatePrizePool } from '../services/tournamentPrize.service.js';
import { createNotification, createNotifications } from '../services/notification.service.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from "uuid";

const getParamId = (req, key) => req.params[key] || req.params.id;

const hasRealPhoneNumber = (user) => {
    const phoneNumber = String(user?.phone_number || "").trim();
    return Boolean(phoneNumber) && !/^(google|facebook):/i.test(phoneNumber);
};

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

const normalizeVisibility = (visibility) => {
    const value = String(visibility || "").trim().toLowerCase();
    return ["public", "private"].includes(value) ? value : undefined;
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

const hasRoomDetailsChanged = (before = {}, after = {}) => {
    const keys = ["roomId", "roomPass", "roomJoinTime"];
    return keys.some((key) => String(before?.[key] || "") !== String(after?.[key] || ""));
};

const notifyJoinedUsersAboutRoom = async (tournament) => {
    const plain = tournament?.toObject?.() || tournament;
    const room = plain.room_details || {};

    if (!room.roomId && !room.roomPass && !room.roomJoinTime) return;

    const registrations = await Registration.find({
        tournament: plain._id,
        status: { $in: ["paid", "confirmed"] }
    }).select("user team").lean();

    const recipients = new Set();
    registrations.forEach((registration) => {
        if (registration.user) recipients.add(registration.user.toString());
        (registration.team || []).forEach((member) => recipients.add(member.toString()));
    });

    if (recipients.size === 0) return;

    const credentialParts = [
        room.roomId ? `Room ID: ${room.roomId}` : "",
        room.roomPass ? `Pass: ${room.roomPass}` : "",
        room.roomJoinTime ? `Join: ${formatDateTime(new Date(room.roomJoinTime))}` : "",
    ].filter(Boolean);

    const notifications = [...recipients].map((user) => ({
            user,
            title: "Room ID and pass available",
            body: `${plain.title}: ${credentialParts.join(" | ")}`,
            type: "room",
            actionUrl: `/tournament/${plain._id}`,
            data: {
                tournament: plain._id,
                roomId: room.roomId || "",
                roomPass: room.roomPass || "",
                hasRoomPass: Boolean(room.roomPass),
                roomJoinTime: room.roomJoinTime || null,
            },
        }));

    await createNotifications(notifications).catch((error) => {
        console.error("Failed to notify joined users about room details:", error);
        return [];
    });

    return recipients.size;
};

const CANCEL_TOURNAMENT_CONFIRM_TEXT = "cancel";

const getRegistrationUsers = (registration) => [
    registration.user,
    ...(registration.team || [])
].filter(Boolean);

const getCancellationRecipient = (registration, entryTransactionByRef) => {
    const paymentRef = registration.paymentRef ? String(registration.paymentRef) : "";
    const entryTransaction = paymentRef ? entryTransactionByRef.get(paymentRef) : null;

    return entryTransaction?.user || registration.user || registration.team?.[0] || null;
};

const serializeTournament = (tournament, participantStats = new Map(), resultDetails = new Map(), options = {}) => {
    const plain = tournament?.toObject?.() || tournament;
    const stats = participantStats.get(plain._id?.toString?.() || String(plain._id)) || {};
    const receivedMoney = Number(plain.organizerEarnings || stats.organizerEarnings || 0);
    const platformFeeAmount = Number(plain.platformFeeAmount || stats.platformFeeAmount || 0);
    const paidMoney = (plain.results || []).reduce((sum, result) => sum + Number(result.prizeWon || 0), 0);
    const tournamentId = plain._id?.toString?.() || String(plain._id);
    const results = options.includeResults === false ? [] : (plain.results || []).map((result) => {
        const playerId = result.player?._id?.toString?.() || result.player?.toString?.() || String(result.player || "");
        const detail = resultDetails.get(`${tournamentId}:${playerId}`) || {};
        return {
            ...result,
            gameName: detail.gameName || "",
            gameId: detail.gameId || "",
            paidAmount: Number(result.prizeWon || 0)
        };
    });

    const serialized = {
        ...plain,
        results,
        visibility: plain.visibility || "public",
        organizerEarnings: receivedMoney,
        platformFeeAmount,
        receivedMoney,
        paidMoney,
        registrationCount: stats.registrationCount || 0,
        participantCount: stats.participantCount || 0,
        trendingScore: Number(
            (
                Number(plain.views || 0) * 0.5 +
                Number(stats.participantCount || stats.registrationCount || 0) * 8 +
                Number(plain.prizePool || 0) * 0.05 +
                (plain.status === "running" ? 120 : plain.status === "open" ? 80 : 0)
            ).toFixed(2)
        )
    };

    if (options.hideRoomCredentials && serialized.room_details) {
        serialized.room_details = {
            roomJoinTime: serialized.room_details.roomJoinTime,
            hasRoomId: Boolean(serialized.room_details.roomId),
            hasRoomPass: Boolean(serialized.room_details.roomPass),
        };
    }

    return serialized;
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
        visibility: normalizeVisibility(body.visibility) || (body.published === false ? "private" : "public"),
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
    const { limit = 20, page, skip = 0, search, status, game, organizer, channel, sort = "latest" } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const safeSkip = page ? (safePage - 1) * safeLimit : Math.max(Number(skip) || 0, 0);
    const includeResults = req.query.includeResults === "true";
    const includeAggregations = req.query.includeAggregations === "true";
    const query = {};
    const organizerId = organizer && mongoose.Types.ObjectId.isValid(organizer)
        ? new mongoose.Types.ObjectId(organizer)
        : null;
    const isOwnOrganizerView = Boolean(
        req.user && organizerId && organizerId.toString() === req.user._id.toString()
    );
    const canViewPrivateTournaments = isOwnOrganizerView;
    const canViewManagedDetails = canViewPrivateTournaments || hasRole(req.user, "admin");

    if (search && search.trim() !== "") {
        query.title = { $regex: search.trim(), $options: "i" };
    }

    if (status) {
        const normalizedStatus = normalizeStatus(status);
        query.status = !canViewPrivateTournaments && normalizedStatus === "draft" ? "__hidden__" : normalizedStatus;
    } else if (req.query.excludeCompleted === "true") {
        query.status = canViewPrivateTournaments ? { $nin: ["completed", "cancelled"] } : { $nin: ["completed", "cancelled", "draft"] };
    } else if (!canViewPrivateTournaments) {
        query.status = { $ne: "draft" };
    }
    if (!canViewPrivateTournaments) {
        query.$or = [{ visibility: { $exists: false } }, { visibility: "public" }];
    }
    if (game) query.game = normalizeGame(game);
    if (req.query.entryFee === "0") query.entryFee = 0;
    if (organizerId) query.organizer = organizerId;
    if (channel && mongoose.Types.ObjectId.isValid(channel)) query.channel = new mongoose.Types.ObjectId(channel);

    const sortMode = String(sort || "latest");
    const sortConfig = sortMode === "trending"
        ? { status: 1, views: -1, prizePool: -1, startAt: 1, createdAt: -1 }
        : sortMode === "prize_desc"
            ? { prizePool: -1, killPrizeAmount: -1, createdAt: -1 }
            : sortMode === "prize_asc"
                ? { prizePool: 1, killPrizeAmount: 1, createdAt: -1 }
                : { createdAt: -1, startAt: -1 };

    let tournamentQuery = Tournament.find(query)
        .populate("organizer", "username avatar stats")
        .populate("channel", "name handle avatar")
        .sort(sortConfig)
        .skip(safeSkip)
        .limit(safeLimit);

    if (includeResults) {
        tournamentQuery = tournamentQuery.populate("results.player", "username avatar");
    }

    const tournaments = await tournamentQuery;
    const syncedTournaments = await Promise.all(
        tournaments.map((tournament) => syncTournamentLifecycle(tournament, { save: true }))
    );
    const participantStats = await getParticipantStats(syncedTournaments.map((tournament) => tournament._id));
    const resultDetails = includeResults
        ? await getResultRegistrationDetails(syncedTournaments.map((tournament) => tournament._id))
        : new Map();

    const [total, statusCounts, gameCounts] = await Promise.all([
        Tournament.countDocuments(query),
        includeAggregations
            ? Tournament.aggregate([
                { $match: query },
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
            : Promise.resolve([]),
        includeAggregations
            ? Tournament.aggregate([
                { $match: query },
                { $group: { _id: "$game", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
            : Promise.resolve([])
    ]);

    return res.status(200).json(
        new ApiResponse(200, {
            tournaments: syncedTournaments.map((tournament) => serializeTournament(tournament, participantStats, resultDetails, { hideRoomCredentials: !canViewManagedDetails, includeResults })),
            total,
            page: page ? safePage : Math.floor(safeSkip / safeLimit) + 1,
            limit: safeLimit,
            pages: Math.ceil(total / safeLimit),
            hasMore: safeSkip + syncedTournaments.length < total,
            aggregations: {
                byStatus: statusCounts,
                byGame: gameCounts,
            }
        }, "Tournaments fetched successfully")
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
    const canManageTournament = Boolean(
        req.user &&
        (
            hasRole(req.user, "admin") ||
            tournament.organizer?._id?.toString?.() === req.user._id.toString() ||
            tournament.organizer?.toString?.() === req.user._id.toString()
        )
    );

    if (tournament.visibility === "private" && !canManageTournament) {
        throw new ApiError(404, "Tournament not found");
    }

    const participantStats = await getParticipantStats([tournament._id]);
    const resultDetails = await getResultRegistrationDetails([tournament._id]);
    let canViewRoomCredentials = false;

    if (req.user) {
        canViewRoomCredentials =
            canManageTournament ||
            Boolean(await Registration.exists({
                tournament: tournamentId,
                status: { $in: ["paid", "confirmed"] },
                $or: [{ user: req.user._id }, { team: req.user._id }]
            }));
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            serializeTournament(tournament, participantStats, resultDetails, { hideRoomCredentials: !canViewRoomCredentials }),
            "Tournament fetched successfully"
        )
    );
});

// ---------------------------------
// CREATE TOURNAMENT (Creator/Admin)
// ---------------------------------
const createTournament = asyncHandler(async (req, res) => {
    const creatorChannel = await Channel.findOne({ owner: req.user._id, isActive: true });
    const payload = buildTournamentPayload(req.body, req.user._id, creatorChannel?._id || null);
    const tournament = await Tournament.create(payload);
    await tournament.populate([
        { path: "organizer", select: "username avatar stats" },
        { path: "channel", select: "name handle avatar" },
    ]);

    await createNotification({
        user: req.user._id,
        title: "Tournament created",
        body: `${tournament.title} is now saved and ready to manage.`,
        type: "tournament",
        actionUrl: `/tournament/${tournament._id}`,
        data: {
            tournament: tournament._id,
            channel: creatorChannel?._id || null,
        },
        channels: { email: false, push: true, inApp: true },
    }).catch((error) => {
        console.error("Failed to notify tournament creator:", error);
    });

    if (creatorChannel && tournament.visibility === "public" && tournament.status !== "draft") {
        const subscriptions = await ChannelSubscription.find({
            channel: creatorChannel._id,
            notificationsEnabled: true,
            user: { $ne: req.user._id },
        }).select("user").lean();

        await createNotifications(subscriptions.map((subscription) => ({
            user: subscription.user,
            title: "New tournament from followed creator",
            body: `${creatorChannel.name || req.user.username} created ${tournament.title}. Join before slots fill.`,
            type: "creator",
            actionUrl: `/tournament/${tournament._id}`,
            data: {
                tournament: tournament._id,
                channel: creatorChannel._id,
                creator: req.user._id,
            },
        }))).catch((error) => {
            console.error("Failed to notify channel followers:", error);
        });
    }

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
    const previousRoomDetails = { ...(tournament.room_details?.toObject?.() || tournament.room_details || {}) };

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to update this tournament");
    }

    const updates = { ...req.body };

    if (updates.startDate && !updates.startAt) updates.startAt = updates.startDate;
    if (updates.endDate && !updates.endAt) updates.endAt = updates.endDate;
    if (updates.status) updates.status = normalizeStatus(updates.status);
    if (Object.prototype.hasOwnProperty.call(updates, "visibility")) {
        updates.visibility = normalizeVisibility(updates.visibility);
        if (!updates.visibility) throw new ApiError(400, "Visibility must be public or private");
    }
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

    if (updates.visibility === "private") {
        const joinedCount = await Registration.countDocuments({
            tournament: tournamentId,
            status: { $in: ["paid", "confirmed"] }
        });
        if (joinedCount > 0) {
            throw new ApiError(400, "Tournament has joined players and cannot be made private");
        }
    }

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
        "visibility",
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
    if (hasRoomDetailsChanged(previousRoomDetails, tournament.room_details)) {
        await notifyJoinedUsersAboutRoom(tournament);
    }
    const participantStats = await getParticipantStats([tournament._id]);

    return res.status(200).json(
        new ApiResponse(200, serializeTournament(tournament, participantStats), "Tournament updated successfully")
    );
});

const notifyTournamentRoomDetails = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to manage this tournament");
    }

    if (tournament.visibility === "private") {
        throw new ApiError(400, "Publish the tournament before sending room notifications");
    }

    if (["completed", "cancelled"].includes(tournament.status)) {
        throw new ApiError(400, "Room notifications are disabled for completed or cancelled tournaments");
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "room_details")) {
        const nextRoomDetails = normalizeRoomDetails(req.body.room_details);
        validateRoomJoinTime(nextRoomDetails, tournament.startAt);
        tournament.room_details = nextRoomDetails;
        await tournament.save();
    }

    const room = tournament.room_details || {};
    if (!room.roomId && !room.roomPass && !room.roomJoinTime) {
        throw new ApiError(400, "Add Room ID or password before sending notifications");
    }

    const notifiedCount = await notifyJoinedUsersAboutRoom(tournament);
    const participantStats = await getParticipantStats([tournament._id]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                tournament: serializeTournament(tournament, participantStats),
                notifiedCount,
            },
            notifiedCount > 0 ? "Room details sent to joined users" : "Room details saved. No joined users to notify yet"
        )
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

    await Team.deleteMany({ tournament: tournamentId });
    await Registration.deleteMany({ tournament: tournamentId });
    await tournament.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Tournament deleted successfully")
    );
});

// ---------------------------------
// CANCEL TOURNAMENT AND REFUND ENTRY FEES
// ---------------------------------
const cancelTournament = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const confirmation = String(req.body?.confirmation || "").trim().toLowerCase();
    const username = String(req.body?.username || "").trim();
    const expectedUsername = String(req.user?.username || "").trim();

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    if (!expectedUsername || username !== expectedUsername || confirmation !== CANCEL_TOURNAMENT_CONFIRM_TEXT) {
        throw new ApiError(400, `Type your username and "${CANCEL_TOURNAMENT_CONFIRM_TEXT}" to cancel this tournament`);
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");

    if (!userCanManageTournament(req.user, tournament)) {
        throw new ApiError(403, "Not authorized to cancel this tournament");
    }

    if (tournament.status === "cancelled") {
        throw new ApiError(400, "Tournament is already cancelled");
    }

    if ((tournament.results || []).some((result) => Number(result.prizeWon || 0) > 0)) {
        throw new ApiError(400, "Tournament prize payouts already exist and cannot be cancelled");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const activeRegistrations = await Registration.find({
            tournament: tournamentId,
            status: { $in: ["pending", "paid", "confirmed"] }
        }).session(session);

        const paymentRefs = activeRegistrations
            .map((registration) => registration.paymentRef)
            .filter(Boolean)
            .map(String);
        const entryTransactions = paymentRefs.length > 0
            ? await WalletTransaction.find({
                transactionId: { $in: paymentRefs },
                type: "DEBIT",
                category: "TOURNAMENT_ENTRY"
            }).select("transactionId user").session(session)
            : [];
        const entryTransactionByRef = new Map(
            entryTransactions.map((transaction) => [transaction.transactionId, transaction])
        );

        const refundRows = activeRegistrations
            .map((registration) => {
                const refundAmount = roundCurrency(registration.paidAmount || 0);
                const platformFee = roundCurrency(registration.platformFee || 0);
                const organizerAmount = roundCurrency(
                    registration.organizerAmount ?? Math.max(refundAmount - platformFee, 0)
                );
                const recipient = getCancellationRecipient(registration, entryTransactionByRef);

                return {
                    registration,
                    recipient,
                    refundAmount,
                    platformFee,
                    organizerAmount
                };
            })
            .filter((row) => row.refundAmount > 0);

        const missingRecipient = refundRows.find((row) => !row.recipient);
        if (missingRecipient) {
            throw new ApiError(400, "Could not find the original payer for one or more registrations");
        }

        const totalRefund = roundCurrency(refundRows.reduce((sum, row) => sum + row.refundAmount, 0));
        const totalPlatformFee = roundCurrency(refundRows.reduce((sum, row) => sum + row.platformFee, 0));
        const totalOrganizerAmount = roundCurrency(refundRows.reduce((sum, row) => sum + row.organizerAmount, 0));
        const cancellationRef = uuidv4();
        const now = new Date();
        let organizerDebitTransaction = null;
        const refundTransactions = [];

        if (totalRefund > 0) {
            const organizerWallet = await Wallet.findOne({ user: tournament.organizer }).session(session);
            if (!organizerWallet) throw new ApiError(404, "Organizer wallet not found");
            if (organizerWallet.balance < totalRefund) {
                throw new ApiError(400, "Creator wallet does not have enough balance to refund joined players");
            }

            const organizerBefore = organizerWallet.balance;
            organizerWallet.balance = roundCurrency(organizerBefore - totalRefund);
            organizerWallet.lastTransactionAt = now;
            await organizerWallet.save({ session });

            const organizerDebitArr = await WalletTransaction.create([{
                transactionId: uuidv4(),
                user: tournament.organizer,
                walletId: organizerWallet._id,
                type: "DEBIT",
                category: "REFUND",
                amount: totalRefund,
                grossAmount: totalRefund,
                platformFee: totalPlatformFee,
                netAmount: totalRefund,
                balanceBefore: organizerBefore,
                balanceAfter: organizerWallet.balance,
                status: "SUCCESS",
                referenceId: tournamentId,
                fromUser: tournament.organizer,
                description: `Tournament cancellation refunds for ${tournament.title}`,
                metadata: {
                    tournament: tournamentId,
                    cancellationRef,
                    refundCount: refundRows.length,
                    platformFeeCoveredByCreator: totalPlatformFee,
                    originalOrganizerAmount: totalOrganizerAmount
                }
            }], { session, ordered: true });
            organizerDebitTransaction = organizerDebitArr[0];

            const recipientIds = Array.from(new Set(refundRows.map((row) => row.recipient.toString())));
            const recipientWallets = await Wallet.find({ user: { $in: recipientIds } }).session(session);
            const walletByUser = new Map(recipientWallets.map((wallet) => [wallet.user.toString(), wallet]));

            if (walletByUser.size !== recipientIds.length) {
                throw new ApiError(404, "One or more player wallets were not found");
            }

            const ledgerEntries = [];
            for (const row of refundRows) {
                const recipientId = row.recipient.toString();
                const playerWallet = walletByUser.get(recipientId);
                const playerBefore = playerWallet.balance;
                playerWallet.balance = roundCurrency(playerBefore + row.refundAmount);
                playerWallet.lastTransactionAt = now;
                await playerWallet.save({ session });

                const refundTxArr = await WalletTransaction.create([{
                    transactionId: uuidv4(),
                    user: row.recipient,
                    walletId: playerWallet._id,
                    type: "CREDIT",
                    category: "REFUND",
                    amount: row.refundAmount,
                    grossAmount: row.refundAmount,
                    platformFee: 0,
                    netAmount: row.refundAmount,
                    balanceBefore: playerBefore,
                    balanceAfter: playerWallet.balance,
                    status: "SUCCESS",
                    referenceId: tournamentId,
                    fromUser: tournament.organizer,
                    toUser: row.recipient,
                    description: `Refund for cancelled tournament ${tournament.title}`,
                    metadata: {
                        tournament: tournamentId,
                        registration: row.registration._id,
                        cancellationRef,
                        originalPaymentRef: row.registration.paymentRef,
                        originalPlatformFee: row.platformFee,
                        originalOrganizerAmount: row.organizerAmount,
                        organizerDebitTransactionId: organizerDebitTransaction.transactionId
                    }
                }], { session, ordered: true });

                const refundTx = refundTxArr[0];
                refundTransactions.push(refundTx);
                ledgerEntries.push({
                    transactionId: refundTx.transactionId,
                    debitAccount: "ORGANIZER_WALLET",
                    creditAccount: "USER_WALLET",
                    fromUser: tournament.organizer,
                    toUser: row.recipient,
                    category: "TOURNAMENT_REFUND",
                    referenceId: tournamentId,
                    amount: row.refundAmount,
                    currency: "INR",
                    platformFee: row.platformFee,
                    netAmount: row.refundAmount,
                    status: "SUCCESS",
                    metadata: {
                        tournament: tournamentId,
                        registration: row.registration._id,
                        cancellationRef,
                        originalPaymentRef: row.registration.paymentRef,
                        organizerDebitTransactionId: organizerDebitTransaction.transactionId,
                        platformFeeCoveredByCreator: row.platformFee,
                        originalOrganizerAmount: row.organizerAmount
                    }
                });
            }

            if (ledgerEntries.length > 0) {
                await Ledger.create(ledgerEntries, { session, ordered: true });
            }
        }

        const registrationIds = activeRegistrations.map((registration) => registration._id);
        if (registrationIds.length > 0) {
            await Registration.updateMany(
                { _id: { $in: registrationIds } },
                { $set: { status: "cancelled" } },
                { session }
            );
        }

        const notificationRecipients = new Set();
        activeRegistrations.forEach((registration) => {
            getRegistrationUsers(registration).forEach((userId) => notificationRecipients.add(userId.toString()));
        });
        if (notificationRecipients.size > 0) {
            await Notification.insertMany(
                [...notificationRecipients].map((user) => ({
                    user,
                    title: "Tournament cancelled",
                    body: totalRefund > 0
                        ? `${tournament.title} was cancelled. Entry fee refunds were sent to the original payer wallets.`
                        : `${tournament.title} was cancelled by the creator.`,
                    type: "tournament_update"
                })),
                { session, ordered: false }
            );
        }

        tournament.status = "cancelled";
        tournament.joinedPlayers = [];
        tournament.organizerEarnings = Math.max(0, roundCurrency(Number(tournament.organizerEarnings || 0) - totalOrganizerAmount));
        tournament.platformFeeAmount = Math.max(0, roundCurrency(Number(tournament.platformFeeAmount || 0) - totalPlatformFee));
        await tournament.save({ session });

        await session.commitTransaction();

        const participantStats = await getParticipantStats([tournament._id]);
        const resultDetails = await getResultRegistrationDetails([tournament._id]);

        return res.status(200).json(
            new ApiResponse(200, {
                tournament: serializeTournament(tournament, participantStats, resultDetails),
                refundTotal: totalRefund,
                refundCount: refundRows.length,
                platformFeeCoveredByCreator: totalPlatformFee,
                organizerDebitTransaction,
                refundTransactions
            }, "Tournament cancelled and joined players refunded")
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

// ---------------------------------
// REGISTER USER TO TOURNAMENT
// ---------------------------------
const joinTournament = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const { slotNumber, teamName, players = [] } = req.body;

    if (!hasRealPhoneNumber(req.user)) {
        throw new ApiError(400, "Add your phone number before joining tournaments");
    }

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
        throw new ApiError(400, "Invalid tournament ID");
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new ApiError(404, "Tournament not found");
    await syncTournamentLifecycle(tournament, { save: true });
    if (tournament.visibility === "private" && !userCanManageTournament(req.user, tournament)) {
        throw new ApiError(400, "Tournament is private");
    }
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

        const joinedRoom = tournament.room_details || {};
        if (joinedRoom.roomId || joinedRoom.roomPass || joinedRoom.roomJoinTime) {
            const credentialParts = [
                joinedRoom.roomId ? `Room ID: ${joinedRoom.roomId}` : "",
                joinedRoom.roomPass ? `Pass: ${joinedRoom.roomPass}` : "",
                joinedRoom.roomJoinTime ? `Join: ${formatDateTime(new Date(joinedRoom.roomJoinTime))}` : "",
            ].filter(Boolean);

            await createNotifications(memberIds.map((user) => ({
                user,
                title: "Tournament room details",
                body: `${tournament.title}: ${credentialParts.join(" | ")}`,
                type: "room",
                actionUrl: `/tournament/${tournament._id}`,
                data: {
                    tournament: tournament._id,
                    registration: registrationArr[0]._id,
                    roomId: joinedRoom.roomId || "",
                    roomPass: joinedRoom.roomPass || "",
                    hasRoomPass: Boolean(joinedRoom.roomPass),
                    roomJoinTime: joinedRoom.roomJoinTime || null,
                },
            }))).catch((error) => {
                console.error("Failed to notify joined tournament members about room details:", error);
            });
        }

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
    notifyTournamentRoomDetails,
    cancelTournament,
    joinTournament,
    getTournamentParticipants,
    getMyTournamentRegistrations,
    distributeTournamentPrizes,
    registerTeam,
    unregisterTeam
};
