import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Channel } from "../models/channel.model.js";
import { ChannelSubscription } from "../models/channelSubscription.model.js";
import { Tournament } from "../models/tournament.model.js";
import { Team } from "../models/team.model.js";
import { Match } from "../models/match.model.js";
import { Registration } from "../models/registration.model.js";
import { Payment } from "../models/payment.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { SupportTicket } from "../models/SupportTicket.model.js";
import { GameAccount } from "../models/gameAccount.model.js";

const getWindowStart = (days) => {
    const safeDays = Math.min(Math.max(Number(days) || 30, 7), 365);
    const start = new Date();
    start.setDate(start.getDate() - safeDays + 1);
    start.setHours(0, 0, 0, 0);
    return { start, days: safeDays };
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

const getAdminDashboard = asyncHandler(async (req, res) => {
    const { start, days } = getWindowStart(req.query.days);

    const [
        totalUsers,
        activeUsers,
        creatorUsers,
        bannedUsers,
        totalChannels,
        totalSubscriptions,
        totalTournaments,
        openTournaments,
        runningTournaments,
        completedTournaments,
        totalTeams,
        totalMatches,
        finishedMatches,
        totalRegistrations,
        verifiedGameAccounts,
        openTickets,
        successfulPayments,
        successfulPaymentTotals,
        walletCreditTotals,
        walletDebitTotals,
        usersByDayRows,
        tournamentsByDayRows,
        revenueByDayRows,
        tournamentsByStatus,
        tournamentsByGame,
        paymentsByStatus,
        usersByRole,
        topCreators,
        recentTournaments,
        recentUsers,
        recentTickets
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: "creator" }),
        User.countDocuments({ role: "banned" }),
        Channel.countDocuments({ isActive: true }),
        ChannelSubscription.countDocuments(),
        Tournament.countDocuments(),
        Tournament.countDocuments({ status: "open" }),
        Tournament.countDocuments({ status: "running" }),
        Tournament.countDocuments({ status: "completed" }),
        Team.countDocuments(),
        Match.countDocuments(),
        Match.countDocuments({ status: "finished" }),
        Registration.countDocuments(),
        GameAccount.countDocuments({ verified: true }),
        SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
        Payment.countDocuments({ status: "success" }),
        Payment.aggregate([
            { $match: { status: "success" } },
            { $group: { _id: null, amount: { $sum: "$amount" } } }
        ]),
        WalletTransaction.aggregate([
            { $match: { type: "credit" } },
            { $group: { _id: null, amount: { $sum: "$amount" } } }
        ]),
        WalletTransaction.aggregate([
            { $match: { type: "debit" } },
            { $group: { _id: null, amount: { $sum: "$amount" } } }
        ]),
        dailyCount(User, start),
        dailyCount(Tournament, start),
        dailyPaymentRevenue(start),
        countByField(Tournament, "status"),
        countByField(Tournament, "game"),
        countByField(Payment, "status"),
        User.aggregate([
            { $unwind: "$role" },
            { $group: { _id: "$role", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        Channel.aggregate([
            { $match: { isActive: true } },
            {
                $lookup: {
                    from: "tournaments",
                    localField: "owner",
                    foreignField: "organizer",
                    as: "tournaments"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            { $unwind: "$owner" },
            {
                $project: {
                    name: 1,
                    handle: 1,
                    memberCount: 1,
                    tournamentCount: { $size: "$tournaments" },
                    owner: {
                        _id: "$owner._id",
                        username: "$owner.username",
                        avatar: "$owner.avatar"
                    }
                }
            },
            { $sort: { memberCount: -1, tournamentCount: -1 } },
            { $limit: 5 }
        ]),
        Tournament.find()
            .populate("organizer", "username avatar")
            .populate("channel", "name handle")
            .sort({ createdAt: -1 })
            .limit(6)
            .select("title game type status entryFee prizePool maxPlayers startAt organizer channel createdAt"),
        User.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .select("username phone_number email role isActive createdAt"),
        SupportTicket.find()
            .populate("user", "username phone_number")
            .sort({ createdAt: -1 })
            .limit(6)
            .select("title type status user createdAt")
    ]);

    const totalRevenue = Number(successfulPaymentTotals[0]?.amount || 0);
    const totalCredits = Number(walletCreditTotals[0]?.amount || 0);
    const totalDebits = Number(walletDebitTotals[0]?.amount || 0);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                range: { days, start, end: new Date() },
                totals: {
                    users: totalUsers,
                    activeUsers,
                    creators: creatorUsers,
                    bannedUsers,
                    channels: totalChannels,
                    channelMembers: totalSubscriptions,
                    tournaments: totalTournaments,
                    openTournaments,
                    runningTournaments,
                    completedTournaments,
                    teams: totalTeams,
                    matches: totalMatches,
                    finishedMatches,
                    registrations: totalRegistrations,
                    verifiedGameAccounts,
                    openTickets,
                    successfulPayments,
                    totalRevenue,
                    walletCredits: totalCredits,
                    walletDebits: totalDebits,
                    netWalletFlow: totalCredits - totalDebits
                },
                charts: {
                    usersByDay: fillDailySeries(usersByDayRows, days, start),
                    tournamentsByDay: fillDailySeries(tournamentsByDayRows, days, start),
                    revenueByDay: fillDailySeries(revenueByDayRows, days, start, ["amount", "count"]),
                    tournamentsByStatus,
                    tournamentsByGame,
                    paymentsByStatus,
                    usersByRole
                },
                tables: {
                    topCreators,
                    recentTournaments,
                    recentUsers,
                    recentTickets
                }
            },
            "Admin dashboard fetched successfully"
        )
    );
});

export { getAdminDashboard };
