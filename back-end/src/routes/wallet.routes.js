import express from "express";
import {
  getCreatorEarnings,
  getWalletBalance,
  getWalletTransaction,
  getTransactionDetails
} from "../controllers/user.controller.js";
import { addMoney,withdrawMoney, transferMoney } from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/balance", protect, getWalletBalance);
router.get("/transactions", protect, getWalletTransaction);
router.get("/transaction/:id", protect, getTransactionDetails);
router.get("/creator-earnings", protect, getCreatorEarnings);
router.post("/add", protect, addMoney);
router.post("/withdraw", protect, withdrawMoney);
router.post("/transfer", protect, transferMoney);

export default router;
