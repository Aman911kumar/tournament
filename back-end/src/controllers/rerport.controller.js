import asyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { Report } from '../models/report.model.js';
import { hasRole } from '../middlewares/auth.middleware.js';
import mongoose from 'mongoose';

const getParamId = (req, key) => req.params[key] || req.params.id;

// ---------------------------------
// GET ALL REPORTS (Optional: By Tournament)
// ---------------------------------
const getAllReports = asyncHandler(async (req, res) => {
    const { tournamentId, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (tournamentId) {
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            throw new ApiError(400, "Invalid tournament ID");
        }
        query.tournament = tournamentId;
    }

    const reports = await Report.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

    const total = await Report.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, { reports, total }, "Reports fetched successfully")
    );
});

// ---------------------------------
// GET REPORT BY ID
// ---------------------------------
const getReportById = asyncHandler(async (req, res) => {
    const reportId = getParamId(req, "reportId");

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new ApiError(400, "Invalid report ID");
    }

    const report = await Report.findById(reportId);
    if (!report) throw new ApiError(404, "Report not found");

    return res.status(200).json(
        new ApiResponse(200, report, "Report fetched successfully")
    );
});

// ---------------------------------
// CREATE REPORT (Creator/Admin or Player)
// ---------------------------------
const createReport = asyncHandler(async (req, res) => {
    const { tournamentId, content, scores } = req.body;

    if (!tournamentId || !content) {
        throw new ApiError(400, "Tournament and content are required");
    }

    const report = await Report.create({
        tournament: tournamentId,
        content,
        scores: scores || [],
        createdBy: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(200, report, "Report created successfully")
    );
});

// ---------------------------------
// UPDATE REPORT (Creator/Admin Only)
// ---------------------------------
const updateReport = asyncHandler(async (req, res) => {
    const reportId = getParamId(req, "reportId");
    const updates = req.body;

    const report = await Report.findById(reportId);
    if (!report) throw new ApiError(404, "Report not found");
    if (report.createdBy.toString() !== req.user._id.toString() && !hasRole(req.user, "admin")) {
        throw new ApiError(403, "Not authorized to update this report");
    }

    Object.keys(updates).forEach(key => report[key] = updates[key]);
    await report.save();

    return res.status(200).json(
        new ApiResponse(200, report, "Report updated successfully")
    );
});

// ---------------------------------
// DELETE REPORT (Creator/Admin Only)
// ---------------------------------
const deleteReport = asyncHandler(async (req, res) => {
    const reportId = getParamId(req, "reportId");

    const report = await Report.findById(reportId);
    if (!report) throw new ApiError(404, "Report not found");
    if (report.createdBy.toString() !== req.user._id.toString() && !hasRole(req.user, "admin")) {
        throw new ApiError(403, "Not authorized to delete this report");
    }

    await report.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Report deleted successfully")
    );
});

export {
    getAllReports,
    getReportById,
    createReport,
    updateReport,
    deleteReport
};
