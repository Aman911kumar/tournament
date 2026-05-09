import express from "express";
import {
  getAdminDashboard,
  getWithdrawalRequests,
  updateWithdrawalStatus,
  updateCreatorPermission,
  getAdminCollections,
  getAdminCollectionRecords,
  getAdminUserTransactionHistory,
  getAdminMonitoring,
  updateUserModerationStatus,
} from "../controllers/admin.controller.js";
import { protect, requireAdminPermission } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", protect, requireAdminPermission("dashboard:read"), getAdminDashboard);
router.get("/monitoring", protect, requireAdminPermission("monitoring:read"), getAdminMonitoring);
router.get("/withdrawals", protect, requireAdminPermission("finance:read"), getWithdrawalRequests);
router.patch("/withdrawals/:id/status", protect, requireAdminPermission("finance:write"), updateWithdrawalStatus);
router.patch("/users/:id/creator", protect, requireAdminPermission("users:write"), updateCreatorPermission);
router.patch("/users/:id/moderation", protect, requireAdminPermission("users:write", "moderation:write"), updateUserModerationStatus);
router.get("/users/:id/transactions", protect, requireAdminPermission("finance:read"), getAdminUserTransactionHistory);
router.get("/collections", protect, requireAdminPermission("database:read"), getAdminCollections);
router.get("/collections/:collection", protect, requireAdminPermission("database:read"), getAdminCollectionRecords);

export default router;
