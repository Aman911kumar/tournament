import mongoose from "mongoose";
import {Wallet} from "../models/wallet.model.js";
import ApiError from "../utils/ApiError.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { Ledger } from "../models/ledger.model.js";
import { v4 as uuidv4 } from "uuid";

export async function creditWallet({ user, amount, category, idempotencyKey }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 🔁 Idempotency check
        const existing = await WalletTransaction.findOne({ idempotencyKey });
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const wallet = await Wallet.findOne({ user }).session(session);

        if (!wallet) throw new ApiError(1002, "Wallet not found");

        const before = wallet.balance;
        const after = before + amount;

        wallet.balance = after;
        wallet.lastTransactionAt = new Date();
        await wallet.save({ session });

        const tx = await WalletTransaction.create(
            [
                {
                    transactionId: uuidv4(),
                    user,
                    walletId: wallet._id,
                    type: "CREDIT",
                    category,
                    amount,
                    balanceBefore: before,
                    balanceAfter: after,
                    status: "SUCCESS",
                    idempotencyKey,
                },
            ],
            { session }
        );

        await Ledger.create(
            [
                {
                    transactionId: tx[0].transactionId,
                    debitAccount: "SYSTEM",
                    creditAccount: "USER_WALLET",
                    amount,
                    currency: "INR",
                    status: "SUCCESS",
                },
            ],
            { session }
        );

        await session.commitTransaction();
        return tx[0];
    } catch (err) {
        await session.abortTransaction();
        throw new ApiError(500, err.message, err);
    } finally {
        session.endSession();
    }
}

export async function debitWallet({ user, amount, category, idempotencyKey }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const existing = await WalletTransaction.findOne({ idempotencyKey });
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const wallet = await Wallet.findOne({ user }).session(session);

        if (!wallet) throw new ApiError(1002, "Wallet not found");

        if (wallet.balance < amount) {
            throw new ApiError(1001, "Insufficient balance");
        }

        const before = wallet.balance;
        const after = before - amount;

        wallet.balance = after;
        wallet.lastTransactionAt = new Date();
        await wallet.save({ session });

        const tx = await WalletTransaction.create(
            [
                {
                    transactionId: uuidv4(),
                    user,
                    walletId: wallet._id,
                    type: "DEBIT",
                    category,
                    amount,
                    balanceBefore: before,
                    balanceAfter: after,
                    status: "SUCCESS",
                    idempotencyKey,
                },
            ],
            { session }
        );

        await Ledger.create(
            [
                {
                    transactionId: tx[0].transactionId,
                    debitAccount: "USER_WALLET",
                    creditAccount: "SYSTEM",
                    amount,
                    currency: "INR",
                    status: "SUCCESS",
                },
            ],
            { session }
        );

        await session.commitTransaction();
        return tx[0];
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}