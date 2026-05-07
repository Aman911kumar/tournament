import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Channel } from "../models/channel.model.js";
import { ChannelSubscription } from "../models/channelSubscription.model.js";
import { Tournament } from "../models/tournament.model.js";
import { Team } from "../models/team.model.js";
import { Registration } from "../models/registration.model.js";
import { Payment } from "../models/payment.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { SupportTicket } from "../models/SupportTicket.model.js";
import { GameAccount } from "../models/gameAccount.model.js";
import { Report } from "../models/report.model.js";
import { Notification } from "../models/notification.model.js";
import { Leaderboard } from "../models/leaderboad.model.js";
import { Ledger } from "../models/ledger.model.js";
import { Wallet } from "../models/wallet.model.js";
import { AdminAuditLog } from "../models/adminAuditLog.model.js";
import ApiError from "../utils/ApiError.js";
import { creditWallet } from "../services/wallet.service.js";
import { expireStaleRazorpayPayments } from "../services/paymentExpiry.service.js";

const adminCollections = {
    users: { model: User, label: "Users", sort: { createdAt: -1 } },
    wallets: { model: Wallet, label: "Wallets", sort: { updatedAt: -1 } },
    walletTransactions: { model: WalletTransaction, label: "Wallet Transactions", sort: { createdAt: -1 } },
    ledgers: { model: Ledger, label: "Ledger Entries", sort: { createdAt: -1 } },
    payments: { model: Payment, label: "Payments", sort: { createdAt: -1 } },
    tournaments: { model: Tournament, label: "Tournaments", sort: { createdAt: -1 } },
    registrations: { model: Registration, label: "Registrations", sort: { createdAt: -1 } },
    teams: { model: Team, label: "Teams", sort: { createdAt: -1 } },
    channels: { model: Channel, label: "Channels", sort: { createdAt: -1 } },
    subscriptions: { model: ChannelSubscription, label: "Channel Subscriptions", sort: { createdAt: -1 } },
    gameAccounts: { model: GameAccount, label: "Game Accounts", sort: { createdAt: -1 } },
    leaderboards: { model: Leaderboard, label: "Leaderboards", sort: { createdAt: -1 } },
    tickets: { model: SupportTicket, label: "Support Tickets", sort: { createdAt: -1 } },
    reports: { model: Report, label: "Reports", sort: { createdAt: -1 } },
    notifications: { model: Notification, label: "Notifications", sort: { createdAt: -1 } },
    adminAuditLogs: { model: AdminAuditLog, label: "Admin Audit Logs", sort: { createdAt: -1 } },
};

const normalizeChannelHandle = (value = "") => {
    const base = String(value || "creator")
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/^[^a-z0-9]+/, "")
        .slice(0, 24);

    return base.length >= 3 ? base : `creator-${base || "user"}`;
};

const ensureCreatorChannel = async (user) => {
    const existing = await Channel.findOne({ owner: user._id });
    if (existing) {
        if (!existing.isActive) {
            existing.isActive = true;
            await existing.save();
        }
        return existing;
    }

    const handleBase = normalizeChannelHandle(user.username || user.email || user._id);
    let handle = handleBase;
    let suffix = 0;
    while (await Channel.exists({ handle })) {
        suffix += 1;
        const nextSuffix = `-${suffix}`;
        handle = `${handleBase.slice(0, 30 - nextSuffix.length)}${nextSuffix}`;
    }

    return Channel.create({
        owner: user._id,
        name: user.username || "Creator",
        handle,
        description: "Approved creator",
        avatar: user.avatar || {},
        isActive: true,
    });
};

const sensitiveKeyPattern = /(password|refreshToken|accessToken|token|secret|otp|credential|resetPassword)/i;

