import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { creditWallet, debitWallet } from "../services/wallet.service.js";
import { User } from '../models/user.model.js'

const addMoney = asyncHandler(async (req, res) => {
    const { amount } = req.body;

    const tx = await creditWallet({
        user: req.user._id,
        amount,
        category: "DEPOSIT",
        idempotencyKey: `DEPOSIT_${req.user._id}_${Date.now()}`,
    });
    res.status(200).json(
        new ApiResponse(200, tx, "Money added")
    );
});

const withdrawMoney = asyncHandler(async (req, res) => {
    const { amount } = req.body;

    const tx = await debitWallet({
        user: req.user._id,
        amount,
        category: "WITHDRAW",
        idempotencyKey: `WITHDRAW_${req.user._id}_${Date.now()}`,
    });

    res.json(new ApiResponse({ message: "Withdraw success", data: tx }));
});

export {
    withdrawMoney,
    addMoney
}