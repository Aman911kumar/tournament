import { getCreatorProfile } from "@/api/creators";
import { getTournamentById } from "@/api/tournaments";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";

type Importer = () => Promise<unknown>;

const routeImporters: Array<{ test: (path: string) => boolean; importPage: Importer }> = [
  { test: (path) => path === "/", importPage: () => import("@/pages/Index") },
  { test: (path) => path.startsWith("/tournaments"), importPage: () => import("@/pages/TournamentsScreen") },
  { test: (path) => /^\/tournament\/[^/]+\/chat/.test(path), importPage: () => import("@/pages/TournamentCommentsScreen") },
  { test: (path) => /^\/tournament\/[^/]+\/slots/.test(path), importPage: () => import("@/pages/SlotSelectionScreen") },
  { test: (path) => /^\/tournament\/[^/]+$/.test(path), importPage: () => import("@/pages/TournamentDetailScreen") },
  { test: (path) => path === "/wallet", importPage: () => import("@/pages/WalletScreen") },
  { test: (path) => path === "/wallet/add", importPage: () => import("@/pages/AddMoneyScreen") },
  { test: (path) => path === "/wallet/withdraw", importPage: () => import("@/pages/WithdrawScreen") },
  { test: (path) => path === "/wallet/transfer", importPage: () => import("@/pages/TransferMoneyScreen") },
  { test: (path) => path === "/wallet/transfer-pin", importPage: () => import("@/pages/TransferPinSetupScreen") },
  { test: (path) => path === "/profile", importPage: () => import("@/pages/ProfileScreen") },
  { test: (path) => path === "/edit-profile", importPage: () => import("@/pages/EditProfileScreen") },
  { test: (path) => /^\/creator\/[^/]+/.test(path), importPage: () => import("@/pages/CreatorProfileScreen") },
  { test: (path) => path === "/subscriptions", importPage: () => import("@/pages/SubscriptionsScreen") },
  { test: (path) => path === "/community-management", importPage: () => import("@/pages/CommunityManagementScreen") },
  { test: (path) => path === "/notifications", importPage: () => import("@/pages/NotificationsScreen") },
  { test: (path) => path === "/create-tournament", importPage: () => import("@/pages/CreateTournamentScreen") },
  { test: (path) => path === "/channel-setup", importPage: () => import("@/pages/ChannelSetupScreen") },
  { test: (path) => path === "/my-tournaments", importPage: () => import("@/pages/MyTournamentsScreen") },
  { test: (path) => path === "/game-accounts", importPage: () => import("@/pages/GameAccountsScreen") },
];

const inFlight = new Set<string>();

const shouldPrefetch = () => {
  if (typeof window === "undefined") return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (connection?.saveData) return false;
  return connection?.effectiveType !== "2g";
};

const runOnce = (key: string, action: () => Promise<unknown>) => {
  if (!shouldPrefetch() || inFlight.has(key)) return;
  inFlight.add(key);
  window.setTimeout(() => inFlight.delete(key), 30_000);
  void action().catch(() => undefined);
};

export const prefetchRoute = (path?: string | null) => {
  if (!path) return;
  const route = routeImporters.find((entry) => entry.test(path));
  if (!route) return;
  runOnce(`route:${path}`, route.importPage);
};

export const prefetchTournamentDetail = (id?: string | null) => {
  if (!id || readCache(CACHE_KEYS.tournamentDetail(id))) return;
  prefetchRoute(`/tournament/${id}`);
  runOnce(`tournament:${id}`, async () => {
    const tournament = await getTournamentById(id);
    writeCache(CACHE_KEYS.tournamentDetail(id), tournament);
  });
};

export const prefetchCreatorProfile = (id?: string | null) => {
  if (!id || readCache(CACHE_KEYS.creatorProfile(id))) return;
  prefetchRoute(`/creator/${id}`);
  runOnce(`creator:${id}`, async () => {
    const profile = await getCreatorProfile(id);
    writeCache(CACHE_KEYS.creatorProfile(id), {
      ...profile,
      viewer: undefined,
    });
  });
};

export const prefetchOnIntent = (callback?: () => void) => {
  if (!callback) return {};
  return {
    onPointerEnter: callback,
    onFocus: callback,
    onTouchStart: callback,
  };
};
