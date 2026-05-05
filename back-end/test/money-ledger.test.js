import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { calculateFeeSplit, getPlatformFeePercent } from "../src/utils/money.js";
import { Ledger } from "../src/models/ledger.model.js";
import { WalletTransaction } from "../src/models/walletTransaction.model.js";

test("calculateFeeSplit applies wallet transfer fee and net amount", () => {
    assert.deepEqual(calculateFeeSplit(100, 2), {
        grossAmount: 100,
        platformFee: 2,
        netAmount: 98,
    });
});

test("calculateFeeSplit rounds currency values consistently", () => {
    assert.deepEqual(calculateFeeSplit(123.45, 2), {
        grossAmount: 123.45,
        platformFee: 2.47,
        netAmount: 120.98,
    });
});

test("getPlatformFeePercent reads category fee from environment", () => {
    const previous = process.env.PLATFORM_FEE_BONUS_PERCENT;
    try {
        process.env.PLATFORM_FEE_BONUS_PERCENT = "7.5";
        assert.equal(getPlatformFeePercent("BONUS"), 7.5);
    } finally {
        if (previous === undefined) {
            delete process.env.PLATFORM_FEE_BONUS_PERCENT;
        } else {
            process.env.PLATFORM_FEE_BONUS_PERCENT = previous;
        }
    }
});

test("ledger entries can store from/to users and fee metadata", async () => {
    const fromUser = new mongoose.Types.ObjectId();
    const toUser = new mongoose.Types.ObjectId();
    const ledger = new Ledger({
        transactionId: "tx_ledger_test",
        debitAccount: "USER_WALLET",
        creditAccount: "USER_WALLET",
        fromUser,
        toUser,
        category: "WALLET_TRANSFER",
        referenceId: "transfer_ref",
        amount: 98,
        currency: "INR",
        platformFee: 2,
        netAmount: 98,
        status: "SUCCESS",
        metadata: { feePercent: 2 },
    });

    await ledger.validate();

    assert.equal(ledger.fromUser.toString(), fromUser.toString());
    assert.equal(ledger.toUser.toString(), toUser.toString());
    assert.equal(ledger.platformFee, 2);
    assert.equal(ledger.netAmount, 98);
});

test("wallet transactions support tournament money movement categories and direction", async () => {
    const fromUser = new mongoose.Types.ObjectId();
    const toUser = new mongoose.Types.ObjectId();
    const walletId = new mongoose.Types.ObjectId();

    for (const category of ["DEPOSIT", "WITHDRAW", "TRANSFER", "WALLET_TRANSFER", "ORGANIZER_EARNING", "REFUND", "TOURNAMENT_ENTRY", "WINNING", "BONUS"]) {
        const tx = new WalletTransaction({
            transactionId: `tx_${category}`,
            user: toUser,
            walletId,
            type: category === "TOURNAMENT_ENTRY" ? "DEBIT" : "CREDIT",
            category,
            amount: 50,
            grossAmount: 50,
            platformFee: 0,
            netAmount: 50,
            balanceBefore: 100,
            balanceAfter: 150,
            status: "SUCCESS",
            referenceId: "tournament_ref",
            fromUser,
            toUser,
        });

        await tx.validate();
        assert.equal(tx.fromUser.toString(), fromUser.toString());
        assert.equal(tx.toUser.toString(), toUser.toString());
    }
});
