import mongoose from "mongoose";
import {Wallet} from "../models/wallet.model.js";
import ApiError from "../utils/ApiError.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { Ledger } from "../models/ledger.model.js";
import { calculateFeeSplit, getPlatformFeePercent } from "../utils/money.js";
import { v4 as uuidv4 } from "uuid";

export async function creditWallet({ user, amount, category, idempotencyKey, fromUser = null, toUser = user, referenceId = null, metadata = {} }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 🔁 Idempotency check
        const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const feePercent = getPlatformFeePercent(category);
        const { grossAmount, platformFee, netAmount } = calculateFeeSplit(amount, feePercent);
        const transactionMetadata = { ...metadata, feePercent };

        const wallet = await Wallet.findOneAndUpdate(
            { user, status: "ACTIVE" },
            { $inc: { balance: netAmount }, $set: { lastTransactionAt: new Date() } },
            { session, new: false }
        );

        if (!wallet) throw new ApiError(1002, "Wallet not found or inactive");

        const before = Number(wallet.balance || 0);
        const after = before + netAmount;

        const tx = await WalletTransaction.create(
            [
                {
                    transactionId: uuidv4(),
                    user,
                    walletId: wallet._id,
                    type: "CREDIT",
                    category,
                    amount: netAmount,
                    grossAmount,
                    platformFee,
                    netAmount,
                    balanceBefore: before,
                    balanceAfter: after,
                    status: "SUCCESS",
                    idempotencyKey,
                    fromUser,
                    toUser,
                    referenceId,
                    metadata: transactionMetadata,
                },
            ],
            { session, ordered: true }
        );

        await Ledger.create(
            [
                {
                    transactionId: tx[0].transactionId,
                    debitAccount: "SYSTEM",
                    creditAccount: "USER_WALLET",
                    fromUser,
                    toUser,
                    category,
                    referenceId,
                    amount: netAmount,
                    currency: "INR",
                    platformFee,
                    netAmount,
                    status: "SUCCESS",
                    metadata: transactionMetadata,
                },
                ...(platformFee > 0 ? [{
                    transactionId: tx[0].transactionId,
                    debitAccount: "SYSTEM",
                    creditAccount: "PLATFORM_FEE",
                    fromUser,
                    toUser: null,
                    category: `${category}_FEE`,
                    referenceId,
                    amount: platformFee,
                    currency: "INR",
                    platformFee,
                    netAmount: 0,
                    status: "SUCCESS",
                    metadata: transactionMetadata,
                }] : []),
            ],
            { session, ordered: true }
        );

        await session.commitTransaction();
        return tx[0];
    } catch (err) {
        await session.abortTransaction();
        if (err instanceof ApiError) throw err;
        if (err?.code === 11000 && idempotencyKey) {
            const existing = await WalletTransaction.findOne({ idempotencyKey });
            if (existing) return existing;
        }
        throw new ApiError(500, err.message, err);
    } finally {
        session.endSession();
    }
}

export async function debitWallet({ user, amount, category, idempotencyKey, fromUser = user, toUser = null, referenceId = null, metadata = {} }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const feePercent = getPlatformFeePercent(category);
        const { grossAmount, platformFee, netAmount } = calculateFeeSplit(amount, feePercent);
        const transactionMetadata = { ...metadata, feePercent };

        const wallet = await Wallet.findOneAndUpdate(
            { user, status: "ACTIVE", balance: { $gte: grossAmount } },
            { $inc: { balance: -grossAmount }, $set: { lastTransactionAt: new Date() } },
            { session, new: false }
        );

        if (!wallet) {
            const exists = await Wallet.exists({ user }).session(session);
            throw new ApiError(exists ? 1001 : 1002, exists ? "Insufficient balance" : "Wallet not found");
        }

        const before = Number(wallet.balance || 0);
        const after = before - grossAmount;

        const tx = await WalletTransaction.create(
            [
                {
                    transactionId: uuidv4(),
                    user,
                    walletId: wallet._id,
                    type: "DEBIT",
                    category,
                    amount: grossAmount,
                    grossAmount,
                    platformFee,
                    netAmount,
                    balanceBefore: before,
                    balanceAfter: after,
                    status: "SUCCESS",
                    idempotencyKey,
                    fromUser,
                    toUser,
                    referenceId,
                    metadata: transactionMetadata,
                },
            ],
            { session, ordered: true }
        );

        await Ledger.create(
            [
                {
                    transactionId: tx[0].transactionId,
                    debitAccount: "USER_WALLET",
                    creditAccount: "SYSTEM",
                    fromUser,
                    toUser,
                    category,
                    referenceId,
                    amount: netAmount,
                    currency: "INR",
                    platformFee,
                    netAmount,
                    status: "SUCCESS",
                    metadata: transactionMetadata,
                },
                ...(platformFee > 0 ? [{
                    transactionId: tx[0].transactionId,
                    debitAccount: "USER_WALLET",
                    creditAccount: "PLATFORM_FEE",
                    fromUser,
                    toUser: null,
                    category: `${category}_FEE`,
                    referenceId,
                    amount: platformFee,
                    currency: "INR",
                    platformFee,
                    netAmount: 0,
                    status: "SUCCESS",
                    metadata: transactionMetadata,
                }] : []),
            ],
            { session, ordered: true }
        );

        await session.commitTransaction();
        return tx[0];
    } catch (err) {
        await session.abortTransaction();
        if (err?.code === 11000 && idempotencyKey) {
            const existing = await WalletTransaction.findOne({ idempotencyKey });
            if (existing) return existing;
        }
        throw err;
    } finally {
        session.endSession();
    }
}
