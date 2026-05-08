import express from "express";
import {
  getCreatorEarnings,
  getWalletBalance,
  getWalletTransaction,
  getTransactionDetails,
  getPaymentDetails,
  getPlayerEarnings
} from "../controllers/user.controller.js";
import {
  addMoney,
  verifyAddMoney,
  updateAddMoneyStatus,
  withdrawMoney,
  transferMoney,
  getTransferPinStatus,
  setupTransferPin,
  getPayoutMethods,
  savePayoutMethod,
  updatePayoutMethod,
  deletePayoutMethod,
} from "../controllers/wallet.controller.js";
import { protect, requireVerifiedContact } from "../middlewares/auth.middleware.js";
import { walletLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getWalletTransaction);
router.get("/transaction/:id", protect, getTransactionDetails);
router.get("/payment/:id", protect, getPaymentDetails);
router.get("/creator-earnings", protect, getCreatorEarnings);
router.get("/player-earnings", protect, getPlayerEarnings);
router.get("/transfer-pin", protect, getTransferPinStatus);
router.put("/transfer-pin", walletLimiter, protect, setupTransferPin);
router.get("/payout-methods", protect, getPayoutMethods);
router.post("/payout-methods", walletLimiter, protect, savePayoutMethod);
router.patch("/payout-methods/:id", walletLimiter, protect, updatePayoutMethod);
router.delete("/payout-methods/:id", walletLimiter, protect, deletePayoutMethod);
router.post("/add", walletLimiter, protect, addMoney);
router.post("/add/verify", walletLimiter, protect, verifyAddMoney);
router.post("/add/status", walletLimiter, protect, updateAddMoneyStatus);
router.post("/withdraw", walletLimiter, protect, requireVerifiedContact, withdrawMoney);
router.post("/transfer", walletLimiter, protect, requireVerifiedContact, transferMoney);

export default router;
