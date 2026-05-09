import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { Report, reportCategoryValues } from "../models/report.model.js";
import { TournamentBan } from "../models/tournamentBan.model.js";
import { ModerationAction } from "../models/moderationAction.model.js";
import { Tournament } from "../models/tournament.model.js";
import { Registration } from "../models/registration.model.js";
import { User } from "../models/user.model.js";
import { AdminAuditLog } from "../models/adminAuditLog.model.js";
import { createNotification, createNotifications } from "./notification.service.js";
import { emitToAdmins, emitToUser } from "./socket.service.js";
import { hasRole } from "../middlewares/auth.middleware.js";

const ADMIN_ROLES = ["super_admin", "admin", "moderator", "support", "tournament_manager"];
const ACTIVE_REPORT_STATUSES = ["open", "under_review"];
const ACTIVE_REGISTRATION_STATUSES = ["pending", "paid", "confirmed"];
const REPORT_DUPLICATE_WINDOW_MS = Math.max(60_000, Number(process.env.REPORT_DUPLICATE_WINDOW_MS || 12 * 60 * 60 * 1000));

export const REPORT_CATEGORIES = reportCategoryValues;
export const REPORT_TARGET_TYPES = ["creator", "player", "tournament", "team", "match", "system"];
export const REPORT_SEVERITIES = ["low", "medium", "high", "critical"];
export const REPORT_STATUSES = ["open", "under_review", "actioned", "resolved", "rejected", "closed"];
export const ADMIN_REVIEW_ACTIONS = ["none", "warn", "mute", "suspend", "tournament_ban", "global_ban", "reject", "resolve"];

