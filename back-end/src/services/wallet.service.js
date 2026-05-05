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
        const existing = await WalletTransaction.findOne({ idempotencyKey });
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const feePercent = getPlatformFeePercent(category);
        const { grossAmount, platformFee, netAmount } = calculateFeeSplit(amount, feePercent);
        const transactionMetadata = { ...metadata, feePercent };

        const wallet = await Wallet.findOne({ user }).session(session);

        if (!wallet) throw new ApiError(1002, "Wallet not found");

        const before = wallet.balance;
        const after = before + netAmount;

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
        throw new ApiError(500, err.message, err);
    } finally {
        session.endSession();
    }
}

export async function debitWallet({ user, amount, category, idempotencyKey, fromUser = user, toUser = null, referenceId = null, metadata = {} }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const existing = await WalletTransaction.findOne({ idempotencyKey });
        if (existing) {
            await session.abortTransaction();
            return existing;
        }

        const feePercent = getPlatformFeePercent(category);
        const { grossAmount, platformFee, netAmount } = calculateFeeSplit(amount, feePercent);
        const transactionMetadata = { ...metadata, feePercent };

        const wallet = await Wallet.findOne({ user }).session(session);

        if (!wallet) throw new ApiError(1002, "Wallet not found");

        if (wallet.balance < grossAmount) {
            throw new ApiError(1001, "Insufficient balance");
        }

        const before = wallet.balance;
        const after = before - grossAmount;

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
        throw err;
    } finally {
        session.endSession();
    }
}
