import asyncHandler from "../utils/AsyncHandler.js";
import mongoose from "mongoose";
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
import { TournamentBan } from "../models/tournamentBan.model.js";
import { ModerationAction } from "../models/moderationAction.model.js";
import { Notification } from "../models/notification.model.js";
import { Leaderboard } from "../models/leaderboad.model.js";
import { Ledger } from "../models/ledger.model.js";
import { Wallet } from "../models/wallet.model.js";
import { AdminAuditLog } from "../models/adminAuditLog.model.js";
import ApiError from "../utils/ApiError.js";
import { creditWallet } from "../services/wallet.service.js";
import { expireStaleRazorpayPayments } from "../services/paymentExpiry.service.js";
import { getMonitoringSnapshot } from "../services/monitoring.service.js";
import { createNotification } from "../services/notification.service.js";
import { getSocketStats } from "../services/socket.service.js";
import { deleteCacheByPrefix, getCache, setCache } from "../services/cache.service.js";

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
    tournamentBans: { model: TournamentBan, label: "Tournament Bans", sort: { createdAt: -1 } },
    moderationActions: { model: ModerationAction, label: "Moderation Actions", sort: { createdAt: -1 } },
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
        { path: "reporter", select: "username phone_number email avatar role" },
        { path: "createdBy", select: "username phone_number email avatar role" },
        { path: "reportedUser", select: "username phone_number email avatar role accountStatus" },
        { path: "reportedCreator", select: "username phone_number email avatar role accountStatus" },
        { path: "tournament", select: "title game status" },
        { path: "reviewedBy", select: "username phone_number email avatar role" },
    ],
    tournamentBans: [
        { path: "tournament", select: "title game status" },
        { path: "creator", select: "username phone_number email avatar" },
        { path: "player", select: "username phone_number email avatar accountStatus" },
        { path: "bannedBy", select: "username phone_number email role" },
        { path: "revokedBy", select: "username phone_number email role" },
    ],
    moderationActions: [
        { path: "actor", select: "username phone_number email role avatar" },
        { path: "targetUser", select: "username phone_number email role avatar accountStatus" },
        { path: "tournament", select: "title game status" },
        { path: "report", select: "title category status severity" },
        { path: "ban", select: "status reason expiresAt" },
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

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value && typeof value === "object") {
        if (typeof value.toHexString === "function") {
            return value.toHexString();
        }

        if (value._bsontype && typeof value.toString === "function") {
            return value.toString();
        }

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

const buildUserWalletDetails = async (userRecords) => {
    if (!userRecords.length) return userRecords;

    const userIds = userRecords.map((record) => record._id).filter(Boolean);
    const wallets = await Wallet.find({ user: { $in: userIds } })
        .select("_id user balance lockedBalance currency createdAt updatedAt")
        .lean();
    const walletByUser = new Map(wallets.map((wallet) => [getRefId(wallet.user), wallet]));

    return userRecords.map((record) => {
        const wallet = walletByUser.get(getRefId(record._id));
        if (!wallet) return record;

        return {
            ...record,
            walletBalance: Number(wallet.balance || 0),
            walletSummary: {
                walletId: wallet._id,
                balance: Number(wallet.balance || 0),
                lockedBalance: Number(wallet.lockedBalance || 0),
                availableBalance: Number(wallet.balance || 0) - Number(wallet.lockedBalance || 0),
                currency: wallet.currency || "INR",
                updatedAt: wallet.updatedAt,
            },
        };
    });
};

const getUserTransactionDirection = (record, userId) => {
    const fromUser = getRefId(record.fromUser);
    const toUser = getRefId(record.toUser);
    if (fromUser === userId) return "DEBIT";
    if (toUser === userId) return "CREDIT";
    return record.type || "INFO";
};

const mapAdminTransactionUser = (user) => {
    if (!user || typeof user !== "object") return null;
    return {
        _id: getRefId(user),
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
    };
};

const mapAdminUserTransaction = (source, record, userId) => {
    if (source === "wallet") {
        return {
            _id: getRefId(record._id),
            source: "wallet",
            title: record.description || record.category || record.type || "Wallet transaction",
            transactionId: record.transactionId,
            category: record.category,
            direction: getUserTransactionDirection(record, userId),
            amount: Number(record.amount || 0),
            grossAmount: Number(record.grossAmount || 0),
            platformFee: Number(record.platformFee || 0),
            netAmount: Number(record.netAmount || 0),
            balanceBefore: Number(record.balanceBefore || 0),
            balanceAfter: Number(record.balanceAfter || 0),
            status: record.status,
            referenceId: record.referenceId,
            fromUser: mapAdminTransactionUser(record.fromUser),
            toUser: mapAdminTransactionUser(record.toUser),
            createdAt: record.createdAt,
        };
    }

    if (source === "payment") {
        const purpose = record.meta?.purpose || record.provider || "payment";
        return {
            _id: getRefId(record._id),
            source: "payment",
            title: purpose,
            transactionId: record.providerPaymentId || record.providerOrderId || getRefId(record._id),
            category: purpose,
            direction: purpose === "withdrawal" ? "DEBIT" : "CREDIT",
            amount: Number(record.amount || 0),
            grossAmount: Number(record.amount || 0),
            platformFee: 0,
            netAmount: Number(record.amount || 0),
            status: record.status,
            referenceId: record.providerOrderId,
            provider: record.provider,
            providerPaymentId: record.providerPaymentId,
            providerOrderId: record.providerOrderId,
            createdAt: record.createdAt,
        };
    }

    return {
        _id: getRefId(record._id),
        source: "ledger",
        title: record.category || "Ledger entry",
        transactionId: record.transactionId,
        category: record.category,
        direction: getUserTransactionDirection(record, userId),
        amount: Number(record.amount || 0),
        grossAmount: Number(record.amount || 0),
        platformFee: Number(record.platformFee || 0),
        netAmount: Number(record.netAmount || 0),
        status: record.status,
        referenceId: record.referenceId,
        debitAccount: record.debitAccount,
        creditAccount: record.creditAccount,
        fromUser: mapAdminTransactionUser(record.fromUser),
        toUser: mapAdminTransactionUser(record.toUser),
        createdAt: record.createdAt,
    };
};

const getWindowStart = (days) => {
    const safeDays = Math.min(Math.max(Number(days) || 30, 7), 365);
    const start = new Date();
    start.setDate(start.getDate() - safeDays + 1);
    start.setHours(0, 0, 0, 0);
    return { start, days: safeDays };
};

const ADMIN_DASHBOARD_CACHE_MS = 10 * 1000;
const ADMIN_DASHBOARD_CACHE_PREFIX = "admin:dashboard:";
const clearAdminDashboardCache = () => {
    deleteCacheByPrefix(ADMIN_DASHBOARD_CACHE_PREFIX).catch((error) => {
        console.error("Failed to clear admin dashboard cache:", error.message);
    });
};

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
                { $project: { username: 1, phone_number: 1, email: 1, role: 1, accountStatus: 1, suspendedUntil: 1, mutedUntil: 1, isActive: 1, creatorRequest: 1, createdAt: 1 } }
            ],
            creatorRequests: [
                { $match: { "creatorRequest.status": "pending" } },
                { $sort: { "creatorRequest.requestedAt": -1, createdAt: -1 } },
                { $limit: 8 },
                { $project: { username: 1, phone_number: 1, email: 1, role: 1, accountStatus: 1, creatorRequest: 1, createdAt: 1 } }
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
            finance: [
                {
                    $project: {
                        status: 1,
                        visibility: { $ifNull: ["$visibility", "public"] },
                        organizerEarnings: { $ifNull: ["$organizerEarnings", 0] },
                        platformFeeAmount: { $ifNull: ["$platformFeeAmount", 0] },
                        prizePool: { $ifNull: ["$prizePool", 0] },
                        grossEntryAmount: {
                            $add: [
                                { $ifNull: ["$organizerEarnings", 0] },
                                { $ifNull: ["$platformFeeAmount", 0] }
                            ]
                        },
                        paidMoney: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ["$results", []] },
                                    as: "result",
                                    in: { $ifNull: ["$$result.prizeWon", 0] }
                                }
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        pendingPrizeAmount: {
                            $cond: [
                                { $eq: ["$status", "completed"] },
                                {
                                    $cond: [
                                        { $gt: [{ $subtract: ["$prizePool", "$paidMoney"] }, 0] },
                                        { $subtract: ["$prizePool", "$paidMoney"] },
                                        0
                                    ]
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        receivedMoney: { $sum: "$grossEntryAmount" },
                        platformFees: { $sum: "$platformFeeAmount" },
                        prizePaid: { $sum: "$paidMoney" },
                        pendingPrizes: { $sum: "$pendingPrizeAmount" },
                        publicTournaments: { $sum: { $cond: [{ $eq: ["$visibility", "public"] }, 1, 0] } },
                        privateTournaments: { $sum: { $cond: [{ $eq: ["$visibility", "private"] }, 1, 0] } }
                    }
                }
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
                { $project: { title: 1, game: 1, type: 1, status: 1, visibility: 1, entryFee: 1, prizePool: 1, prizeMode: 1, killPrizeAmount: 1, prizeDistribution: 1, maxPlayers: 1, startAt: 1, organizer: 1, channel: 1, createdAt: 1 } }
            ]
        }
    }
]);