const toObjectId = (value, fieldName, optional = false) => {
    if (!value) {
        if (optional) return null;
        throw new ApiError(400, `${fieldName} is required`);
    }

    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${fieldName}`);
    }

    return new mongoose.Types.ObjectId(value);
};

const compactText = (value = "", max = 2000) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);

const normalizeEvidence = (evidence = {}) => {
    const screenshots = Array.isArray(evidence.screenshots)
        ? evidence.screenshots
        : typeof evidence.screenshots === "string"
            ? evidence.screenshots.split(/[\n,]/)
            : [];

    return {
        screenshots: screenshots
            .map((item) => compactText(item, 500))
            .filter(Boolean)
            .slice(0, 5),
        videoUrl: compactText(evidence.videoUrl, 500),
        matchProof: compactText(evidence.matchProof || evidence.proof, 1500),
    };
};

const getActorRole = (user) => {
    if (hasRole(user, "super_admin", "admin")) return "admin";
    if (hasRole(user, "moderator", "support", "tournament_manager")) return "moderator";
    if (hasRole(user, "creator")) return "creator";
    return "player";
};

const getSeverityForCategory = (category, explicitSeverity) => {
    if (REPORT_SEVERITIES.includes(explicitSeverity)) return explicitSeverity;
    if (["fraud_scam", "cheating", "payout_not_distributed"].includes(category)) return "high";
    if (["abusive_behavior", "fake_results", "inappropriate_content"].includes(category)) return "medium";
    return "low";
};

const populateReportQuery = (query) =>
    query
        .populate("reporter", "username avatar role accountStatus")
        .populate("createdBy", "username avatar role accountStatus")
        .populate("reportedUser", "username avatar role accountStatus")
        .populate("reportedCreator", "username avatar role accountStatus")
        .populate("tournament", "title game status visibility organizer")
        .populate("reviewedBy", "username avatar role");

const serializeReport = (report) => {
    const plain = report?.toObject?.() || report;
    if (!plain) return null;
    return {
        ...plain,
        _id: plain._id?.toString?.() || plain._id,
    };
};

const notifyAdminsAboutReport = async (report) => {
    const adminUsers = await User.find({
        role: { $in: ADMIN_ROLES },
        isActive: true,
        accountStatus: { $ne: "banned" },
    })
        .select("_id")
        .limit(75)
        .lean();

    if (adminUsers.length > 0) {
        await createNotifications(adminUsers.map((adminUser) => ({
            user: adminUser._id,
            title: "New moderation report",
            body: `${report.title || "A report"} needs review.`,
            type: "report",
            priority: report.severity === "critical" || report.severity === "high" ? "high" : "normal",
            actionUrl: "/admin/moderation",
            data: { report: report._id, category: report.category, severity: report.severity },
        }))).catch((error) => {
            console.error("Failed to notify admins about report:", error.message);
        });
    }

    emitToAdmins("moderation:report:new", serializeReport(report));
};

const createModerationAction = (payload) => ModerationAction.create(payload);

const createAdminAuditLog = (payload) =>
    AdminAuditLog.create(payload).catch((error) => {
        console.error("Failed to write moderation audit log:", error.message);
    });

export const findActiveTournamentBan = async ({ tournamentId, playerId, creatorId }) => {
    if (!tournamentId || !playerId) return null;
    const now = new Date();
    const query = {
        player: playerId,
        status: "active",
        $or: [
            { tournament: tournamentId },
            ...(creatorId ? [{ creator: creatorId, scope: "creator" }] : []),
        ],
        $and: [
            {
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: now } },
                ],
            },
        ],
    };

    return TournamentBan.findOne(query).lean();
};

export const isUserBannedFromTournament = async ({ tournamentId, userId, organizerId }) =>
    Boolean(await findActiveTournamentBan({ tournamentId, playerId: userId, creatorId: organizerId }));

const assertCreatorTournamentAccess = async ({ actor, tournamentId }) => {
    const tournament = await Tournament.findById(tournamentId).select("title organizer status visibility entryFee joinedPlayers").lean();
    if (!tournament) throw new ApiError(404, "Tournament not found");

    const isAdmin = hasRole(actor, ...ADMIN_ROLES);
    if (!isAdmin && tournament.organizer?.toString() !== actor._id.toString()) {
        throw new ApiError(403, "You can only moderate players in your own tournaments");
    }

    return { tournament, isAdmin };
};

const findRegistrationForPlayer = (tournamentId, playerId) =>
    Registration.findOne({
        tournament: tournamentId,
        status: { $in: ACTIVE_REGISTRATION_STATUSES },
        $or: [
            { user: playerId },
            { team: playerId },
        ],
    });

export const createReport = async ({ actor, payload = {} }) => {
    const category = REPORT_CATEGORIES.includes(payload.category || payload.reason)
        ? (payload.category || payload.reason)
        : "other";
    const targetType = REPORT_TARGET_TYPES.includes(payload.targetType)
        ? payload.targetType
        : payload.tournament
            ? "tournament"
            : payload.reportedUser || payload.targetUser
                ? "player"
                : "system";
    const message = compactText(payload.message || payload.description || payload.content, 2000);
    const title = compactText(payload.title, 160) || `${targetType} report`;

    if (message.length < 12) {
        throw new ApiError(400, "Report details must be at least 12 characters");
    }

    const tournamentId = toObjectId(payload.tournament || payload.tournamentId, "tournament ID", true);
    let reportedUserId = toObjectId(payload.reportedUser || payload.targetUser, "reported user ID", true);
    let reportedCreatorId = toObjectId(payload.reportedCreator || payload.creator, "reported creator ID", true);
    let tournament = null;

    if (tournamentId) {
        tournament = await Tournament.findById(tournamentId).select("title organizer status").lean();
        if (!tournament) throw new ApiError(404, "Tournament not found");
        if (targetType === "creator" && !reportedCreatorId) {
            reportedCreatorId = tournament.organizer;
        }
    }

    if (targetType === "creator" && !reportedCreatorId && reportedUserId) {
        reportedCreatorId = reportedUserId;
        reportedUserId = null;
    }

    const targetIds = [reportedUserId, reportedCreatorId].filter(Boolean).map((id) => id.toString());
    if (targetIds.includes(actor._id.toString())) {
        throw new ApiError(400, "You cannot report yourself");
    }

    const actorRole = getActorRole(actor);
    if (actorRole === "creator" && targetType === "player") {
        if (!tournamentId || !reportedUserId) {
            throw new ApiError(400, "Creator player reports require tournament and player details");
        }
        const { tournament: ownedTournament } = await assertCreatorTournamentAccess({ actor, tournamentId });
        tournament = ownedTournament;
        const registration = await findRegistrationForPlayer(tournamentId, reportedUserId).select("_id").lean();
        if (!registration) {
            throw new ApiError(403, "You can only report players who joined your tournament");
        }
    }

    const duplicateQuery = {
        reporter: actor._id,
        category,
        targetType,
        status: { $in: ACTIVE_REPORT_STATUSES },
        createdAt: { $gte: new Date(Date.now() - REPORT_DUPLICATE_WINDOW_MS) },
    };
    if (tournamentId) duplicateQuery.tournament = tournamentId;
    if (reportedUserId) duplicateQuery.reportedUser = reportedUserId;
    if (reportedCreatorId) duplicateQuery.reportedCreator = reportedCreatorId;

    const duplicate = await Report.findOne(duplicateQuery).select("_id").lean();
    if (duplicate) {
        throw new ApiError(409, "A similar report is already open. Please wait for review before submitting again.");
    }

    const report = await Report.create({
        reporter: actor._id,
        createdBy: actor._id,
        reporterRole: actorRole === "creator" ? "creator" : actorRole === "admin" || actorRole === "moderator" ? actorRole : "player",
        targetType,
        category,
        reason: category,
        title,
        message,
        content: message,
        tournament: tournamentId,
        reportedUser: reportedUserId,
        reportedCreator: reportedCreatorId,
        evidence: normalizeEvidence(payload.evidence),
        severity: getSeverityForCategory(category, payload.severity),
        status: "open",
        duplicateKey: [
            actor._id,
            category,
            targetType,
            tournamentId || "none",
            reportedUserId || reportedCreatorId || "none",
        ].join(":"),
        metadata: {
            source: payload.source || "web",
            client: payload.client || "",
        },
    });

    await Promise.allSettled([
        createModerationAction({
            actor: actor._id,
            actorRole,
            action: "report_created",
            targetUser: reportedUserId || reportedCreatorId,
            tournament: tournamentId,
            report: report._id,
            note: title,
            metadata: { category, targetType, severity: report.severity },
        }),
        createNotification({
            user: actor._id,
            title: "Report submitted",
            body: "Your report was sent to moderation for review.",
            type: "report",
            actionUrl: "/notifications",
            data: { report: report._id },
        }),
        notifyAdminsAboutReport(report),
    ]);

    return populateReportQuery(Report.findById(report._id));
};

export const listReports = async (filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const query = {};
    const andFilters = [];

    if (filters.status && REPORT_STATUSES.includes(filters.status)) query.status = filters.status;
    if (filters.category && REPORT_CATEGORIES.includes(filters.category)) query.category = filters.category;
    if (filters.targetType && REPORT_TARGET_TYPES.includes(filters.targetType)) query.targetType = filters.targetType;
    if (filters.severity && REPORT_SEVERITIES.includes(filters.severity)) query.severity = filters.severity;
    if (filters.tournament) query.tournament = toObjectId(filters.tournament, "tournament ID");
    if (filters.user) {
        const userId = toObjectId(filters.user, "user ID");
        andFilters.push({ $or: [{ reporter: userId }, { reportedUser: userId }, { reportedCreator: userId }] });
    }
    if (filters.reporter) query.reporter = toObjectId(filters.reporter, "reporter ID");
    if (filters.creator) query.reportedCreator = toObjectId(filters.creator, "creator ID");
    if (filters.search) {
        const search = compactText(filters.search, 80);
        andFilters.push({ $or: [
            { title: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } },
            { content: { $regex: search, $options: "i" } },
        ] });
    }
    if (andFilters.length > 0) query.$and = andFilters;

    const [reports, total] = await Promise.all([
        populateReportQuery(
            Report.find(query)
                .sort({ status: 1, severity: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ),
        Report.countDocuments(query),
    ]);

    return {
        reports,
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
    };
};

export const listMyReports = async ({ actor, filters = {} }) => {
    return listReports({
        ...filters,
        reporter: actor._id,
        limit: filters.limit || 20,
    });
};

export const createTournamentBan = async ({ actor, tournamentId, playerId, reason, note = "", expiresAt = null, removeRegistration = false, reportId = null }) => {
    const tournamentObjectId = toObjectId(tournamentId, "tournament ID");
    const playerObjectId = toObjectId(playerId, "player ID");
    const { tournament, isAdmin } = await assertCreatorTournamentAccess({ actor, tournamentId: tournamentObjectId });

    if (tournament.organizer?.toString() === playerObjectId.toString()) {
        throw new ApiError(400, "Creator cannot ban themselves from their tournament");
    }

    const player = await User.findById(playerObjectId).select("username").lean();
    if (!player) throw new ApiError(404, "Player not found");

    const registration = await findRegistrationForPlayer(tournamentObjectId, playerObjectId);
    if (!registration && !isAdmin) {
        throw new ApiError(403, "You can only ban players who joined your tournament");
    }

    const banReason = compactText(reason, 500);
    if (banReason.length < 4) {
        throw new ApiError(400, "Ban reason is required");
    }

    let removedRegistration = false;
    if (removeRegistration && registration) {
        if (Number(registration.paidAmount || 0) > 0 || registration.status === "paid") {
            throw new ApiError(400, "Paid players need the admin refund flow before removal");
        }
        const teamSize = Array.isArray(registration.team) ? registration.team.length : 0;
        if (teamSize > 1) {
            throw new ApiError(400, "Team registrations must be removed by admin review");
        }
        registration.status = "cancelled";
        await registration.save();
        await Tournament.updateOne({ _id: tournamentObjectId }, { $pull: { joinedPlayers: playerObjectId } });
        removedRegistration = true;
    }

    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
    if (parsedExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
        throw new ApiError(400, "Ban expiry must be a valid date");
    }

    const ban = await TournamentBan.findOneAndUpdate(
        { tournament: tournamentObjectId, player: playerObjectId, status: "active" },
        {
            $set: {
                tournament: tournamentObjectId,
                player: playerObjectId,
                creator: tournament.organizer,
                scope: "tournament",
                reason: banReason,
                note: compactText(note, 1000),
                status: "active",
                expiresAt: parsedExpiresAt,
                bannedBy: actor._id,
                bannedAt: new Date(),
                revokedBy: null,
                revokedAt: null,
                metadata: { removedRegistration, report: reportId || null },
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await Promise.allSettled([
        createModerationAction({
            actor: actor._id,
            actorRole: getActorRole(actor) === "creator" ? "creator" : "admin",
            action: removedRegistration ? "player_removed" : "tournament_ban",
            targetUser: playerObjectId,
            tournament: tournamentObjectId,
            report: reportId,
            ban: ban._id,
            note: banReason,
            metadata: { expiresAt: parsedExpiresAt, removedRegistration },
        }),
        createAdminAuditLog({
            actor: actor._id,
            targetUser: playerObjectId,
            action: "tournament_ban",
            entity: "tournament",
            entityId: tournamentObjectId,
            note: banReason,
            metadata: { ban: ban._id, expiresAt: parsedExpiresAt, removedRegistration },
        }),
        createNotification({
            user: playerObjectId,
            title: "Tournament access restricted",
            body: `You were banned from ${tournament.title}. Reason: ${banReason}`,
            type: "moderation",
            priority: "high",
            actionUrl: `/tournament/${tournamentObjectId}`,
            data: { tournament: tournamentObjectId, ban: ban._id, expiresAt: parsedExpiresAt },
        }),
    ]);

    emitToUser(playerObjectId, "moderation:ban", {
        tournament: tournamentObjectId.toString(),
        ban: ban._id.toString(),
        reason: banReason,
    });
    emitToAdmins("moderation:ban", { tournament: tournamentObjectId.toString(), player: playerObjectId.toString(), ban: ban._id.toString() });

    return TournamentBan.findById(ban._id)
        .populate("player", "username avatar phone_number")
        .populate("creator", "username avatar")
        .populate("tournament", "title game status")
        .populate("bannedBy", "username role")
        .lean();
};

export const revokeTournamentBan = async ({ actor, tournamentId, playerId, note = "" }) => {
    const tournamentObjectId = toObjectId(tournamentId, "tournament ID");
    const playerObjectId = toObjectId(playerId, "player ID");
    const { tournament } = await assertCreatorTournamentAccess({ actor, tournamentId: tournamentObjectId });

    const ban = await TournamentBan.findOneAndUpdate(
        { tournament: tournamentObjectId, player: playerObjectId, status: "active" },
        {
            $set: {
                status: "revoked",
                revokedBy: actor._id,
                revokedAt: new Date(),
                note: compactText(note, 1000),
            },
        },
        { new: true }
    );
    if (!ban) throw new ApiError(404, "Active ban not found");

    await Promise.allSettled([
        createModerationAction({
            actor: actor._id,
            actorRole: getActorRole(actor) === "creator" ? "creator" : "admin",
            action: "tournament_unban",
            targetUser: playerObjectId,
            tournament: tournamentObjectId,
            ban: ban._id,
            note: compactText(note, 1000),
        }),
        createNotification({
            user: playerObjectId,
            title: "Tournament ban removed",
            body: `You can join and interact with ${tournament.title} again.`,
            type: "moderation",
            actionUrl: `/tournament/${tournamentObjectId}`,
            data: { tournament: tournamentObjectId, ban: ban._id },
        }),
    ]);

    emitToUser(playerObjectId, "moderation:unban", {
        tournament: tournamentObjectId.toString(),
        ban: ban._id.toString(),
    });
    emitToAdmins("moderation:unban", { tournament: tournamentObjectId.toString(), player: playerObjectId.toString(), ban: ban._id.toString() });

    return ban.toObject();
};

export const listTournamentBans = async ({ actor, tournamentId, status = "active", page = 1, limit = 50 }) => {
    const tournamentObjectId = toObjectId(tournamentId, "tournament ID");
    await assertCreatorTournamentAccess({ actor, tournamentId: tournamentObjectId });

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const query = { tournament: tournamentObjectId };
    if (status && ["active", "revoked", "expired"].includes(status)) query.status = status;

    const [bans, total] = await Promise.all([
        TournamentBan.find(query)
            .populate("player", "username avatar phone_number")
            .populate("creator", "username avatar")
            .populate("bannedBy", "username role")
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .lean(),
        TournamentBan.countDocuments(query),
    ]);

    return { bans, total, page: safePage, limit: safeLimit, pages: Math.max(1, Math.ceil(total / safeLimit)) };
};

export const listModerationActions = async (filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 30, 1), 100);
    const query = {};
    if (filters.tournament) query.tournament = toObjectId(filters.tournament, "tournament ID");
    if (filters.user) query.targetUser = toObjectId(filters.user, "user ID");
    if (filters.action) query.action = filters.action;

    const [actions, total] = await Promise.all([
        ModerationAction.find(query)
            .populate("actor", "username role avatar")
            .populate("targetUser", "username avatar role accountStatus")
            .populate("tournament", "title game status")
            .populate("report", "title category status severity")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        ModerationAction.countDocuments(query),
    ]);

    return { actions, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};

export const reviewReport = async ({ actor, reportId, payload = {} }) => {
    const reportObjectId = toObjectId(reportId, "report ID");
    const report = await Report.findById(reportObjectId);
    if (!report) throw new ApiError(404, "Report not found");

    const nextStatus = REPORT_STATUSES.includes(payload.status) ? payload.status : "under_review";
    const action = ADMIN_REVIEW_ACTIONS.includes(payload.action) ? payload.action : "none";
    const adminNote = compactText(payload.note || payload.adminResponse || payload.resolution, 1000);
    const targetUser = toObjectId(payload.targetUser || report.reportedUser || report.reportedCreator, "target user ID", true);

    let ban = null;
    if (action === "warn") {
        if (!targetUser) throw new ApiError(400, "Target user is required for warnings");
        await createNotification({
            user: targetUser,
            title: "Moderation warning",
            body: adminNote || "A moderator reviewed a report and issued a warning.",
            type: "moderation",
            priority: "high",
            actionUrl: "/notifications",
            data: { report: report._id },
        });
    }

    if (action === "mute" || action === "suspend" || action === "global_ban") {
        if (!targetUser) throw new ApiError(400, "Target user is required for account moderation");
        const user = await User.findById(targetUser);
        if (!user) throw new ApiError(404, "Target user not found");
        const durationHours = Math.min(Math.max(Number(payload.durationHours) || 24, 1), 24 * 30);
        const until = new Date(Date.now() + durationHours * 60 * 60 * 1000);

        if (action === "mute") {
            user.accountStatus = "muted";
            user.mutedUntil = until;
        }
        if (action === "suspend") {
            user.accountStatus = "suspended";
            user.suspendedUntil = until;
        }
        if (action === "global_ban") {
            const roles = Array.isArray(user.role) ? user.role : [];
            user.role = [...new Set([...roles, "banned"])];
            user.accountStatus = "banned";
            user.isActive = false;
        }
        user.moderationNote = adminNote;
        await user.save({ validateBeforeSave: false });

        await createNotification({
            user: targetUser,
            title: action === "global_ban" ? "Account banned" : action === "suspend" ? "Account suspended" : "Account muted",
            body: adminNote || "A moderator took action on your account after review.",
            type: "moderation",
            priority: "high",
            actionUrl: "/profile",
            data: { report: report._id, action, until: action === "global_ban" ? null : until },
            email: action !== "mute",
        });
    }

    if (action === "tournament_ban") {
        if (!report.tournament || !targetUser) throw new ApiError(400, "Tournament and target user are required for tournament bans");
        ban = await createTournamentBan({
            actor,
            tournamentId: report.tournament,
            playerId: targetUser,
            reason: adminNote || report.title || report.category,
            note: adminNote,
            expiresAt: payload.expiresAt || null,
            reportId: report._id,
        });
    }

    report.status = action === "reject" ? "rejected" : action === "resolve" ? "resolved" : nextStatus;
    if (["warn", "mute", "suspend", "tournament_ban", "global_ban"].includes(action)) {
        report.status = "actioned";
    }
    report.reviewedBy = actor._id;
    report.reviewedAt = new Date();
    report.resolution = adminNote;
    report.adminResponse = adminNote || report.adminResponse;
    report.metadata = {
        ...(report.metadata || {}),
        reviewAction: action,
        ban: ban?._id || null,
    };
    await report.save();

    await Promise.allSettled([
        createModerationAction({
            actor: actor._id,
            actorRole: getActorRole(actor) === "creator" ? "admin" : getActorRole(actor),
            action: action === "none" || action === "reject" || action === "resolve" ? "report_reviewed" : action,
            targetUser,
            tournament: report.tournament,
            report: report._id,
            ban: ban?._id || null,
            note: adminNote,
            metadata: { status: report.status, action },
        }),
        createAdminAuditLog({
            actor: actor._id,
            targetUser,
            action: `report_${action}`,
            entity: "report",
            entityId: report._id,
            note: adminNote,
            metadata: { status: report.status, action, ban: ban?._id || null },
        }),
        createNotification({
            user: report.reporter || report.createdBy,
            title: "Report reviewed",
            body: adminNote || `Your report was marked ${report.status}.`,
            type: "report",
            actionUrl: "/notifications",
            data: { report: report._id, status: report.status },
        }),
    ]);

    const populatedReport = await populateReportQuery(Report.findById(report._id));
    emitToAdmins("moderation:report:updated", serializeReport(populatedReport));
    return populatedReport;
};
