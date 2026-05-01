import express from "express";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getUserNotifications);
router.post("/mark-all-read", protect, markAllNotificationsAsRead);
router.post("/:notificationId/read", protect, markNotificationAsRead);

export default router;
