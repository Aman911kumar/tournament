// WalletScreen, AddMoneyScreen, WithdrawScreen
import { apiFetch } from "./client";

export const ENDPOINTS = {
  balance: "/wallet/balance",
  transactions: "/wallet/transactions",
  addMoney: "/wallet/add",
  withdraw: "/wallet/withdraw",
  creatorEarnings: "/wallet/creator-earnings",
};

export interface AddMoneyPayload { amount: number; method: "upi" | "card" | "bank" }
export interface WithdrawPayload { amount: number; method: "upi" | "bank"; destination: string; password: string }

export interface WalletTransaction {
  id: string | number;
  type: "credit" | "debit";
  label: string;
  amount: number;
  date: string;
  status: string;
}

interface ApiData<T> {
  data?: T;
}

interface WalletTransactionDto {
  _id?: string;
  id?: string | number;
  type: "credit" | "debit";
  amount: number;
  source?: string;
  createdAt?: string;
  status?: string;
  balanceApplied?: boolean;
  meta?: {
    method?: string;
    destination?: string;
  };
}

const sourceLabels: Record<string, string> = {
  added: "Money Added",
  refund: "Refund",
  joined: "Tournament Entry",
  withdrawal: "Withdrawal",
  tournament_prize: "Creator Prize",
  bonus: "Bonus",
};

const mapTransaction = (transaction: WalletTransactionDto): WalletTransaction => ({
  id: transaction._id ?? transaction.id ?? `${transaction.type}-${transaction.createdAt ?? Date.now()}`,
  type: transaction.type,
  label: sourceLabels[transaction.source ?? ""] ?? transaction.source ?? "Wallet Transaction",
  amount: transaction.type === "debit" ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
  date: transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "Just now",
  status: transaction.status ?? (transaction.balanceApplied ? "successful" : "pending"),
});

export interface WalletMutationResponse {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: {
    balance?: number;
    walletBalance?: number;
    credited?: boolean;
    pending?: boolean;
    transaction?: WalletTransactionDto;
  };
}

export async function getBalance() {
  const res = await apiFetch<{ balance?: number } & ApiData<{ balance?: number }>>(ENDPOINTS.balance, {
    method: "GET",
    credentials: "include",
  });

  return { balance: res.data?.balance ?? res.balance ?? 0 };
}

export async function getTransactions(filter: "all" | "player" | "creator" = "all") {
  const res = await apiFetch<WalletTransactionDto[] | ApiData<WalletTransactionDto[]>>(
    `${ENDPOINTS.transactions}?filter=${filter}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const transactions = Array.isArray(res) ? res : res.data ?? [];
  return transactions.map(mapTransaction);
}

export async function addMoney(payload: AddMoneyPayload): Promise<WalletMutationResponse> {
  return apiFetch<WalletMutationResponse>(ENDPOINTS.addMoney, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function withdraw(payload: WithdrawPayload): Promise<WalletMutationResponse> {
  return apiFetch<WalletMutationResponse>(ENDPOINTS.withdraw, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function getCreatorEarnings() {
  const res = await apiFetch<
    { total?: number; monthlyChange?: number } & ApiData<{ total?: number; monthlyChange?: number }>
  >(ENDPOINTS.creatorEarnings, {
    method: "GET",
    credentials: "include",
  });

  return {
    total: res.data?.total ?? res.total ?? 0,
    monthlyChange: res.data?.monthlyChange ?? res.monthlyChange ?? 0,
  };
}
