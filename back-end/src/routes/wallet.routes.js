import express from "express";
import {
  getCreatorEarnings,
  getWalletBalance,
  getWalletTransaction,
  getTransactionDetails,
  getPaymentDetails,
  getPlayerEarnings
} from "../controllers/user.controller.js";
import { addMoney, verifyAddMoney, updateAddMoneyStatus, withdrawMoney, transferMoney } from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getWalletTransaction);
router.get("/transaction/:id", protect, getTransactionDetails);
router.get("/payment/:id", protect, getPaymentDetails);
router.get("/creator-earnings", protect, getCreatorEarnings);
router.get("/player-earnings", protect, getPlayerEarnings);
router.post("/add", protect, addMoney);
router.post("/add/verify", protect, verifyAddMoney);
router.post("/add/status", protect, updateAddMoneyStatus);
router.post("/withdraw", protect, withdrawMoney);
router.post("/transfer", protect, transferMoney);

export default router;
