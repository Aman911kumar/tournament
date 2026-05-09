import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCcw, SlidersHorizontal, Trophy } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import { EmptyState, PageHeader, PageShell, SearchBox, SegmentedControl, SkeletonBlock, Surface, TournamentCard } from "@/components/design-system";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getPrizeSortValue } from "@/lib/page-utils";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { CACHE_KEYS, readCache, stableCacheKey, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import { getNotificationSocket } from "@/lib/notification-socket";
import type { NotificationItem } from "@/api/notifications";

const gameFilters = ["All", "Free Fire", "BGMI", "Valorant", "COD"];
const feeFilters = ["All Fees", "Free", "Paid"];
const sortOptions = ["Trending", "Latest", "Prize Up", "Prize Down"];
const gameMap: Record<string, string> = { COD: "Call of Duty" };
const queryGameMap: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  valorant: "Valorant",
  callofduty: "COD",
  cod: "COD",
};
const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const sortMap: Record<string, "trending" | "latest" | "prize_asc" | "prize_desc"> = {
  Trending: "trending",
  Latest: "latest",
  "Prize Up": "prize_asc",
  "Prize Down": "prize_desc",
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const getPrizeSummary = (tournament: Tournament) => formatPrizeSummary(tournament, { killPrefix: true });
const isPublicTournament = (tournament: Tournament) =>
  tournament.visibility !== "private" && !["draft", "cancelled"].includes(tournament.status);
const PAGE_SIZE = 12;

const TournamentsScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialGame = queryGameMap[String(searchParams.get("game") || "").toLowerCase()] || "All";
  const initialFee = searchParams.get("type") === "free" ? "Free" : searchParams.get("type") === "paid" ? "Paid" : "All Fees";
  const initialSort = searchParams.get("sort") === "trending" ? "Trending" : "Latest";
  const [activeGame, setActiveGame] = useState(initialGame);
  const [activeFee, setActiveFee] = useState(initialFee);
  const [activeSort, setActiveSort] = useState(initialSort);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async (nextPage = 1) => {
    const feeFilter = activeFee === "Free" ? "free" : activeFee === "Paid" ? "paid" : "all";
    const gameFilter = activeGame === "COD" ? gameMap.COD : activeGame;
    const cacheKey = CACHE_KEYS.tournamentPage(stableCacheKey({
      activeFee,
      activeGame,
      activeSort,
      searchQuery: searchQuery.trim(),
      page: nextPage,
    }));
    const cachedPage = nextPage === 1
      ? readCache<{
          tournaments: Tournament[];
          page: number;
          hasMore: boolean;
          joinedIds: string[];
        }>(cacheKey)
      : null;

    if (cachedPage) {
      setTournaments(cachedPage.data.tournaments.filter(isPublicTournament));
      setPage(cachedPage.data.page);
      setHasMore(cachedPage.data.hasMore);
      setJoinedTournamentIds(new Set(cachedPage.data.joinedIds));
      setLoading(false);
    }

    try {
      if (nextPage === 1) {
        setLoading(!cachedPage);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const [data, registrations] = await Promise.all([
        getTournamentPage({
          game: gameFilter,
          type: feeFilter,
          sort: sortMap[activeSort],
          search: searchQuery.trim() || undefined,
          excludeCompleted: true,
          page: nextPage,
          limit: PAGE_SIZE,
        }),
        getMyTournamentRegistrations().catch(() => []),
      ]);
      const publicTournaments = data.tournaments.filter(isPublicTournament);
      setTournaments((previous) => nextPage === 1 ? publicTournaments : [...previous, ...publicTournaments]);
      setPage(data.page ?? nextPage);
      setHasMore(Boolean(data.hasMore));
      const joinedIds = registrations
        .filter((registration) => registration.status !== "cancelled")
        .map(getRegistrationTournamentId)
        .filter(Boolean);
      setJoinedTournamentIds(new Set(joinedIds));
      if (nextPage === 1) {
        writeCache(cacheKey, {
          tournaments: publicTournaments,
          page: data.page ?? nextPage,
          hasMore: Boolean(data.hasMore),
          joinedIds,
        });
        writeAuthenticatedCache(CACHE_KEYS.myRegistrations, registrations);
      }
    } catch (err) {
      if (!cachedPage) setError(getErrorMessage(err, "Failed to load tournaments."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeFee, activeGame, activeSort, searchQuery]);

  useEffect(() => {
    setTournaments([]);
    setPage(1);
    setHasMore(false);
    loadTournaments(1);
  }, [loadTournaments]);

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;

    const refreshOnTournamentNotification = (notification: NotificationItem) => {
      if (["creator", "tournament", "tournament_update", "room"].includes(notification.type)) {
        loadTournaments(1);
      }
    };

    socket.on("notification:new", refreshOnTournamentNotification);
    return () => {
      socket.off("notification:new", refreshOnTournamentNotification);
    };
  }, [loadTournaments]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = activeGame === "All"
      ? tournaments.filter((t) => isPublicTournament(t) && !["completed", "cancelled"].includes(t.status))
      : tournaments.filter((t) => {
        if (!isPublicTournament(t)) return false;
        if (["completed", "cancelled"].includes(t.status)) return false;
        const gameName = gameLabels[t.game] ?? t.game;
        return gameName === activeGame || gameName === gameMap[activeGame];
      });

    if (activeFee === "Free") list = list.filter((t) => Number(t.entryFee || 0) === 0);
    if (activeFee === "Paid") list = list.filter((t) => Number(t.entryFee || 0) > 0);
    if (query) {
      list = list.filter((t) =>
        t.title.toLowerCase().includes(query) ||
        (t.organizer?.username ?? "").toLowerCase().includes(query) ||
        (gameLabels[t.game] ?? t.game).toLowerCase().includes(query)
      );
    }

    if (activeSort === "Prize Up") return [...list].sort((a, b) => getPrizeSortValue(a) - getPrizeSortValue(b));
    if (activeSort === "Prize Down") return [...list].sort((a, b) => getPrizeSortValue(b) - getPrizeSortValue(a));
    return [...list].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [activeFee, activeGame, activeSort, searchQuery, tournaments]);

  return (
    <PageShell contentClassName="space-y-4">
      <PageHeader title="Tournaments" subtitle="Find your next battle" />

      <div className="flex gap-2">
        <SearchBox
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tournaments or creators..."
          className="flex-1"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowFilters(!showFilters)}
          className={`arena-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-card/80 transition-colors hover:border-primary/45 ${showFilters ? "neon-border text-primary" : "text-muted-foreground"}`}
          aria-label="Toggle tournament filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </motion.button>
      </div>

      <SegmentedControl
        value={activeGame}
        onChange={setActiveGame}
        options={gameFilters.map((filter) => ({ label: filter, value: filter }))}
      />

      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="space-y-2 overflow-hidden"
        >
          <SegmentedControl
            value={activeFee}
            onChange={setActiveFee}
            options={feeFilters.map((filter) => ({ label: filter, value: filter }))}
          />
          <SegmentedControl
            value={activeSort}
            onChange={setActiveSort}
            options={sortOptions.map((filter) => ({ label: filter, value: filter }))}
          />
        </motion.div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {loading && [0, 1, 2].map((item) => (
          <Surface key={item}>
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/3" />
              <div className="grid grid-cols-2 gap-2">
                <SkeletonBlock className="h-3" />
                <SkeletonBlock className="h-3" />
              </div>
              <SkeletonBlock className="h-9" />
            </div>
          </Surface>
        ))}

        {!loading && error && (
          <div className="sm:col-span-2">
            <EmptyState
              icon={RefreshCcw}
              title="Could not load tournaments"
              description={error}
              action={<NeonButton variant="ghost" className="text-xs" onClick={() => loadTournaments(1)}>Retry</NeonButton>}
            />
          </div>
        )}

        {!loading && !error && (filtered.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState icon={Trophy} title="No tournaments found" description="Try changing search or filters." />
          </div>
        ) : (
          filtered.map((t) => {
            const gameName = gameLabels[t.game] ?? t.game;
            const creatorName = t.channel?.name ?? t.organizer?.username ?? "Creator";
            const joined = joinedTournamentIds.has(t._id);
            return (
            <TournamentCard
              key={t._id}
              title={t.title}
              game={`${gameName} - ${new Date(t.startAt).toLocaleString()}`}
              creator={creatorName}
              status={joined ? "Joined" : t.status === "running" ? "Live" : t.status}
              prize={getPrizeSummary(t)}
              slots={Number(t.registrationCount || 0)}
              maxSlots={t.maxPlayers}
              entry={Number(t.entryFee || 0) === 0 ? "Free" : formatCurrency(t.entryFee)}
              joined={joined}
              onClick={() => navigate(`/tournament/${t._id}`)}
              onCreatorClick={() => navigate(t.channel?._id ? `/creator/${t.channel._id}` : "/subscriptions")}
            />
          )})
        ))}

      </div>

        {!loading && !error && hasMore && (
          <NeonButton full variant="blue" className="text-xs py-2" onClick={() => loadTournaments(page + 1)} disabled={loadingMore}>
            {loadingMore ? "LOADING..." : "LOAD MORE"}
          </NeonButton>
        )}
    </PageShell>
  );
};

export default TournamentsScreen;
