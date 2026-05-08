import express from "express";
import {
  createSystemNotification,
  deleteNotification,
  deletePushSubscription,
  getUnreadNotificationCount,
  getUserNotifications,
  getNotificationPushConfig,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  savePushSubscription,
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getUserNotifications);
router.get("/unread-count", protect, getUnreadNotificationCount);
router.get("/push/config", protect, getNotificationPushConfig);
router.post("/push/subscribe", protect, savePushSubscription);
router.delete("/push/subscribe", protect, deletePushSubscription);
router.post("/system", protect, createSystemNotification);
router.post("/mark-all-read", protect, markAllNotificationsAsRead);
router.post("/:notificationId/read", protect, markNotificationAsRead);
router.delete("/:notificationId", protect, deleteNotification);

export default router;