const adminCollectionPopulates = {
    users: [{ path: "creatorRequest.reviewedBy", select: "username phone_number email" }],
    wallets: [{ path: "user", select: "username phone_number email" }],
    walletTransactions: [
        { path: "user", select: "username phone_number email" },
        { path: "fromUser", select: "username phone_number email" },
        { path: "toUser", select: "username phone_number email" },
    ],
    ledgers: [
        { path: "fromUser", select: "username phone_number email" },
        { path: "toUser", select: "username phone_number email" },
    ],
    payments: [{ path: "user", select: "username phone_number email" }],
    tournaments: [
        { path: "organizer", select: "username phone_number email" },
        { path: "channel", select: "name handle" },
        { path: "results.player", select: "username phone_number email avatar" },
    ],
    registrations: [
        { path: "user", select: "username phone_number email" },
        { path: "tournament", select: "title game status" },
    ],
    teams: [
        { path: "createdBy", select: "username phone_number email" },
        { path: "players", select: "username phone_number email" },
        { path: "tournament", select: "title game status" },
    ],
    channels: [{ path: "owner", select: "username phone_number email" }],
    subscriptions: [
        { path: "user", select: "username phone_number email" },
        { path: "channel", select: "name handle" },
    ],
    gameAccounts: [{ path: "user", select: "username phone_number email" }],
    tickets: [
        { path: "user", select: "username phone_number email" },
        { path: "targetUser", select: "username phone_number email" },
        { path: "tournament", select: "title game status" },
    ],
    reports: [
        { path: "user", select: "username phone_number email" },
        { path: "tournament", select: "title game status" },
    ],
    notifications: [{ path: "user", select: "username phone_number email" }],
    adminAuditLogs: [
        { path: "actor", select: "username phone_number email" },
        { path: "targetUser", select: "username phone_number email" },
    ],
};

const redactSensitiveFields = (value) => {
    if (Array.isArray(value)) {
        return value.map(redactSensitiveFields);
    }

    if (value && typeof value === "object") {
        return Object.entries(value).reduce((record, [key, child]) => {
            record[key] = sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactSensitiveFields(child);
            return record;
        }, {});
    }

    return value;
};

const getRefId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id?.toString?.() || value.toString?.() || "";
};

const buildPaidToDetails = async (tournamentRecords) => {
    if (!tournamentRecords.length) return tournamentRecords;

    const tournamentIds = tournamentRecords.map((record) => record._id).filter(Boolean);
    const registrations = await Registration.find({
        tournament: { $in: tournamentIds },
        status: { $in: ["paid", "confirmed"] },
    }).select("tournament user team gameAccounts").lean();

    const registeredUserIds = new Set();
    const gameAccountByTournamentUser = new Map();

    registrations.forEach((registration) => {
        const tournamentId = getRefId(registration.tournament);
        const userIds = [
            getRefId(registration.user),
            ...(registration.team || []).map(getRefId),
        ].filter(Boolean);

        userIds.forEach((userId) => {
            registeredUserIds.add(userId);
            const account = (registration.gameAccounts || []).find((item) => getRefId(item.user) === userId)
                || registration.gameAccounts?.[0]
                || {};
            gameAccountByTournamentUser.set(`${tournamentId}:${userId}`, {
                userId,
                gameName: account.inGameName || "",
                gameId: account.gameId || "",
                game: account.game || "",
            });
        });
    });

    const fallbackAccounts = registeredUserIds.size
        ? await GameAccount.find({ user: { $in: [...registeredUserIds] } }).select("user game inGameName gameId").lean()
        : [];
    const fallbackAccountByUser = new Map(fallbackAccounts.map((account) => [getRefId(account.user), account]));

    return tournamentRecords.map((record) => {
        const tournamentId = getRefId(record._id);
        return {
            ...record,
            results: (record.results || []).map((result) => {
                const playerId = getRefId(result.player);
                const player = result.player && typeof result.player === "object" ? result.player : {};
                const registrationAccount = gameAccountByTournamentUser.get(`${tournamentId}:${playerId}`) || {};
                const fallbackAccount = fallbackAccountByUser.get(playerId) || {};
                const gameName = registrationAccount.gameName || fallbackAccount.inGameName || "";
                const gameId = registrationAccount.gameId || fallbackAccount.gameId || "";
                const game = registrationAccount.game || fallbackAccount.game || "";

                return {
                    ...result,
                    userId: playerId,
                    gameName,
                    gameId,
                    game,
                    paidTo: {
                        userId: playerId,
                        username: player.username || "",
                        phone_number: player.phone_number || "",
                        email: player.email || "",
                        gameName,
                        gameId,
                        game,
                    },
                };
            }),
        };
    });
};

const getWindowStart = (days) => {
    const safeDays = Math.min(Math.max(Number(days) || 30, 7), 365);
    const start = new Date();
    start.setDate(start.getDate() - safeDays + 1);
    start.setHours(0, 0, 0, 0);
    return { start, days: safeDays };
};

