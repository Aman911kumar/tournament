import { creditWallet, debitWallet } from "./wallet.service.js";

export const joinTournament = async ({ userId, entryFee }) => {
    return await debitWallet({
        user: userId,
        amount: entryFee,
        category: "TOURNAMENT_ENTRY",
        idempotencyKey: `JOIN_${userId}_${Date.now()}`,
    });
};

export const giveWinning = async ({ userId, amount }) => {
    return await creditWallet({
        user: userId,
        amount,
        category: "WINNING",
        idempotencyKey: `WIN_${userId}_${Date.now()}`,
    });
};

export const refundEntry = async ({ userId, amount }) => {
    return await creditWallet({
        user: userId,
        amount,
        category: "REFUND",
        idempotencyKey: `REFUND_${userId}_${Date.now()}`,
    });
};
