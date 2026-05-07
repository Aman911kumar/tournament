import express from "express";
import { recordFrontendMetric } from "../services/monitoring.service.js";
import ApiResponse from "../utils/ApiResponse.js";

const router = express.Router();

router.post("/frontend", (req, res) => {
    recordFrontendMetric(req.body, req);
    res.status(202).json(new ApiResponse(202, { accepted: true }, "Frontend metric accepted"));
});

export default router;
