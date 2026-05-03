// Game accounts API
import { apiFetch,ApiResponse } from "./client";

// ---- Endpoints ----
export const ENDPOINTS = {
  list: "/game-account",
  create: "/game-account",
  update: (id: string) => `/game-account/${id}`,
  remove: (id: string) => `/game-account/${id}`,
  verify: (id: string) => `/game-account/${id}/verify`,
};

export interface GameAccount {
  _id: string;
  game: string;
  inGameName: string;
  gameId: string;
  level?: string;
  verified?: boolean;
}

export interface GameAccountPayload {
  game: string;
  inGameName: string;
  gameId: string;
  level?: string;
}

// ---- API calls ----
export async function listGameAccounts(): Promise<ApiResponse<GameAccount[]>> {
  return await apiFetch(ENDPOINTS.list);
}

export function createGameAccount(payload: GameAccountPayload): Promise<ApiResponse<GameAccount>> {
  return apiFetch<ApiResponse<GameAccount>>(ENDPOINTS.create, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export function updateGameAccount(id: string, payload: GameAccountPayload): Promise<ApiResponse<GameAccount>> {
  return apiFetch<ApiResponse<GameAccount>>(ENDPOINTS.update(id), {
    method: "PATCH",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export function deleteGameAccount(id: string) {
  return apiFetch<ApiResponse>(ENDPOINTS.remove(id), {
    method: "DELETE",
    credentials: "include",
  });
}

export function verifyGameAccount(id: string): Promise<ApiResponse<GameAccount>> {
  return apiFetch(ENDPOINTS.verify(id), {
    method: "GET",
    credentials: "include",
  });
}
