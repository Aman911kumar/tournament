import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { creditWallet, debitWallet } from "../services/wallet.service.js";
import { User } from '../models/user.model.js'
import { Wallet } from "../models/wallet.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { Ledger } from "../models/ledger.model.js";
import { calculateFeeSplit, getPlatformFeePercent } from "../utils/money.js";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const transferMoney = asyncHandler(async (req, res) => {
    const { recipient, amount, note } = req.body;
    const transferAmount = Number(amount);

    if (!recipient || String(recipient).trim() === "") {
        throw new ApiError(400, "Recipient username, phone, email, or user ID is required");
    }

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new ApiError(400, "Transfer amount must be greater than 0");
    }

    const recipientValue = String(recipient).trim();
    const recipientQuery = mongoose.Types.ObjectId.isValid(recipientValue)
        ? { _id: recipientValue }
        : {
            $or: [
                { username: { $regex: `^${escapeRegExp(recipientValue)}$`, $options: "i" } },
                { phone_number: recipientValue },
                { email: recipientValue.toLowerCase() }
            ]
        };

    const receiver = await User.findOne(recipientQuery).select("_id username phone_number role isActive");
    if (!receiver || !receiver.isActive) {
        throw new ApiError(404, "Recipient not found");
    }

    if (receiver._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot transfer money to yourself");
    }

    const feePercent = getPlatformFeePercent("WALLET_TRANSFER");
    const { platformFee, netAmount } = calculateFeeSplit(transferAmount, feePercent);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const senderWallet = await Wallet.findOne({ user: req.user._id }).session(session);
        const receiverWallet = await Wallet.findOne({ user: receiver._id }).session(session);

        if (!senderWallet) throw new ApiError(404, "Sender wallet not found");
        if (!receiverWallet) throw new ApiError(404, "Recipient wallet not found");
        if (senderWallet.balance < transferAmount) throw new ApiError(400, "Insufficient wallet balance");

        const transferRef = uuidv4();
        const senderBefore = senderWallet.balance;
        senderWallet.balance = senderBefore - transferAmount;
        senderWallet.lastTransactionAt = new Date();
        await senderWallet.save({ session });

        const receiverBefore = receiverWallet.balance;
        receiverWallet.balance = receiverBefore + netAmount;
        receiverWallet.lastTransactionAt = new Date();
        await receiverWallet.save({ session });

        const senderTx = await WalletTransaction.create([{
            transactionId: uuidv4(),
            user: req.user._id,
            walletId: senderWallet._id,
            type: "DEBIT",
            category: "WALLET_TRANSFER",
            amount: transferAmount,
            grossAmount: transferAmount,
            platformFee,
            netAmount,
            balanceBefore: senderBefore,
            balanceAfter: senderWallet.balance,
            status: "SUCCESS",
            referenceId: transferRef,
            fromUser: req.user._id,
            toUser: receiver._id,
            description: note?.trim() || `Transfer to ${receiver.username}`,
            metadata: { note: note?.trim() || "", feePercent }
        }], { session, ordered: true });

        const receiverTx = await WalletTransaction.create([{
            transactionId: uuidv4(),
            user: receiver._id,
            walletId: receiverWallet._id,
            type: "CREDIT",
            category: "WALLET_TRANSFER",
            amount: netAmount,
            grossAmount: transferAmount,
            platformFee,
            netAmount,
            balanceBefore: receiverBefore,
            balanceAfter: receiverWallet.balance,
            status: "SUCCESS",
            referenceId: transferRef,
            fromUser: req.user._id,
            toUser: receiver._id,
            description: note?.trim() || `Transfer from ${req.user.username}`,
            metadata: { note: note?.trim() || "", feePercent }
        }], { session, ordered: true });

        await Ledger.create([
            {
                transactionId: senderTx[0].transactionId,
                debitAccount: "USER_WALLET",
                creditAccount: "USER_WALLET",
                fromUser: req.user._id,
                toUser: receiver._id,
                category: "WALLET_TRANSFER",
                referenceId: transferRef,
                amount: netAmount,
                currency: "INR",
                platformFee,
                netAmount,
                status: "SUCCESS",
                metadata: { note: note?.trim() || "", feePercent, receiverTransactionId: receiverTx[0].transactionId }
            },
            ...(platformFee > 0 ? [{
                transactionId: senderTx[0].transactionId,
                debitAccount: "USER_WALLET",
                creditAccount: "PLATFORM_FEE",
                fromUser: req.user._id,
                toUser: null,
                category: "WALLET_TRANSFER_FEE",
                referenceId: transferRef,
                amount: platformFee,
                currency: "INR",
                platformFee,
                netAmount: 0,
                status: "SUCCESS",
                metadata: { feePercent }
            }] : [])
        ], { session, ordered: true });

        await session.commitTransaction();

        res.status(200).json(
            new ApiResponse(200, {
                senderTransaction: senderTx[0],
                receiverTransaction: receiverTx[0],
                transfer: {
                    grossAmount: transferAmount,
                    platformFee,
                    netAmount,
                    fromUser: req.user._id,
                    toUser: receiver._id,
                    referenceId: transferRef
                }
            }, "Money transferred successfully")
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

export {
    withdrawMoney,
    addMoney,
    transferMoney
}