const ADMIN_DASHBOARD_CACHE_MS = 10 * 1000;
const adminDashboardCache = new Map();
const clearAdminDashboardCache = () => adminDashboardCache.clear();

const fillDailySeries = (rows, days, start, valueKeys = ["count"]) => {
    const rowMap = new Map(rows.map((row) => [row._id, row]));

    return Array.from({ length: days }).map((_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        const row = rowMap.get(key) || {};

        return valueKeys.reduce(
            (entry, valueKey) => ({
                ...entry,
                [valueKey]: Number(row[valueKey] || 0)
            }),
            { date: key }
        );
    });
};

const dailyCount = (Model, start, dateField = "createdAt", match = {}) => {
    return Model.aggregate([
        {
            $match: {
                ...match,
                [dateField]: { $gte: start }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

const dailyPaymentRevenue = (start) => {
    return Payment.aggregate([
        {
            $match: {
                status: "success",
                "meta.purpose": { $ne: "withdrawal" },
                createdAt: { $gte: start }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                amount: { $sum: "$amount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

const countByField = (Model, field, match = {}) => {
    return Model.aggregate([
        { $match: match },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
};

const firstFacetRow = (rows, fallback = {}) => rows?.[0] || fallback;

const getUserDashboardData = (start) => User.aggregate([
    {
        $facet: {
            totals: [
                {
                    $group: {
                        _id: null,
                        users: { $sum: 1 },
                        activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } },
                        creators: { $sum: { $cond: [{ $in: ["creator", { $ifNull: ["$role", []] }] }, 1, 0] } },
                        bannedUsers: { $sum: { $cond: [{ $in: ["banned", { $ifNull: ["$role", []] }] }, 1, 0] } },
                        pendingCreatorRequests: { $sum: { $cond: [{ $eq: ["$creatorRequest.status", "pending"] }, 1, 0] } },
                    }
                }
            ],
            byDay: [
                { $match: { createdAt: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ],
            byRole: [
                { $unwind: "$role" },
                { $group: { _id: "$role", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                { $project: { username: 1, phone_number: 1, email: 1, role: 1, isActive: 1, creatorRequest: 1, createdAt: 1 } }
            ],
            creatorRequests: [
                { $match: { "creatorRequest.status": "pending" } },
                { $sort: { "creatorRequest.requestedAt": -1, createdAt: -1 } },
                { $limit: 8 },
                { $project: { username: 1, phone_number: 1, email: 1, role: 1, creatorRequest: 1, createdAt: 1 } }
            ]
        }
    }
]);

const getTournamentDashboardData = (start) => Tournament.aggregate([
    {
        $facet: {
            totals: [
                {
                    $group: {
                        _id: null,
                        tournaments: { $sum: 1 },
                        openTournaments: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
                        runningTournaments: { $sum: { $cond: [{ $eq: ["$status", "running"] }, 1, 0] } },
                        completedTournaments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    }
                }
            ],
            byDay: [
                { $match: { createdAt: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ],
            byStatus: [
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ],
            byGame: [
                { $group: { _id: "$game", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                {
                    $lookup: {
                        from: "users",
                        localField: "organizer",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, avatar: 1 } }],
                        as: "organizer"
                    }
                },
                {
                    $lookup: {
                        from: "channels",
                        localField: "channel",
                        foreignField: "_id",
                        pipeline: [{ $project: { name: 1, handle: 1 } }],
                        as: "channel"
                    }
                },
                { $unwind: { path: "$organizer", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$channel", preserveNullAndEmptyArrays: true } },
                { $project: { title: 1, game: 1, type: 1, status: 1, entryFee: 1, prizePool: 1, prizeMode: 1, killPrizeAmount: 1, prizeDistribution: 1, maxPlayers: 1, startAt: 1, organizer: 1, channel: 1, createdAt: 1 } }
            ]
        }
    }
]);

const getPaymentDashboardData = (start) => Payment.aggregate([
    {
        $facet: {
            revenue: [
                { $match: { status: "success", "meta.purpose": { $ne: "withdrawal" } } },
                { $group: { _id: null, successfulPayments: { $sum: 1 }, totalRevenue: { $sum: "$amount" } } }
            ],
            byDay: [
                { $match: { status: "success", "meta.purpose": { $ne: "withdrawal" }, createdAt: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ],
            byStatus: [
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ],
            razorpay: [
                { $match: { provider: "Razorpay" } },
                {
                    $group: {
                        _id: null,
                        pendingRazorpayPayments: { $sum: { $cond: [{ $in: ["$status", ["initiated", "pending"]] }, 1, 0] } },
                        failedRazorpayPayments: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
                    }
                }
            ]
        }
    }
]);

const getWalletFlowDashboardData = () => WalletTransaction.aggregate([
    {
        $group: {
            _id: "$type",
            amount: { $sum: "$amount" }
        }
    }
]);

const getLedgerDashboardData = () => Ledger.aggregate([
    {
        $facet: {
            totalCount: [{ $count: "count" }],
            platformFeeTotals: [
                { $match: { status: "SUCCESS", creditAccount: "PLATFORM_FEE" } },
                { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }
            ],
            platformFeesByCategory: [
                { $match: { status: "SUCCESS", creditAccount: "PLATFORM_FEE" } },
                { $group: { _id: "$category", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $sort: { amount: -1 } }
            ],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 12 },
                {
                    $lookup: {
                        from: "users",
                        localField: "fromUser",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, phone_number: 1, email: 1 } }],
                        as: "fromUser"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "toUser",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, phone_number: 1, email: 1 } }],
                        as: "toUser"
                    }
                },
                { $unwind: { path: "$fromUser", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$toUser", preserveNullAndEmptyArrays: true } },
                { $project: { transactionId: 1, debitAccount: 1, creditAccount: 1, fromUser: 1, toUser: 1, category: 1, referenceId: 1, amount: 1, platformFee: 1, netAmount: 1, status: 1, createdAt: 1, metadata: 1 } }
            ]
        }
    }
]);

const getSupportDashboardData = () => SupportTicket.aggregate([
    {
        $facet: {
            totals: [
                { $match: { status: { $in: ["open", "in_progress"] } } },
                { $count: "openTickets" }
            ],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                {
                    $lookup: {
                        from: "users",
                        localField: "user",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, phone_number: 1 } }],
                        as: "user"
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                { $project: { title: 1, type: 1, status: 1, user: 1, createdAt: 1 } }
            ]
        }
    }
]);

const getChannelDashboardData = () => Channel.aggregate([
    {
        $facet: {
            totals: [
                { $match: { isActive: true } },
                { $group: { _id: null, channels: { $sum: 1 }, channelMembers: { $sum: "$memberCount" } } }
            ],
            topCreators: [
                { $match: { isActive: true } },
                {
                    $lookup: {
                        from: "tournaments",
                        let: { ownerId: "$owner" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$organizer", "$$ownerId"] } } },
                            { $count: "count" }
                        ],
                        as: "tournamentStats"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, avatar: 1 } }],
                        as: "owner"
                    }
                },
                { $unwind: "$owner" },
                {
                    $project: {
                        name: 1,
                        handle: 1,
                        memberCount: 1,
                        tournamentCount: { $ifNull: [{ $arrayElemAt: ["$tournamentStats.count", 0] }, 0] },
                        owner: { _id: "$owner._id", username: "$owner.username", avatar: "$owner.avatar" }
                    }
                },
                { $sort: { memberCount: -1, tournamentCount: -1 } },
                { $limit: 5 }
            ]
        }
    }
]);

const getAuditDashboardData = () => AdminAuditLog.aggregate([
    {
        $facet: {
            totals: [{ $count: "count" }],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 8 },
                {
                    $lookup: {
                        from: "users",
                        localField: "actor",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, phone_number: 1, email: 1 } }],
                        as: "actor"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "targetUser",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, phone_number: 1, email: 1 } }],
                        as: "targetUser"
                    }
                },
                { $unwind: { path: "$actor", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$targetUser", preserveNullAndEmptyArrays: true } }
            ]
        }
    }
]);

const getAdminDashboard = asyncHandler(async (req, res) => {
    const { start, days } = getWindowStart(req.query.days);
    const cacheKey = String(days);
    const cached = adminDashboardCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < ADMIN_DASHBOARD_CACHE_MS) {
        return res.status(200).json(
            new ApiResponse(200, cached.data, "Admin dashboard fetched successfully")
        );
    }

    await expireStaleRazorpayPayments();

    const [
        userDashboardRows,
        tournamentDashboardRows,
        paymentDashboardRows,
        walletFlowRows,
        ledgerDashboardRows,
        supportDashboardRows,
        channelDashboardRows,
        auditDashboardRows,
        totalTeams,
        totalRegistrations,
        verifiedGameAccounts,
        totalSubscriptions
    ] = await Promise.all([
        getUserDashboardData(start),
        getTournamentDashboardData(start),
        getPaymentDashboardData(start),
        getWalletFlowDashboardData(),
        getLedgerDashboardData(),
        getSupportDashboardData(),
        getChannelDashboardData(),
        getAuditDashboardData(),
        Team.countDocuments(),
        Registration.countDocuments(),
        GameAccount.countDocuments({ verified: true }),
        ChannelSubscription.countDocuments()
    ]);

    const userDashboard = firstFacetRow(userDashboardRows);
    const tournamentDashboard = firstFacetRow(tournamentDashboardRows);
    const paymentDashboard = firstFacetRow(paymentDashboardRows);
    const ledgerDashboard = firstFacetRow(ledgerDashboardRows);
    const supportDashboard = firstFacetRow(supportDashboardRows);
    const channelDashboard = firstFacetRow(channelDashboardRows);
    const auditDashboard = firstFacetRow(auditDashboardRows);

    const userTotals = firstFacetRow(userDashboard.totals, {});
    const tournamentTotals = firstFacetRow(tournamentDashboard.totals, {});
    const paymentTotals = firstFacetRow(paymentDashboard.revenue, {});
    const razorpayTotals = firstFacetRow(paymentDashboard.razorpay, {});
    const ledgerTotals = firstFacetRow(ledgerDashboard.platformFeeTotals, {});
    const channelTotals = firstFacetRow(channelDashboard.totals, {});
    const supportTotals = firstFacetRow(supportDashboard.totals, {});
    const auditTotals = firstFacetRow(auditDashboard.totals, {});
    const walletFlow = walletFlowRows.reduce((totals, row) => ({
        ...totals,
        [row._id]: Number(row.amount || 0)
    }), {});

    const totalRevenue = Number(paymentTotals.totalRevenue || 0);
    const successfulPayments = Number(paymentTotals.successfulPayments || 0);
    const totalCredits = Number(walletFlow.CREDIT || 0);
    const totalDebits = Number(walletFlow.DEBIT || 0);
    const totalPlatformFees = Number(ledgerTotals.amount || 0);
    const platformFeeTransactionCount = Number(ledgerTotals.count || 0);

    const dashboardData = {
                range: { days, start, end: new Date() },
                totals: {
                    users: Number(userTotals.users || 0),
                    activeUsers: Number(userTotals.activeUsers || 0),
                    creators: Number(userTotals.creators || 0),
                    bannedUsers: Number(userTotals.bannedUsers || 0),
                    channels: Number(channelTotals.channels || 0),
                    channelMembers: totalSubscriptions,
                    tournaments: Number(tournamentTotals.tournaments || 0),
                    openTournaments: Number(tournamentTotals.openTournaments || 0),
                    runningTournaments: Number(tournamentTotals.runningTournaments || 0),
                    completedTournaments: Number(tournamentTotals.completedTournaments || 0),
                    teams: totalTeams,
                    registrations: totalRegistrations,
                    verifiedGameAccounts,
                    openTickets: Number(supportTotals.openTickets || 0),
                    successfulPayments,
                    totalRevenue,
                    walletCredits: totalCredits,
                    walletDebits: totalDebits,
                    netWalletFlow: totalCredits - totalDebits,
                    platformFees: totalPlatformFees,
                    platformFeeTransactionCount,
                    ledgerTransactions: Number(firstFacetRow(ledgerDashboard.totalCount, {}).count || 0),
                    pendingRazorpayPayments: Number(razorpayTotals.pendingRazorpayPayments || 0),
                    failedRazorpayPayments: Number(razorpayTotals.failedRazorpayPayments || 0),
                    pendingCreatorRequests: Number(userTotals.pendingCreatorRequests || 0),
                    adminAuditCount: Number(auditTotals.count || 0)
                },
                charts: {
                    usersByDay: fillDailySeries(userDashboard.byDay || [], days, start),
                    tournamentsByDay: fillDailySeries(tournamentDashboard.byDay || [], days, start),
                    revenueByDay: fillDailySeries(paymentDashboard.byDay || [], days, start, ["amount", "count"]),
                    tournamentsByStatus: tournamentDashboard.byStatus || [],
                    tournamentsByGame: tournamentDashboard.byGame || [],
                    paymentsByStatus: paymentDashboard.byStatus || [],
                    usersByRole: userDashboard.byRole || [],
                    platformFeesByCategory: ledgerDashboard.platformFeesByCategory || []
                },
                tables: {
                    topCreators: channelDashboard.topCreators || [],
                    recentTournaments: tournamentDashboard.recent || [],
                    recentUsers: userDashboard.recent || [],
                    recentTickets: supportDashboard.recent || [],
                    creatorRequests: userDashboard.creatorRequests || [],
                    recentAdminAuditLogs: auditDashboard.recent || [],
                    recentFinanceTransactions: ledgerDashboard.recent || []
                }
            };

    adminDashboardCache.set(cacheKey, { createdAt: Date.now(), data: dashboardData });

    return res.status(200).json(
        new ApiResponse(200, dashboardData, "Admin dashboard fetched successfully")
    );
});

const getWithdrawalRequests = asyncHandler(async (req, res) => {
    const { status = "pending", limit = 20 } = req.query;
    const query = {
        "meta.purpose": "withdrawal",
        ...(status === "all" ? {} : { status }),
    };

    const withdrawals = await Payment.find(query)
        .populate("user", "username phone_number email")
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 20, 100))
        .lean();

    return res.status(200).json(
        new ApiResponse(200, withdrawals, "Withdrawal requests fetched successfully")
    );
});

const updateWithdrawalStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status = "success", note, payoutReference, reason } = req.body;
    const allowedStatuses = ["success", "failed", "cancelled"];

    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, "Withdrawal can only be marked as success, failed, or cancelled");
    }

    const withdrawal = await Payment.findOne({
        _id: id,
        "meta.purpose": "withdrawal",
    });

    if (!withdrawal) {
        throw new ApiError(404, "Withdrawal request not found");
    }

    if (withdrawal.status !== "pending") {
        return res.status(200).json(
            new ApiResponse(200, withdrawal, "Withdrawal status already finalized")
        );
    }

    const updatedAt = new Date();
    let refundTx = null;

    if (["failed", "cancelled"].includes(status)) {
        refundTx = await creditWallet({
            user: withdrawal.user,
            amount: withdrawal.amount,
            category: "REFUND",
            idempotencyKey: `WITHDRAW_REFUND_${withdrawal._id}`,
            referenceId: withdrawal.providerOrderId || withdrawal._id.toString(),
            metadata: {
                purpose: "withdrawal_refund",
                withdrawalPaymentId: withdrawal._id,
                originalWalletTransactionId: withdrawal.meta?.walletTransactionId,
                payoutStatus: status,
                reason: reason || note || "",
                adminUpdatedBy: req.user._id,
            },
        });
    }

    withdrawal.status = status;
    withdrawal.meta = {
        ...withdrawal.meta,
        adminUpdatedAt: updatedAt,
        adminUpdatedBy: req.user._id,
        note: note || "",
        payoutReference: payoutReference || withdrawal.meta?.payoutReference || "",
        payoutStatus: status,
        ...(status === "success" ? { adminPaidAt: updatedAt, adminPaidBy: req.user._id } : {}),
        ...(status !== "success" ? {
            failureReason: reason || note || "",
            refundTransactionId: refundTx?.transactionId,
            refundWalletTransactionId: refundTx?._id,
            refundedAt: updatedAt,
        } : {}),
    };
    await withdrawal.save();

    if (withdrawal.meta?.walletTransactionId) {
        await WalletTransaction.findByIdAndUpdate(withdrawal.meta.walletTransactionId, {
            $set: {
                "metadata.payoutStatus": status,
                "metadata.payoutReference": payoutReference || "",
                "metadata.payoutFailureReason": reason || note || "",
                "metadata.adminUpdatedAt": updatedAt,
                "metadata.adminUpdatedBy": req.user._id,
                ...(status === "success" ? { "metadata.adminPaidAt": updatedAt } : {}),
                ...(refundTx ? {
                    "metadata.refundTransactionId": refundTx.transactionId,
                    "metadata.refundWalletTransactionId": refundTx._id,
                } : {}),
            },
        });
    }
    clearAdminDashboardCache();

    const message = status === "success"
        ? "Withdrawal marked as paid"
        : `Withdrawal marked as ${status} and wallet amount refunded`;

    return res.status(200).json(
        new ApiResponse(200, withdrawal, message)
    );
});

