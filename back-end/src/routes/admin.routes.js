import express from "express";
import {
  getAdminDashboard,
  getWithdrawalRequests,
  updateWithdrawalStatus,
  updateCreatorPermission,
  getAdminCollections,
  getAdminCollectionRecords,
} from "../controllers/admin.controller.js";
import { protect, admin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", protect, admin, getAdminDashboard);
router.get("/withdrawals", protect, admin, getWithdrawalRequests);
router.patch("/withdrawals/:id/status", protect, admin, updateWithdrawalStatus);
router.patch("/users/:id/creator", protect, admin, updateCreatorPermission);
router.get("/collections", protect, admin, getAdminCollections);
router.get("/collections/:collection", protect, admin, getAdminCollectionRecords);

export default router;
