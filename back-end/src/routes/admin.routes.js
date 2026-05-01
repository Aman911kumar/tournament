import express from "express";
import { getAdminDashboard } from "../controllers/admin.controller.js";
import { protect, admin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", protect, admin, getAdminDashboard);

export default router;
