import express from "express"
import {
    createGameAccount,
    getUserGameAccounts,
    getGameAccountById,
    updateGameAccount,
    deleteGameAccount,
    verifyGameAccount,
} from "../controllers/gameAccount.controller.js"

import { protect } from "../middlewares/auth.middleware.js"

const router = express.Router();

// Protected routes
router.post("/", protect, createGameAccount);
router.get("/", protect, getUserGameAccounts);
router.get("/:accountId", protect, getGameAccountById);
router.patch("/:accountId", protect, updateGameAccount);
router.delete("/:accountId", protect, deleteGameAccount);
router.get("/:accountId/verify",protect,verifyGameAccount)

export default router