const updateCreatorPermission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, note = "" } = req.body;
    const allowedStatuses = ["approved", "rejected", "removed"];

    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, "Creator permission must be approved, rejected, or removed");
    }

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const roles = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean);
    const adminNote = String(note || "").trim();
    user.creatorRequest = {
        status,
        requestedAt: user.creatorRequest?.requestedAt || new Date(),
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        note: adminNote,
    };

    if (status === "approved") {
        user.role = [...new Set([...roles, "user", "creator"])];
    } else {
        const nextRoles = roles.filter((role) => role !== "creator");
        user.role = nextRoles.length > 0 ? nextRoles : ["user"];
    }

    await user.save({ validateBeforeSave: false });
    const channel = status === "approved" ? await ensureCreatorChannel(user) : null;
    if (status === "removed") {
        await Channel.updateOne({ owner: user._id }, { $set: { isActive: false } });
    }
    const notificationBody = {
        approved: adminNote || "Your creator request has been approved. You can now create tournaments.",
        rejected: adminNote || "Your creator request was rejected by admin.",
        removed: adminNote || "Your creator access was removed by admin.",
    };
    await Notification.create({
        user: user._id,
        title: status === "approved" ? "Creator access approved" : status === "removed" ? "Creator access removed" : "Creator request rejected",
        body: notificationBody[status],
        type: "system",
    });
    await AdminAuditLog.create({
        actor: req.user._id,
        targetUser: user._id,
        action: `creator_${status}`,
        entity: "user",
        entityId: user._id,
        note: adminNote,
        metadata: {
            previousRoles: roles,
            nextRoles: user.role,
            creatorRequestStatus: status,
            channelId: channel?._id,
        },
    });
    clearAdminDashboardCache();

    const updatedUser = await User.findById(user._id)
        .populate("creatorRequest.reviewedBy", "username phone_number email")
        .select("-password -refreshToken -accessToken");

    return res.status(200).json(
        new ApiResponse(
            200,
            { user: updatedUser },
            status === "approved" ? "Creator access approved" : status === "removed" ? "Creator access removed" : "Creator access rejected"
        )
    );
});

