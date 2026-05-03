import { debitWallet,creditWallet } from "./wallet.service";

export const joinTournament = async ({ userId, entryFee }) => {
    return await walletService.debitWallet({
        userId,
        amount: entryFee,
        category: "TOURNAMENT_ENTRY",
        idempotencyKey: `JOIN_${userId}_${Date.now()}`,
    });
};

export const giveWinning = async ({ userId, amount }) => {
    return await walletService.creditWallet({
        userId,
        amount,
        category: "WINNING",
        idempotencyKey: `WIN_${userId}_${Date.now()}`,
    });
};

export const refundEntry = async ({ userId, amount }) => {
    return await walletService.creditWallet({
        userId,
        amount,
        category: "REFUND",
        idempotencyKey: `REFUND_${userId}_${Date.now()}`,
    });
};