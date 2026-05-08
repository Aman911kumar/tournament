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
import bcrypt from "bcrypt";
import Razorpay from "razorpay";
import { Payment } from "../models/payment.model.js";
import { PayoutMethod } from "../models/payoutMethod.model.js";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../../env.js";
import { expireStaleRazorpayPayments } from "../services/paymentExpiry.service.js";
import { createNotification } from "../services/notification.service.js";

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

const maskAccountNumber = (value = "") => {
    const digits = String(value).replace(/\D/g, "");
    if (!digits) return "";
    return `•••• ${digits.slice(-4)}`;
};

const formatPayoutMethod = (method, includeDestination = false) => {
    const plain = method?.toObject?.() || method;
    if (!plain) return null;

    const display =
        plain.type === "upi"
            ? plain.upiId
            : `${plain.bankName || "Bank account"} ${plain.accountNumberLast4 ? `•••• ${plain.accountNumberLast4}` : ""}`.trim();

    return {
        _id: plain._id,
        type: plain.type,
        label: plain.label,
        upiId: plain.upiId,
        accountHolderName: plain.accountHolderName,
        accountNumberLast4: plain.accountNumberLast4,
        maskedAccountNumber: plain.accountNumberLast4 ? `•••• ${plain.accountNumberLast4}` : "",
        ifsc: plain.ifsc,
        bankName: plain.bankName,
        display,
        isDefault: Boolean(plain.isDefault),
        isActive: Boolean(plain.isActive),
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
        ...(includeDestination ? { destination: plain.type === "upi" ? plain.upiId : `${plain.accountHolderName} / ${plain.accountNumber} / ${plain.ifsc}` } : {}),
    };
};

const normalizePayoutPayload = (body) => {
    const type = String(body.type || body.method || "").trim().toLowerCase();
    if (!["upi", "bank"].includes(type)) {
        throw new ApiError(400, "Valid payout method type is required");
    }

    const label = String(body.label || "").trim();
    const isDefault = Boolean(body.isDefault);

    if (type === "upi") {
        const upiId = String(body.upiId || body.destination || "").trim().toLowerCase();
        if (!/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
            throw new ApiError(400, "Enter a valid UPI ID");
        }

        return {
            type,
            label: label || "UPI",
            upiId,
            accountHolderName: "",
            accountNumber: "",
            accountNumberLast4: "",
            ifsc: "",
            bankName: "",
            isDefault,
        };
    }

    const accountHolderName = String(body.accountHolderName || "").trim();
    const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
    const ifsc = String(body.ifsc || "").trim().toUpperCase();
    const bankName = String(body.bankName || "").trim();

    if (accountHolderName.length < 3) {
        throw new ApiError(400, "Account holder name is required");
    }
    if (!/^\d{9,18}$/.test(accountNumber)) {
        throw new ApiError(400, "Enter a valid bank account number");
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        throw new ApiError(400, "Enter a valid IFSC code");
    }

    return {
        type,
        label: label || bankName || "Bank account",
        upiId: "",
        accountHolderName,
        accountNumber,
        accountNumberLast4: accountNumber.slice(-4),
        ifsc,
        bankName,
        isDefault,
    };
};

