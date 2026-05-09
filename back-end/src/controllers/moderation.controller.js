import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
    createReport,
    createTournamentBan,
    listModerationActions,
    listMyReports,
    listReports,
    listTournamentBans,
    reviewReport,
    revokeTournamentBan,
} from "../services/moderation.service.js";

const getParamId = (req, key) => req.params[key] || req.params.id;

const submitReport = asyncHandler(async (req, res) => {
    const report = await createReport({ actor: req.user, payload: req.body });
    return res.status(201).json(
        new ApiResponse(201, report, "Report submitted for moderation review")
    );
});

const getMyReports = asyncHandler(async (req, res) => {
    const result = await listMyReports({ actor: req.user, filters: req.query });
    return res.status(200).json(
        new ApiResponse(200, result, "Your reports fetched successfully")
    );
});

const getReports = asyncHandler(async (req, res) => {
    const result = await listReports(req.query);
    return res.status(200).json(
        new ApiResponse(200, result, "Moderation reports fetched successfully")
    );
});

const reviewModerationReport = asyncHandler(async (req, res) => {
    const reportId = getParamId(req, "reportId");
    const report = await reviewReport({ actor: req.user, reportId, payload: req.body });
    return res.status(200).json(
        new ApiResponse(200, report, "Report reviewed successfully")
    );
});

const banTournamentPlayer = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const ban = await createTournamentBan({
        actor: req.user,
        tournamentId,
        playerId: req.body.playerId,
        reason: req.body.reason,
        note: req.body.note,
        expiresAt: req.body.expiresAt,
        removeRegistration: Boolean(req.body.removeRegistration),
        reportId: req.body.reportId || null,
    });

    return res.status(201).json(
        new ApiResponse(201, ban, "Player banned from tournament")
    );
});

const unbanTournamentPlayer = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const playerId = getParamId(req, "playerId");
    const ban = await revokeTournamentBan({
        actor: req.user,
        tournamentId,
        playerId,
        note: req.body?.note || "",
    });

    return res.status(200).json(
        new ApiResponse(200, ban, "Player unbanned from tournament")
    );
});

const getTournamentBans = asyncHandler(async (req, res) => {
    const tournamentId = getParamId(req, "tournamentId");
    const result = await listTournamentBans({ actor: req.user, tournamentId, ...req.query });
    return res.status(200).json(
        new ApiResponse(200, result, "Tournament bans fetched successfully")
    );
});

const getModerationActions = asyncHandler(async (req, res) => {
    const result = await listModerationActions(req.query);
    return res.status(200).json(
        new ApiResponse(200, result, "Moderation actions fetched successfully")
    );
});

export {
    submitReport,
    getMyReports,
    getReports,
    reviewModerationReport,
    banTournamentPlayer,
    unbanTournamentPlayer,
    getTournamentBans,
    getModerationActions,
};
