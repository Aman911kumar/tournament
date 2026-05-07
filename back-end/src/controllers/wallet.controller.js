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
import crypto from "crypto";
import Razorpay from "razorpay";
import { Payment } from "../models/payment.model.js";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../../env.js";
import { expireStaleRazorpayPayments } from "../services/paymentExpiry.service.js";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let razorpayInstance;
const getRazorpayInstance = () => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new ApiError(500, "Razorpay credentials are not configured");
    }

    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: RAZORPAY_KEY_ID,
            key_secret: RAZORPAY_KEY_SECRET,
        });
    }

    return razorpayInstance;
};

const validateDepositAmount = (amount) => {
    const depositAmount = Number(amount);
    if (!Number.isFinite(depositAmount) || depositAmount < 10) {
        throw new ApiError(400, "Minimum amount is Rs. 10");
    }
    if (depositAmount > 100000) {
        throw new ApiError(400, "Maximum amount is Rs. 1,00,000");
    }
    return Math.round(depositAmount * 100) / 100;
};

const addMoney = asyncHandler(async (req, res) => {
    await expireStaleRazorpayPayments({ user: req.user._id });
    const amount = validateDepositAmount(req.body.amount);
    const amountInPaise = Math.round(amount * 100);
    const razorpay = getRazorpayInstance();

    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `dep_${Date.now().toString(36)}_${uuidv4().slice(0, 8)}`,
        notes: {
            userId: req.user._id.toString(),
            purpose: "wallet_deposit",
        },
    });

    await Payment.create({
        user: req.user._id,
        amount,
        currency: "INR",
        provider: "Razorpay",
        providerPaymentId: `order_${order.id}`,
        providerOrderId: order.id,
        status: "initiated",
        meta: {
            method: req.body.method,
            razorpayOrder: order,
        },
    });

    res.status(200).json(
        new ApiResponse(200, {
            keyId: RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
        }, "Razorpay order created")
    );
});

const verifyAddMoney = asyncHandler(async (req, res) => {
    await expireStaleRazorpayPayments({ user: req.user._id });
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "Razorpay payment verification details are required");
    }

    if (!RAZORPAY_KEY_SECRET) {
        throw new ApiError(500, "Razorpay credentials are not configured");
    }

    const payment = await Payment.findOne({
        provider: "Razorpay",
        providerOrderId: razorpay_order_id,
        user: req.user._id,
    });

    if (!payment) {
        throw new ApiError(404, "Payment order not found");
    }

    if (payment.status === "success") {
        const existingTx = await WalletTransaction.findOne({
            idempotencyKey: `DEPOSIT_RAZORPAY_${razorpay_order_id}`,
            user: req.user._id,
        });

        return res.status(200).json(
            new ApiResponse(200, {
                transaction: existingTx,
                credited: Boolean(existingTx),
                balance: existingTx?.balanceAfter,
            }, "Payment already verified")
        );
    }

    if (payment.status === "failed") {
        throw new ApiError(400, "Payment order already failed. Please create a new payment order.");
    }

    if (payment.status === "cancelled") {
        throw new ApiError(400, "Payment order was cancelled. Please create a new payment order.");
    }

    const generatedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    const isValidSignature =
        generatedSignature.length === razorpay_signature.length &&
        crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpay_signature));

    if (!isValidSignature) {
        payment.status = "failed";
        payment.providerPaymentId = razorpay_payment_id;
        payment.meta = { ...payment.meta, verificationFailedAt: new Date() };
        await payment.save();
        throw new ApiError(400, "Payment signature verification failed");
    }

    payment.status = "success";
    payment.providerPaymentId = razorpay_payment_id;
    payment.meta = { ...payment.meta, verifiedAt: new Date() };
    await payment.save();

    const tx = await creditWallet({
        user: req.user._id,
        amount: payment.amount,
        category: "DEPOSIT",
        idempotencyKey: `DEPOSIT_RAZORPAY_${razorpay_order_id}`,
        referenceId: razorpay_payment_id,
        metadata: {
            provider: "Razorpay",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
        },
    });

    res.status(200).json(
        new ApiResponse(200, {
            transaction: tx,
            credited: true,
            balance: tx.balanceAfter,
        }, "Payment verified and wallet credited")
    );
});

const updateAddMoneyStatus = asyncHandler(async (req, res) => {
    await expireStaleRazorpayPayments({ user: req.user._id });
    const { orderId, status, reason, response } = req.body;
    const allowedStatuses = ["failed", "cancelled"];

    if (!orderId || !allowedStatuses.includes(status)) {
        throw new ApiError(400, "Valid payment order id and status are required");
    }

    const payment = await Payment.findOne({
        provider: "Razorpay",
        providerOrderId: orderId,
        user: req.user._id,
    });

    if (!payment) {
        throw new ApiError(404, "Payment order not found");
    }

    if (payment.status !== "initiated") {
        return res.status(200).json(
            new ApiResponse(200, payment, "Payment status already finalized")
        );
    }

    payment.status = status;
    payment.meta = {
        ...payment.meta,
        clientStatusUpdatedAt: new Date(),
        reason: reason || status,
        razorpayResponse: response || null,
    };
    await payment.save();

    res.status(200).json(
        new ApiResponse(200, payment, "Payment status updated")
    );
});

const withdrawMoney = asyncHandler(async (req, res) => {
    const { amount, method, destination, password } = req.body;
    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount < 100) {
        throw new ApiError(400, "Minimum withdrawal is Rs. 100");
    }

    if (!["upi", "bank"].includes(method)) {
        throw new ApiError(400, "Valid withdrawal method is required");
    }

    if (!destination || String(destination).trim() === "") {
        throw new ApiError(400, "Withdrawal destination is required");
    }

    if (!password || !(await req.user.isPasswordCorrect(password))) {
        throw new ApiError(400, "Incorrect password");
    }

    const tx = await debitWallet({
        user: req.user._id,
        amount: withdrawAmount,
        category: "WITHDRAW",
        idempotencyKey: `WITHDRAW_${req.user._id}_${Date.now()}`,
        metadata: {
            method,
            destination: String(destination).trim(),
            payoutStatus: "pending",
        },
    });

    const payment = await Payment.create({
        user: req.user._id,
        amount: withdrawAmount,
        currency: "INR",
        provider: "Other",
        providerPaymentId: `withdraw_${tx.transactionId}`,
        providerOrderId: tx.transactionId,
        status: "pending",
        meta: {
            purpose: "withdrawal",
            method,
            destination: String(destination).trim(),
            walletTransactionId: tx._id,
            walletTransactionRef: tx.transactionId,
            requestedAt: new Date(),
        },
    });

    res.status(200).json(
        new ApiResponse(200, {
            transaction: tx,
            payment,
            pending: true,
            balance: tx.balanceAfter,
        }, "Withdrawal requested and pending admin payout")
    );
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
    verifyAddMoney,
    updateAddMoneyStatus,
    transferMoney
}