const getPaymentDashboardData = (start) => Payment.aggregate([
    {
        $facet: {
            revenue: [
                { $match: { status: "success", "meta.purpose": { $ne: "withdrawal" } } },
                { $group: { _id: null, successfulPayments: { $sum: 1 }, totalDeposits: { $sum: "$amount" } } }
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

const getLedgerDashboardData = (start) => Ledger.aggregate([
    {
        $facet: {
            totalCount: [{ $count: "count" }],
            platformFeeTotals: [
                { $match: { status: "SUCCESS", creditAccount: "PLATFORM_FEE" } },
                { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }
            ],
            platformFeesByDay: [
                { $match: { status: "SUCCESS", creditAccount: "PLATFORM_FEE", createdAt: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
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

const getReportDashboardData = () => Report.aggregate([
    {
        $facet: {
            totals: [
                {
                    $group: {
                        _id: null,
                        totalReports: { $sum: 1 },
                        openReports: { $sum: { $cond: [{ $in: ["$status", ["open", "under_review"]] }, 1, 0] } },
                        highSeverityReports: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
                    }
                }
            ],
            recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                {
                    $lookup: {
                        from: "users",
                        localField: "reporter",
                        foreignField: "_id",
                        pipeline: [{ $project: { username: 1, avatar: 1, role: 1 } }],
                        as: "reporter"
                    }
                },
                {
                    $lookup: {
                        from: "tournaments",
                        localField: "tournament",
                        foreignField: "_id",
                        pipeline: [{ $project: { title: 1, game: 1, status: 1 } }],
                        as: "tournament"
                    }
                },
                { $unwind: { path: "$reporter", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$tournament", preserveNullAndEmptyArrays: true } },
                { $project: { title: 1, category: 1, targetType: 1, severity: 1, status: 1, reporter: 1, tournament: 1, createdAt: 1 } }
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

const getRiskDashboardData = async (start) => {
    const [
        failedPayments,
        pendingWithdrawals,
        openDisputes,
        unpaidCompletedTournaments,
        highValueDebits,
    ] = await Promise.all([
        Payment.countDocuments({ status: "failed", createdAt: { $gte: start } }),
        Payment.countDocuments({ "meta.purpose": "withdrawal", status: { $in: ["initiated", "pending"] } }),
        SupportTicket.countDocuments({ type: { $in: ["dispute", "report"] }, status: { $in: ["open", "in_progress"] } }),
        Tournament.countDocuments({
            status: "completed",
            $or: [
                { results: { $exists: false } },
                { results: { $size: 0 } }
            ]
        }),
        WalletTransaction.countDocuments({
            type: "DEBIT",
            amount: { $gte: Number(process.env.ADMIN_HIGH_VALUE_DEBIT_ALERT || 5000) },
            createdAt: { $gte: start }
        }),
    ]);

    return {
        failedPayments,
        pendingWithdrawals,
        openDisputes,
        unpaidCompletedTournaments,
        highValueDebits,
        suspiciousActivity: failedPayments + pendingWithdrawals + openDisputes + unpaidCompletedTournaments + highValueDebits,
    };
};

const getAdminDashboard = asyncHandler(async (req, res) => {
    const { start, days } = getWindowStart(req.query.days);
    const cacheKey = `${ADMIN_DASHBOARD_CACHE_PREFIX}${days}`;
    const cached = await getCache(cacheKey);

    if (cached) {
        return res.status(200).json(
            new ApiResponse(200, cached, "Admin dashboard fetched successfully")
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
        reportDashboardRows,
        channelDashboardRows,
        auditDashboardRows,
        riskDashboard,
        totalTeams,
        totalRegistrations,
        verifiedGameAccounts,
        totalSubscriptions
    ] = await Promise.all([
        getUserDashboardData(start),
        getTournamentDashboardData(start),
        getPaymentDashboardData(start),
        getWalletFlowDashboardData(),
        getLedgerDashboardData(start),
        getSupportDashboardData(),
        getReportDashboardData(),
        getChannelDashboardData(),
        getAuditDashboardData(),
        getRiskDashboardData(start),
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
    const reportDashboard = firstFacetRow(reportDashboardRows);
    const channelDashboard = firstFacetRow(channelDashboardRows);
    const auditDashboard = firstFacetRow(auditDashboardRows);

    const userTotals = firstFacetRow(userDashboard.totals, {});
    const tournamentTotals = firstFacetRow(tournamentDashboard.totals, {});
    const tournamentFinance = firstFacetRow(tournamentDashboard.finance, {});
    const paymentTotals = firstFacetRow(paymentDashboard.revenue, {});
    const razorpayTotals = firstFacetRow(paymentDashboard.razorpay, {});
    const ledgerTotals = firstFacetRow(ledgerDashboard.platformFeeTotals, {});
    const channelTotals = firstFacetRow(channelDashboard.totals, {});
    const supportTotals = firstFacetRow(supportDashboard.totals, {});
    const reportTotals = firstFacetRow(reportDashboard.totals, {});
    const auditTotals = firstFacetRow(auditDashboard.totals, {});
    const walletFlow = walletFlowRows.reduce((totals, row) => ({
        ...totals,
        [row._id]: Number(row.amount || 0)
    }), {});

    const totalDeposits = Number(paymentTotals.totalDeposits || paymentTotals.totalRevenue || 0);
    const successfulPayments = Number(paymentTotals.successfulPayments || 0);
    const totalCredits = Number(walletFlow.CREDIT || 0);
    const totalDebits = Number(walletFlow.DEBIT || 0);
    const totalPlatformFees = Number(ledgerTotals.amount || 0);
    const totalRevenue = totalPlatformFees;
    const platformFeeTransactionCount = Number(ledgerTotals.count || 0);
    const socketStats = getSocketStats();

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
                    publicTournaments: Number(tournamentFinance.publicTournaments || 0),
                    privateTournaments: Number(tournamentFinance.privateTournaments || 0),
                    teams: totalTeams,
                    registrations: totalRegistrations,
                    verifiedGameAccounts,
                    openTickets: Number(supportTotals.openTickets || 0),
                    totalReports: Number(reportTotals.totalReports || 0),
                    openReports: Number(reportTotals.openReports || 0),
                    highSeverityReports: Number(reportTotals.highSeverityReports || 0),
                    successfulPayments,
                    totalDeposits,
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
                    adminAuditCount: Number(auditTotals.count || 0),
                    pendingWithdrawals: Number(riskDashboard.pendingWithdrawals || 0),
                    suspiciousActivity: Number(riskDashboard.suspiciousActivity || 0),
                    onlineUsers: Number(socketStats.onlineUsers || 0),
                    connectedSockets: Number(socketStats.sockets || 0)
                },
                charts: {
                    usersByDay: fillDailySeries(userDashboard.byDay || [], days, start),
                    tournamentsByDay: fillDailySeries(tournamentDashboard.byDay || [], days, start),
                    revenueByDay: fillDailySeries(ledgerDashboard.platformFeesByDay || [], days, start, ["amount", "count"]),
                    depositVolumeByDay: fillDailySeries(paymentDashboard.byDay || [], days, start, ["amount", "count"]),
                    tournamentsByStatus: tournamentDashboard.byStatus || [],
                    tournamentsByGame: tournamentDashboard.byGame || [],
                    paymentsByStatus: paymentDashboard.byStatus || [],
                    usersByRole: userDashboard.byRole || [],
                    platformFeesByCategory: ledgerDashboard.platformFeesByCategory || []
                },
                tournamentAnalytics: {
                    finance: {
                        receivedMoney: Number(tournamentFinance.receivedMoney || 0),
                        platformFees: Number(tournamentFinance.platformFees || 0),
                        prizePaid: Number(tournamentFinance.prizePaid || 0),
                        pendingPrizes: Number(tournamentFinance.pendingPrizes || 0),
                    }
                },
                risk: {
                    failedPayments: Number(riskDashboard.failedPayments || 0),
                    pendingWithdrawals: Number(riskDashboard.pendingWithdrawals || 0),
                    openDisputes: Number(riskDashboard.openDisputes || 0),
                    unpaidCompletedTournaments: Number(riskDashboard.unpaidCompletedTournaments || 0),
                    highValueDebits: Number(riskDashboard.highValueDebits || 0),
                    suspiciousActivity: Number(riskDashboard.suspiciousActivity || 0),
                },
                tables: {
                    topCreators: channelDashboard.topCreators || [],
                    recentTournaments: tournamentDashboard.recent || [],
                    recentUsers: userDashboard.recent || [],
                    recentTickets: supportDashboard.recent || [],
                    recentReports: reportDashboard.recent || [],
                    creatorRequests: userDashboard.creatorRequests || [],
                    recentAdminAuditLogs: auditDashboard.recent || [],
                    recentFinanceTransactions: ledgerDashboard.recent || []
                }
            };

    await setCache(cacheKey, dashboardData, ADMIN_DASHBOARD_CACHE_MS);

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
    await createNotification({
        user: user._id,
        title: status === "approved" ? "Creator access approved" : status === "removed" ? "Creator access removed" : "Creator request rejected",
        body: notificationBody[status],
        type: "system",
        priority: status === "approved" ? "normal" : "high",
        actionUrl: "/profile",
        email: status !== "removed",
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

const updateUserModerationStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, note = "", durationHours = 24 } = req.body;
    const allowedActions = ["ban", "unban", "suspend", "mute", "activate"];

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Valid user ID is required");
    }

    if (!allowedActions.includes(action)) {
        throw new ApiError(400, "Moderation action must be ban, unban, suspend, mute, or activate");
    }

    if (id === req.user._id.toString() && ["ban", "suspend"].includes(action)) {
        throw new ApiError(400, "You cannot perform this action on your own admin account");
    }

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const previous = {
        role: Array.isArray(user.role) ? [...user.role] : [],
        isActive: user.isActive,
        accountStatus: user.accountStatus || "active",
        suspendedUntil: user.suspendedUntil,
        mutedUntil: user.mutedUntil,
    };
    const adminNote = String(note || "").trim().slice(0, 500);
    const safeDurationHours = Math.min(Math.max(Number(durationHours) || 24, 1), 24 * 30);
    const until = new Date(Date.now() + safeDurationHours * 60 * 60 * 1000);
    const roles = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean);

    if (action === "ban") {
        user.role = [...new Set([...roles, "banned"])];
        user.accountStatus = "banned";
        user.isActive = false;
        user.suspendedUntil = null;
        user.mutedUntil = null;
    }

    if (action === "unban" || action === "activate") {
        const nextRoles = roles.filter((role) => role !== "banned");
        user.role = nextRoles.length ? nextRoles : ["user"];
        user.accountStatus = "active";
        user.isActive = true;
        user.suspendedUntil = null;
        user.mutedUntil = null;
    }

    if (action === "suspend") {
        user.accountStatus = "suspended";
        user.isActive = true;
        user.suspendedUntil = until;
    }

    if (action === "mute") {
        user.accountStatus = "muted";
        user.isActive = true;
        user.mutedUntil = until;
    }

    user.moderationNote = adminNote;
    await user.save({ validateBeforeSave: false });
    const actionTitles = {
        ban: "Account banned",
        suspend: "Account suspended",
        mute: "Account muted",
        activate: "Account restored",
        unban: "Account restored",
    };

    await Promise.all([
        AdminAuditLog.create({
            actor: req.user._id,
            targetUser: user._id,
            action: `user_${action}`,
            entity: "user",
            entityId: user._id,
            note: adminNote,
            metadata: {
                previous,
                next: {
                    role: user.role,
                    isActive: user.isActive,
                    accountStatus: user.accountStatus,
                    suspendedUntil: user.suspendedUntil,
                    mutedUntil: user.mutedUntil,
                },
                durationHours: ["suspend", "mute"].includes(action) ? safeDurationHours : undefined,
            },
        }),
        createNotification({
            user: user._id,
            title: actionTitles[action],
            body: adminNote || (
                action === "suspend"
                    ? `Your account is suspended until ${until.toLocaleString("en-IN")}.`
                    : action === "mute"
                        ? `Your account is muted until ${until.toLocaleString("en-IN")}.`
                        : action === "ban"
                            ? "Your account has been banned by admin."
                            : "Your account restrictions were removed."
            ),
            type: "security",
            priority: ["ban", "suspend"].includes(action) ? "high" : "normal",
            actionUrl: "/profile",
            email: ["ban", "suspend", "activate", "unban"].includes(action),
        }).catch((error) => {
            console.error("Failed to notify moderated user:", error.message);
        }),
    ]);

    clearAdminDashboardCache();

    const updatedUser = await User.findById(user._id)
        .populate("creatorRequest.reviewedBy", "username phone_number email")
        .select("-password -refreshToken -accessToken");

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "User moderation status updated")
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
                { accountStatus: { $regex: search, $options: "i" } },
                { type: { $regex: search, $options: "i" } },
                { game: { $regex: search, $options: "i" } },
                { gameId: { $regex: search, $options: "i" } },
                { handle: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
                { action: { $regex: search, $options: "i" } },
                { transactionId: { $regex: search, $options: "i" } },
                { providerOrderId: { $regex: search, $options: "i" } },
                { providerPaymentId: { $regex: search, $options: "i" } },
                { "meta.purpose": { $regex: search, $options: "i" } },
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

    let visibleRecords = records;
    if (collection === "tournaments") {
        visibleRecords = await buildPaidToDetails(records);
    }
    if (collection === "users") {
        visibleRecords = await buildUserWalletDetails(records);
    }

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

const getAdminUserTransactionHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Valid user ID is required");
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const fetchSize = page * limit;
    const userObjectId = new mongoose.Types.ObjectId(id);
    const userQuery = {
        $or: [
            { user: userObjectId },
            { fromUser: userObjectId },
            { toUser: userObjectId },
        ],
    };
    const ledgerQuery = {
        $or: [
            { fromUser: userObjectId },
            { toUser: userObjectId },
        ],
    };
    const paymentQuery = { user: userObjectId };

    const [
        user,
        wallet,
        walletTotal,
        paymentTotal,
        ledgerTotal,
        walletTransactions,
        payments,
        ledgerEntries,
    ] = await Promise.all([
        User.findById(userObjectId).select("username email phone_number role walletBalance").lean(),
        Wallet.findOne({ user: userObjectId }).select("_id balance lockedBalance currency updatedAt").lean(),
        WalletTransaction.countDocuments(userQuery),
        Payment.countDocuments(paymentQuery),
        Ledger.countDocuments(ledgerQuery),
        WalletTransaction.find(userQuery)
            .populate("fromUser", "username email phone_number")
            .populate("toUser", "username email phone_number")
            .sort({ createdAt: -1 })
            .limit(fetchSize)
            .lean(),
        Payment.find(paymentQuery)
            .sort({ createdAt: -1 })
            .limit(fetchSize)
            .lean(),
        Ledger.find(ledgerQuery)
            .populate("fromUser", "username email phone_number")
            .populate("toUser", "username email phone_number")
            .sort({ createdAt: -1 })
            .limit(fetchSize)
            .lean(),
    ]);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const allRecords = [
        ...walletTransactions.map((record) => mapAdminUserTransaction("wallet", record, id)),
        ...payments.map((record) => mapAdminUserTransaction("payment", record, id)),
        ...ledgerEntries.map((record) => mapAdminUserTransaction("ledger", record, id)),
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const total = walletTotal + paymentTotal + ledgerTotal;
    const records = allRecords.slice((page - 1) * limit, page * limit);
    const walletBalance = Number(wallet?.balance ?? user.walletBalance ?? 0);
    const lockedBalance = Number(wallet?.lockedBalance || 0);

    return res.status(200).json(
        new ApiResponse(200, {
            user: redactSensitiveFields(user),
            wallet: wallet ? {
                _id: wallet._id,
                balance: walletBalance,
                lockedBalance,
                availableBalance: walletBalance - lockedBalance,
                currency: wallet.currency || "INR",
                updatedAt: wallet.updatedAt,
            } : {
                balance: Number(user.walletBalance || 0),
                lockedBalance: 0,
                availableBalance: Number(user.walletBalance || 0),
                currency: "INR",
            },
            totals: {
                walletTransactions: walletTotal,
                payments: paymentTotal,
                ledgerEntries: ledgerTotal,
                all: total,
            },
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            records,
        }, "Admin user transaction history fetched successfully")
    );
});

const getAdminMonitoring = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, getMonitoringSnapshot(), "Admin monitoring fetched successfully")
    );
});

export {
    getAdminDashboard,
    getWithdrawalRequests,
    updateWithdrawalStatus,
    updateCreatorPermission,
    updateUserModerationStatus,
    getAdminCollections,
    getAdminCollectionRecords,
    getAdminUserTransactionHistory,
    getAdminMonitoring,
};