const getAdminCollections = asyncHandler(async (req, res) => {
    const collections = await Promise.all(
        Object.entries(adminCollections).map(async ([key, config]) => ({
            key,
            label: config.label,
            count: await config.model.countDocuments(),
        }))
    );

    return res.status(200).json(
        new ApiResponse(200, collections, "Admin collections fetched successfully")
    );
});

const getAdminCollectionRecords = asyncHandler(async (req, res) => {
    const { collection } = req.params;
    const config = adminCollections[collection];

    if (!config) {
        throw new ApiError(404, "Admin collection not found");
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const creatorRequestStatus = String(req.query.creatorRequestStatus || "").trim();

    const query = search
        ? {
            $or: [
                { username: { $regex: search, $options: "i" } },
                { title: { $regex: search, $options: "i" } },
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone_number: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
            ],
        }
        : {};

    if (collection === "users" && creatorRequestStatus) {
        query["creatorRequest.status"] = creatorRequestStatus;
    }

    const recordQuery = config.model.find(query).sort(config.sort).skip(skip).limit(limit);
    (adminCollectionPopulates[collection] || []).forEach((populateConfig) => {
        recordQuery.populate(populateConfig);
    });

    const [total, records] = await Promise.all([
        config.model.countDocuments(query),
        recordQuery.lean(),
    ]);

    const visibleRecords = collection === "tournaments" ? await buildPaidToDetails(records) : records;

    return res.status(200).json(
        new ApiResponse(200, {
            collection,
            label: config.label,
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            records: visibleRecords.map(redactSensitiveFields),
        }, "Admin collection records fetched successfully")
    );
});

export {
    getAdminDashboard,
    getWithdrawalRequests,
    updateWithdrawalStatus,
    updateCreatorPermission,
    getAdminCollections,
    getAdminCollectionRecords,
};
