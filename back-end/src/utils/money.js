export const roundCurrency = (amount) => Math.round(Number(amount) * 100) / 100;

export const PLATFORM_FEE_CATEGORIES = [
    "DEPOSIT",
    "WITHDRAW",
    "TRANSFER",
    "WALLET_TRANSFER",
    "ORGANIZER_EARNING",
    "REFUND",
    "TOURNAMENT_ENTRY",
    "WINNING",
    "BONUS",
];

const DEFAULT_PLATFORM_FEE_PERCENT = {
    DEPOSIT: 0,
    WITHDRAW: 0,
    TRANSFER: 0,
    WALLET_TRANSFER: 2,
    ORGANIZER_EARNING: 0,
    REFUND: 0,
    TOURNAMENT_ENTRY: 10,
    WINNING: 0,
    BONUS: 0,
};

export const getPlatformFeePercent = (category, fallback = 0) => {
    const normalizedCategory = String(category || "").trim().toUpperCase();
    const envKey = `PLATFORM_FEE_${normalizedCategory}_PERCENT`;
    const rawValue = process.env[envKey];
    const defaultValue = DEFAULT_PLATFORM_FEE_PERCENT[normalizedCategory] ?? fallback;
    const feePercent = rawValue === undefined || rawValue === "" ? Number(defaultValue) : Number(rawValue);

    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
        throw new Error(`${envKey} must be a number between 0 and 100`);
    }

    return feePercent;
};

export const calculateFeeSplit = (amount, feePercent = 0) => {
    const grossAmount = roundCurrency(amount);
    const normalizedFeePercent = Number(feePercent);

    if (!Number.isFinite(grossAmount) || grossAmount < 0) {
        throw new Error("Amount must be a non-negative number");
    }

    if (!Number.isFinite(normalizedFeePercent) || normalizedFeePercent < 0 || normalizedFeePercent > 100) {
        throw new Error("Fee percent must be between 0 and 100");
    }

    const platformFee = roundCurrency((grossAmount * normalizedFeePercent) / 100);
    const netAmount = roundCurrency(grossAmount - platformFee);

    return { grossAmount, platformFee, netAmount };
};
