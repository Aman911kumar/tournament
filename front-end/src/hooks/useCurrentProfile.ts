import { useMemo } from "react";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { getMyProfile, User } from "@/api/profile";
import {
  CACHE_KEYS,
  getSavedDataNotice,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";

export const PROFILE_QUERY_KEY = ["profile", "me"] as const;

const getCachedProfile = () => readCache<User>(CACHE_KEYS.profile);

export const setCurrentProfileCache = (
  queryClient: QueryClient,
  user: User,
  response?: { success?: boolean; statusCode?: number },
) => {
  queryClient.setQueryData(PROFILE_QUERY_KEY, user);
  writeAuthenticatedCache(CACHE_KEYS.profile, user, response);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("battle4arena:profile-updated", { detail: user }),
    );
    void import("@/lib/chat-socket")
      .then(({ refreshChatSocketProfile }) => refreshChatSocketProfile())
      .catch(() => undefined);
  }
};

export const useCurrentProfile = () => {
  const queryClient = useQueryClient();
  const cachedProfile = useMemo(() => getCachedProfile(), []);

  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async () => {
      const res = await getMyProfile();
      const user = res.data.user;
      setCurrentProfileCache(queryClient, user, res);
      return user;
    },
    initialData: () => cachedProfile?.data,
    initialDataUpdatedAt: () =>
      cachedProfile?.savedAt
        ? new Date(cachedProfile.savedAt).getTime()
        : undefined,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return {
    ...query,
    profile: query.data ?? null,
    cacheNotice:
      query.error && query.data && cachedProfile
        ? getSavedDataNotice(cachedProfile.savedAt, query.error)
        : null,
  };
};
