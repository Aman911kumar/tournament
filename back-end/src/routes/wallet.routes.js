import express from "express";
import {
  addFundsToWallet,
  getCreatorEarnings,
  getWalletBalance,
  getWalletTransaction,
  withdrawFunds,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getWalletTransaction);
router.get("/creator-earnings", protect, getCreatorEarnings);
router.post("/add", protect, addFundsToWallet);
router.post("/withdraw", protect, withdrawFunds);

export default router;
