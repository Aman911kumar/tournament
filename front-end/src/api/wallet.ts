// WalletScreen, AddMoneyScreen, WithdrawScreen
import { apiFetch,ApiResponse } from "./client";

export const ENDPOINTS = {
  balance: "/wallet/balance",
  transactions: "/wallet/transactions",
  transactionDetail: (id: string) => `/wallet/transaction/${id}`,
  paymentDetail: (id: string) => `/wallet/payment/${id}`,
  addMoney: "/wallet/add",
  verifyAddMoney: "/wallet/add/verify",
  updateAddMoneyStatus: "/wallet/add/status",
  withdraw: "/wallet/withdraw",
  transferPin: "/wallet/transfer-pin",
  payoutMethods: "/wallet/payout-methods",
  payoutMethod: (id: string) => `/wallet/payout-methods/${id}`,
  transfer: "/wallet/transfer",
  creatorEarnings: "/wallet/creator-earnings",
  playerEarnings: "/wallet/player-earnings",
};

export interface AddMoneyPayload { amount: number; method?: "razorpay" }
export interface VerifyAddMoneyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
export interface UpdateAddMoneyStatusPayload {
  orderId: string;
  status: "failed" | "cancelled";
  reason?: string;
  response?: unknown;
}
export interface WithdrawPayload { amount: number; method?: "upi" | "bank"; destination?: string; payoutMethodId?: string; password: string }
export interface TransferPayload { recipient: string; amount: number; note?: string; transferPin: string }
export interface TransferPinPayload { accountPassword: string; transferPin: string }