const getSavedPayoutDestination = async (userId, payoutMethodId) => {
    if (!mongoose.Types.ObjectId.isValid(payoutMethodId)) {
        throw new ApiError(400, "Invalid payout method");
    }

    const payoutMethod = await PayoutMethod.findOne({
        _id: payoutMethodId,
        user: userId,
        isActive: true,
    }).select("+accountNumber");

    if (!payoutMethod) {
        throw new ApiError(404, "Saved payout method not found");
    }

    const formatted = formatPayoutMethod(payoutMethod, true);
    return {
        method: payoutMethod.type,
        destination: formatted.destination,
        payoutMethodSnapshot: {
            id: payoutMethod._id,
            type: payoutMethod.type,
            label: payoutMethod.label,
            display: formatted.display,
            upiId: payoutMethod.upiId,
            accountHolderName: payoutMethod.accountHolderName,
            accountNumberMasked: maskAccountNumber(payoutMethod.accountNumber),
            accountNumberLast4: payoutMethod.accountNumberLast4,
            ifsc: payoutMethod.ifsc,
            bankName: payoutMethod.bankName,
        },
    };
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
        await Payment.updateOne(
            { _id: payment._id, status: "initiated" },
            {
                $set: {
                    status: "failed",
                    providerPaymentId: razorpay_payment_id,
                    meta: { ...payment.meta, verificationFailedAt: new Date() },
                },
            }
        );
        throw new ApiError(400, "Payment signature verification failed");
    }

    const claimedPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: "initiated" },
        {
            $set: {
                status: "pending",
                providerPaymentId: razorpay_payment_id,
                meta: { ...payment.meta, verifiedAt: new Date(), creditProcessingAt: new Date() },
            },
        },
        { new: true }
    );

    if (!claimedPayment) {
        const existingTx = await WalletTransaction.findOne({
            idempotencyKey: `DEPOSIT_RAZORPAY_${razorpay_order_id}`,
            user: req.user._id,
        });

        if (existingTx) {
            return res.status(200).json(
                new ApiResponse(200, {
                    transaction: existingTx,
                    credited: true,
                    balance: existingTx.balanceAfter,
                }, "Payment already verified")
            );
        }

        throw new ApiError(409, "Payment verification is already being processed. Please refresh in a moment.");
    }

    const tx = await creditWallet({
        user: req.user._id,
        amount: claimedPayment.amount,
        category: "DEPOSIT",
        idempotencyKey: `DEPOSIT_RAZORPAY_${razorpay_order_id}`,
        referenceId: razorpay_payment_id,
        metadata: {
            provider: "Razorpay",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
        },
    });

    await Payment.updateOne(
        { _id: claimedPayment._id, status: "pending" },
        { $set: { status: "success", meta: { ...claimedPayment.meta, creditedAt: new Date() } } }
    );

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

const getTransferPinStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+transferPinHash");
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json(
        new ApiResponse(200, { hasTransferPin: Boolean(user.transferPinHash) }, "Transfer PIN status fetched")
    );
});

const setupTransferPin = asyncHandler(async (req, res) => {
    const { accountPassword, transferPin } = req.body;

    if (!/^\d{6}$/.test(String(transferPin || ""))) {
        throw new ApiError(400, "Transfer PIN must be exactly 6 digits");
    }

    const user = await User.findById(req.user._id).select("+transferPinHash password");
    if (!user) throw new ApiError(404, "User not found");

    if (!accountPassword || !(await user.isPasswordCorrect(accountPassword))) {
        throw new ApiError(400, "Incorrect account password");
    }

    const hadTransferPin = Boolean(user.transferPinHash);
    user.transferPinHash = await bcrypt.hash(String(transferPin), 10);
    await user.save({ validateBeforeSave: false });

    res.status(200).json(
        new ApiResponse(200, { hasTransferPin: true }, hadTransferPin ? "Transfer PIN updated successfully" : "Transfer PIN set successfully")
    );
});

const getPayoutMethods = asyncHandler(async (req, res) => {
    const methods = await PayoutMethod.find({
        user: req.user._id,
        isActive: true,
    }).sort({ isDefault: -1, updatedAt: -1 });

    res.status(200).json(
        new ApiResponse(200, methods.map((method) => formatPayoutMethod(method)), "Payout methods fetched successfully")
    );
});

const savePayoutMethod = asyncHandler(async (req, res) => {
    const payload = normalizePayoutPayload(req.body);

    const existingCount = await PayoutMethod.countDocuments({ user: req.user._id, isActive: true });
    const shouldSetDefault = payload.isDefault || existingCount === 0;

    if (shouldSetDefault) {
        await PayoutMethod.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    }

    const method = await PayoutMethod.create({
        user: req.user._id,
        ...payload,
        isDefault: shouldSetDefault,
    });

    res.status(201).json(
        new ApiResponse(201, formatPayoutMethod(method), "Payout method saved successfully")
    );
});

const updatePayoutMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid payout method");
    }

    const method = await PayoutMethod.findOne({ _id: id, user: req.user._id, isActive: true }).select("+accountNumber");
    if (!method) {
        throw new ApiError(404, "Saved payout method not found");
    }

    const payload = normalizePayoutPayload({ ...req.body, type: req.body.type || method.type });
    const shouldSetDefault = payload.isDefault || req.body.isDefault === true;

    if (shouldSetDefault) {
        await PayoutMethod.updateMany({ user: req.user._id, _id: { $ne: method._id } }, { $set: { isDefault: false } });
    }

    Object.assign(method, payload, { isDefault: shouldSetDefault ? true : method.isDefault });
    await method.save();

    res.status(200).json(
        new ApiResponse(200, formatPayoutMethod(method), "Payout method updated successfully")
    );
});

const deletePayoutMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid payout method");
    }

    const method = await PayoutMethod.findOne({ _id: id, user: req.user._id, isActive: true });
    if (!method) {
        throw new ApiError(404, "Saved payout method not found");
    }

    method.isActive = false;
    method.isDefault = false;
    await method.save();

    const nextDefault = await PayoutMethod.findOne({ user: req.user._id, isActive: true }).sort({ updatedAt: -1 });
    if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Payout method removed successfully")
    );
});

const withdrawMoney = asyncHandler(async (req, res) => {
    const { amount, payoutMethodId, password } = req.body;
    let { method, destination } = req.body;
    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount < 100) {
        throw new ApiError(400, "Minimum withdrawal is Rs. 100");
    }

    let payoutMethodSnapshot = null;
    if (payoutMethodId) {
        const savedDestination = await getSavedPayoutDestination(req.user._id, payoutMethodId);
        method = savedDestination.method;
        destination = savedDestination.destination;
        payoutMethodSnapshot = savedDestination.payoutMethodSnapshot;
    }

    if (!["upi", "bank"].includes(method)) {
        throw new ApiError(400, "Valid withdrawal method is required");
    }

    if (!destination || String(destination).trim() === "") {
        throw new ApiError(400, "Withdrawal destination is required");
    }

    const passwordUser = password
        ? await User.findById(req.user._id).select("password")
        : null;
    if (!password || !passwordUser || !(await passwordUser.isPasswordCorrect(password))) {
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
            payoutMethodId: payoutMethodSnapshot?.id,
            payoutMethodSnapshot,
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
            payoutMethodId: payoutMethodSnapshot?.id,
            payoutMethodSnapshot,
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
    const { recipient, amount, note, transferPin } = req.body;
    const transferAmount = Number(amount);

    if (!recipient || String(recipient).trim() === "") {
        throw new ApiError(400, "Recipient username, phone, email, or user ID is required");
    }

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new ApiError(400, "Transfer amount must be greater than 0");
    }

    if (!/^\d{6}$/.test(String(transferPin || ""))) {
        throw new ApiError(400, "Enter your 6 digit transfer PIN");
    }

    const senderUser = await User.findById(req.user._id).select("+transferPinHash");
    if (!senderUser?.transferPinHash) {
        throw new ApiError(400, "Set your transfer PIN before sending money");
    }

    const isTransferPinCorrect = await bcrypt.compare(String(transferPin), senderUser.transferPinHash);
    if (!isTransferPinCorrect) {
        throw new ApiError(400, "Incorrect transfer PIN");
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
        const transferRef = uuidv4();
        const senderWallet = await Wallet.findOneAndUpdate(
            { user: req.user._id, status: "ACTIVE", balance: { $gte: transferAmount } },
            { $inc: { balance: -transferAmount }, $set: { lastTransactionAt: new Date() } },
            { session, new: false }
        );

        if (!senderWallet) {
            const senderWalletExists = await Wallet.exists({ user: req.user._id }).session(session);
            throw new ApiError(senderWalletExists ? 400 : 404, senderWalletExists ? "Insufficient wallet balance" : "Sender wallet not found");
        }

        const receiverWallet = await Wallet.findOneAndUpdate(
            { user: receiver._id, status: "ACTIVE" },
            { $inc: { balance: netAmount }, $set: { lastTransactionAt: new Date() } },
            { session, new: false }
        );

        if (!receiverWallet) throw new ApiError(404, "Recipient wallet not found");

        const senderBefore = Number(senderWallet.balance || 0);
        const senderAfter = senderBefore - transferAmount;
        const receiverBefore = Number(receiverWallet.balance || 0);
        const receiverAfter = receiverBefore + netAmount;

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
            balanceAfter: senderAfter,
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
            balanceAfter: receiverAfter,
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

        await createNotification({
            user: receiver._id,
            title: "Money received",
            body: `You received Rs. ${netAmount.toFixed(2)} from ${req.user.username}.`,
            type: "wallet",
            actionUrl: `/wallet/transaction/${receiverTx[0]._id}`,
            data: {
                transactionId: receiverTx[0]._id,
                referenceId: transferRef,
                amount: netAmount,
                grossAmount: transferAmount,
                platformFee,
                fromUser: req.user._id,
            },
        }).catch((error) => {
            console.error("Failed to notify wallet receiver:", error);
        });

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
    getTransferPinStatus,
    setupTransferPin,
    getPayoutMethods,
    savePayoutMethod,
    updatePayoutMethod,
    deletePayoutMethod,
    withdrawMoney,
    addMoney,
    verifyAddMoney,
    updateAddMoneyStatus,
    transferMoney
}