export interface PayoutMethod {
  _id: string;
  type: "upi" | "bank";
  label?: string;
  upiId?: string;
  accountHolderName?: string;
  accountNumberLast4?: string;
  maskedAccountNumber?: string;
  ifsc?: string;
  bankName?: string;
  display?: string;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayoutMethodPayload {
  type: "upi" | "bank";
  label?: string;
  upiId?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  isDefault?: boolean;
}

export interface WalletUserRef {
  _id: string;
  username?: string;
  phone_number?: string;
}

export interface WalletTransaction {
  id: string | number;
  kind?: "WALLET" | "PAYMENT";
  type: "CREDIT" | "DEBIT";
  label: string;
  amount: number;
  date: string;
  status: string;
  clickable?: boolean;
}

export interface WalletTransactionPage {
  transactions: WalletTransaction[];
  walletTransactions: WalletTransaction[];
  paymentTransactions: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
  aggregations?: {
    wallet?: { _id: { type?: string; category?: string; status?: string }; count: number; amount: number; platformFee?: number }[];
    payments?: { _id: string; count: number; amount: number }[];
  };
}

interface ApiData<T> {
  data?: T;
}

export interface TransactionDetail {
  _id: string;
  transactionId: string;
  idempotencyKey: string;
  referenceId?: string;
  user: string;
  walletId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  category: string;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  fromUser?: WalletUserRef | string | null;
  toUser?: WalletUserRef | string | null;
  description?: string;
  type: "CREDIT" | "DEBIT";
  status: "SUCCESS" | "PENDING" | "FAILED" | "REVERSED";
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetail {
  _id: string;
  user: string;
  tournament?: string | null;
  amount: number;
  currency: string;
  provider: "Razorpay" | "Stripe" | "Paytm" | "Other";
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  status: "initiated" | "pending" | "success" | "failed" | "cancelled" | "refunded";
  meta?: {
    method?: string;
    purpose?: "deposit" | "withdrawal" | string;
    destination?: string;
    requestedAt?: string;
    adminPaidAt?: string;
    payoutReference?: string;
    note?: string;
    walletTransactionId?: string;
    walletTransactionRef?: string;
    reason?: string;
    verifiedAt?: string;
    verificationFailedAt?: string;
    clientStatusUpdatedAt?: string;
    razorpayOrder?: {
      id?: string;
      receipt?: string;
      status?: string;
      amount?: number;
      currency?: string;
    };
    razorpayResponse?: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

interface WalletTransactionDto {
  _id?: string;
  id?: string | number;
  kind?: "PAYMENT" | "WALLET";
  type: "CREDIT" | "DEBIT";
  amount: number;
  category?: string;
  provider?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  fromUser?: WalletUserRef | string | null;
  toUser?: WalletUserRef | string | null;
  description?: string;
  createdAt?: string;
  status?: string;
  balanceApplied?: boolean;
  meta?: {
    method?: string;
    purpose?: string;
    destination?: string;
  };
}

const sourceLabels: Record<string, string> = {
  PAYMENT: "Razorpay Payment",
  added: "Money Added",
  refund: "Refund",
  joined: "Tournament Entry",
  withdrawal: "Withdrawal",
  tournament_prize: "Creator Prize",
  TOURNAMENT_ENTRY: "Tournament Entry",
  TRANSFER: "Creator Earning",
  ORGANIZER_EARNING: "Creator Earning",
  WALLET_TRANSFER: "Wallet Transfer",
  DEPOSIT: "Money Added",
  WITHDRAW: "Withdrawal",
  REFUND: "Refund",
  WINNING: "Winning",
  BONUS: "Bonus",
  bonus: "Bonus",
};

const getUserName = (user?: WalletUserRef | string | null) =>
  typeof user === "object" && user ? user.username || user.phone_number || "User" : "User";

const mapTransaction = (transaction: WalletTransactionDto): WalletTransaction => {
  if (transaction.kind === "PAYMENT" || transaction.category === "PAYMENT") {
    const status = (transaction.status ?? "INITIATED").toLowerCase();
    const isWithdrawal = transaction.meta?.purpose === "withdrawal";
    const paymentLabels: Record<string, string> = isWithdrawal ? {
      pending: "Withdrawal payout pending",
      success: "Withdrawal payout successful",
      failed: "Withdrawal payout failed",
      cancelled: "Withdrawal cancelled",
      refunded: "Withdrawal refunded",
      initiated: "Withdrawal requested",
    } : {
      initiated: "Razorpay payment initiated",
      pending: "Razorpay payment pending",
      success: "Razorpay payment successful",
      failed: "Razorpay payment failed",
      cancelled: "Razorpay payment cancelled",
      refunded: "Razorpay payment refunded",
    };

    return {
      id: transaction._id ?? transaction.id ?? `PAYMENT-${transaction.providerOrderId ?? transaction.createdAt ?? Date.now()}`,
      kind: "PAYMENT",
      type: "CREDIT",
      label: paymentLabels[status] ?? "Razorpay payment update",
      amount: Math.abs(transaction.amount),
      date: transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "Just now",
      status,
      clickable: true,
    };
  }

  const label =
    transaction.category === "WALLET_TRANSFER"
      ? transaction.type === "DEBIT"
        ? `Transfer to ${getUserName(transaction.toUser)}`
        : `Transfer from ${getUserName(transaction.fromUser)}`
      : transaction.category === "TRANSFER" && transaction.type === "DEBIT"
        ? "Creator Deduction"
      : sourceLabels[transaction.category ?? ""] ?? transaction.category ?? "Wallet Transaction";

  return {
    id: transaction._id ?? transaction.id ?? `${transaction.type}-${transaction.createdAt ?? Date.now()}`,
    kind: "WALLET",
    type: transaction.type,
    label,
    amount: transaction.type === "DEBIT" ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
    date: transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "Just now",
    status: transaction.status ?? (transaction.balanceApplied ? "successful" : "pending"),
    clickable: true,
  };
};

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
    senderTransaction?: WalletTransactionDto;
    receiverTransaction?: WalletTransactionDto;
    transfer?: {
      grossAmount: number;
      platformFee: number;
      netAmount: number;
      fromUser: string;
      toUser: string;
      referenceId: string;
    };
  };
}

export interface RazorpayOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: "INR";
  receipt?: string;
}

export async function getBalance() {
  const res = await apiFetch<{ balance?: number } & ApiData<{ balance?: number }>>(ENDPOINTS.balance, {
    method: "GET",
    credentials: "include",
  });

  return { balance: res.data?.balance ?? res.balance ?? 0 };
}

export async function getTransactions(
  filter: "all" | "player" | "creator" = "all",
  options: { page?: number; limit?: number; view?: "all" | "wallet" | "payments" } = {},
) {
  const params = new URLSearchParams({ filter });
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.view) params.set("view", options.view);

  const res = await apiFetch<
    WalletTransactionDto[] |
    ApiData<WalletTransactionDto[]> |
    ApiData<{
      transactions?: WalletTransactionDto[];
      walletTransactions?: WalletTransactionDto[];
      paymentTransactions?: WalletTransactionDto[];
      total?: number;
      page?: number;
      limit?: number;
      pages?: number;
      hasMore?: boolean;
      aggregations?: WalletTransactionPage["aggregations"];
    }>
  >(
    `${ENDPOINTS.transactions}?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = Array.isArray(res) ? { transactions: res } : res.data;
  const transactions = Array.isArray(data) ? data : data?.transactions ?? [];
  const walletTransactions = Array.isArray(data) ? data.filter((item) => item.kind !== "PAYMENT") : data?.walletTransactions ?? [];
  const paymentTransactions = Array.isArray(data) ? data.filter((item) => item.kind === "PAYMENT") : data?.paymentTransactions ?? [];

  return {
    transactions: transactions.map(mapTransaction),
    walletTransactions: walletTransactions.map(mapTransaction),
    paymentTransactions: paymentTransactions.map(mapTransaction),
    total: Array.isArray(data) ? transactions.length : data?.total ?? transactions.length,
    page: Array.isArray(data) ? options.page ?? 1 : data?.page ?? options.page ?? 1,
    limit: Array.isArray(data) ? options.limit ?? transactions.length : data?.limit ?? options.limit ?? transactions.length,
    pages: Array.isArray(data) ? 1 : data?.pages ?? 1,
    hasMore: Array.isArray(data) ? false : Boolean(data?.hasMore),
    aggregations: Array.isArray(data) ? undefined : data?.aggregations,
  };
}

export async function getTransactionDetail(id: string): Promise<ApiResponse<TransactionDetail>> {
  return apiFetch(ENDPOINTS.transactionDetail(id), { method:"GET",credentials: "include" });
}

export async function getPaymentDetail(id: string): Promise<ApiResponse<PaymentDetail>> {
  return apiFetch(ENDPOINTS.paymentDetail(id), { method: "GET", credentials: "include" });
}

export async function addMoney(payload: AddMoneyPayload): Promise<WalletMutationResponse> {
  return apiFetch<WalletMutationResponse>(ENDPOINTS.addMoney, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function createAddMoneyOrder(payload: AddMoneyPayload): Promise<ApiResponse<RazorpayOrder>> {
  return apiFetch<ApiResponse<RazorpayOrder>>(ENDPOINTS.addMoney, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function verifyAddMoney(payload: VerifyAddMoneyPayload): Promise<ApiResponse<WalletMutationResponse["data"]>> {
  return apiFetch<ApiResponse<WalletMutationResponse["data"]>>(ENDPOINTS.verifyAddMoney, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function updateAddMoneyStatus(payload: UpdateAddMoneyStatusPayload): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>(ENDPOINTS.updateAddMoneyStatus, {
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

export async function getPayoutMethods(): Promise<ApiResponse<PayoutMethod[]>> {
  return apiFetch<ApiResponse<PayoutMethod[]>>(ENDPOINTS.payoutMethods, {
    method: "GET",
    credentials: "include",
  });
}

export async function savePayoutMethod(payload: PayoutMethodPayload): Promise<ApiResponse<PayoutMethod>> {
  return apiFetch<ApiResponse<PayoutMethod>>(ENDPOINTS.payoutMethods, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function updatePayoutMethod(id: string, payload: PayoutMethodPayload): Promise<ApiResponse<PayoutMethod>> {
  return apiFetch<ApiResponse<PayoutMethod>>(ENDPOINTS.payoutMethod(id), {
    method: "PATCH",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function deletePayoutMethod(id: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>(ENDPOINTS.payoutMethod(id), {
    method: "DELETE",
    credentials: "include",
  });
}

export async function transferMoney(payload: TransferPayload): Promise<WalletMutationResponse> {
  return apiFetch<WalletMutationResponse>(ENDPOINTS.transfer, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function getTransferPinStatus(): Promise<ApiResponse<{ hasTransferPin: boolean }>> {
  return apiFetch<ApiResponse<{ hasTransferPin: boolean }>>(ENDPOINTS.transferPin, {
    method: "GET",
    credentials: "include",
  });
}

export async function setupTransferPin(payload: TransferPinPayload): Promise<ApiResponse<{ hasTransferPin: boolean }>> {
  return apiFetch<ApiResponse<{ hasTransferPin: boolean }>>(ENDPOINTS.transferPin, {
    method: "PUT",
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

export async function getPlayerEarnings() {
  const res = await apiFetch<
    { total?: number; monthlyChange?: number } & ApiData<{ total?: number; monthlyChange?: number }>
  >(ENDPOINTS.playerEarnings, {
    method: "GET",
    credentials: "include",
  });

  return {
    total: res.data?.total ?? res.total ?? 0,
    monthlyChange: res.data?.monthlyChange ?? res.monthlyChange ?? 0,
  };
}
