import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  RefreshCcw,
  SlidersHorizontal,
  Trophy,
  WalletCards,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SearchBox,
  SegmentedControl,
  StatusPill,
  Surface,
  TournamentCardSkeleton,
} from "@/components/design-system";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getPrizeSortValue } from "@/lib/page-utils";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { getJoinedChannelTournaments } from "@/api/creators";
import { CACHE_KEYS, readCache, stableCacheKey, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import { getNotificationSocket } from "@/lib/notification-socket";
import {
  prefetchCreatorProfile,
  prefetchOnIntent,
  prefetchRoute,
  prefetchTournamentDetail,
} from "@/lib/route-prefetch";
import type { NotificationItem } from "@/api/notifications";
import {
  formatDateShort,
  gameLabels,
  gameQueryLabels,
  getDiscoveryGame,
  normalizeGameFilter,
} from "@/config/discovery.config";
import { cn } from "@/lib/utils";

const gameFilters = ["All", "Free Fire", "BGMI", "Valorant", "COD"];
const feeFilters = ["All Fees", "Free", "Paid"];
const statusFilters = ["All", "Upcoming", "Live", "Completed"];
const sortOptions = ["Trending", "Latest", "Prize Up", "Prize Down"];
const scopeFilters = ["All", "Joined", "Joined Creators"];
const PAGE_SIZE = 12;

const sortMap: Record<string, "trending" | "latest" | "prize_asc" | "prize_desc"> = {
  Trending: "trending",
  Latest: "latest",
  "Prize Up": "prize_asc",
  "Prize Down": "prize_desc",
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const isPublicTournament = (tournament: Tournament) =>
  tournament.visibility !== "private" && !["draft", "cancelled"].includes(tournament.status);

const getParticipants = (tournament: Tournament) =>
  Number(tournament.participantCount ?? tournament.registrationCount ?? 0);

const mergeTournamentsById = (...groups: Tournament[][]) => {
  const map = new Map<string, Tournament>();
  groups.flat().forEach((tournament) => {
    if (tournament?._id) map.set(tournament._id, { ...map.get(tournament._id), ...tournament });
  });
  return Array.from(map.values());
};

const useDebouncedValue = (value: string, delay = 280) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
};

const getStatusTone = (status: Tournament["status"], joined?: boolean) => {
  if (joined) return "secondary";
  if (status === "running") return "accent";
  if (status === "completed") return "muted";
  return "primary";
};

const getStatusLabel = (tournament: Tournament, joined?: boolean) => {
  if (joined) return "Joined";
  if (tournament.status === "running") return "Live";
  if (tournament.status === "open") return "Upcoming";
  return tournament.status;
};

const getStatusRank = (status: Tournament["status"]) => {
  if (status === "open") return 0;
  if (status === "running") return 1;
  if (status === "completed") return 2;
  return 3;
};

const getSlotSelectionPath = (tournament: Tournament) =>
  `/tournament/${tournament._id}/slots?type=${tournament.type}&slots=${tournament.maxPlayers}&teamSize=${tournament.teamSize || ""}&fee=${Number(tournament.entryFee || 0)}&game=${tournament.game}&title=${encodeURIComponent(tournament.title)}`;

const FilterBlock = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0 space-y-1.5">
    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </p>
    {children}
  </div>
);

const TournamentDiscoveryCard = ({
  tournament,
  joined,
  onClick,
  onJoin,
  onCreatorClick,
  onPrefetch,
}: {
  tournament: Tournament;
  joined?: boolean;
  onClick: () => void;
  onJoin: () => void;
  onCreatorClick: () => void;
  onPrefetch?: () => void;
}) => {
  const game = getDiscoveryGame(tournament.game);
  const participants = getParticipants(tournament);
  const fill = tournament.maxPlayers ? Math.min((participants / tournament.maxPlayers) * 100, 100) : 0;
  const slotsLeft = Math.max(Number(tournament.maxPlayers || 0) - participants, 0);
  const canJoin = !joined && ["open", "running"].includes(tournament.status) && slotsLeft > 0;

  return (
    <Surface interactive onClick={onClick} onPointerEnter={onPrefetch} onFocus={onPrefetch} onTouchStart={onPrefetch} className="group overflow-hidden p-0">
      <div className="border-b border-glass-border p-3">
        <div className="mb-3 flex max-w-full flex-wrap gap-2">
          <StatusPill tone={getStatusTone(tournament.status, joined)}>
            {getStatusLabel(tournament, joined)}
          </StatusPill>
          <StatusPill tone="muted">{game.short}</StatusPill>
        </div>
        <p className="truncate font-display text-base font-extrabold uppercase tracking-tight">
          {tournament.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {game.label} - {tournament.gameMode || tournament.type}
        </p>
      </div>

      <div className="space-y-3 p-3">
        <div className="arena-data-grid grid-cols-3">
          <div className="arena-data-tile">
            <Trophy className="h-3.5 w-3.5 text-accent" />
            <p className="mt-1 truncate font-heading text-xs font-bold">{formatPrizeSummary(tournament, { killPrefix: true })}</p>
            <p className="text-[10px] text-muted-foreground">Prize</p>
          </div>
          <div className="arena-data-tile">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <p className="mt-1 truncate font-heading text-xs font-bold">{formatDateShort(tournament.startAt)}</p>
            <p className="text-[10px] text-muted-foreground">Starts</p>
          </div>
          <div className="arena-data-tile">
            <WalletCards className="h-3.5 w-3.5 text-secondary" />
            <p className="mt-1 truncate font-heading text-xs font-bold">
              {Number(tournament.entryFee || 0) === 0 ? "Free" : formatCurrency(tournament.entryFee)}
            </p>
            <p className="text-[10px] text-muted-foreground">Entry</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{participants}/{tournament.maxPlayers} players</span>
            <span>{slotsLeft} left</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent transition-[width] duration-300"
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-glass-border/70 pt-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCreatorClick();
              }}
              {...prefetchOnIntent(() => prefetchCreatorProfile(tournament.channel?._id ?? tournament.organizer?._id))}
              className="arena-focus min-w-0 truncate rounded-lg text-xs text-muted-foreground hover:text-primary"
            >
            {tournament.channel?.name ?? tournament.organizer?.username ?? "Creator"}
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
              className="arena-focus rounded-sm px-2 py-1 font-heading text-[11px] font-bold text-muted-foreground hover:text-primary"
            >
              Details
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                joined || canJoin ? onJoin() : onClick();
              }}
              {...prefetchOnIntent(() => prefetchRoute(joined ? `/tournament/${tournament._id}/chat` : getSlotSelectionPath(tournament)))}
              className={`arena-focus inline-flex min-h-8 items-center gap-1 rounded-sm px-3 font-heading text-xs font-bold ${
                canJoin || joined
                  ? "bg-primary text-primary-foreground"
                  : "border border-glass-border text-muted-foreground"
              }`}
            >
              {joined ? "Chat" : canJoin ? "Join" : "View"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Surface>
  );
};

const TournamentsScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialGame = gameQueryLabels[String(searchParams.get("game") || "").toLowerCase()] || "All";
  const initialFee = searchParams.get("type") === "free" ? "Free" : searchParams.get("type") === "paid" ? "Paid" : "All Fees";
  const initialSort = searchParams.get("sort") === "trending" ? "Trending" : "Latest";
  const [activeScope, setActiveScope] = useState("All");
  const [activeGame, setActiveGame] = useState(initialGame);
  const [activeFee, setActiveFee] = useState(initialFee);
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeSort, setActiveSort] = useState(initialSort);
  const [activeMode, setActiveMode] = useState("All Modes");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<Set<string>>(new Set());
  const [joinedCreatorTournamentIds, setJoinedCreatorTournamentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async (nextPage = 1) => {
    const feeFilter = activeFee === "Free" ? "free" : activeFee === "Paid" ? "paid" : "all";
    const gameFilter = normalizeGameFilter(activeGame);
    const statusFilter =
      activeStatus === "Live"
        ? "running"
        : activeStatus === "Upcoming"
          ? "open"
          : activeStatus === "Completed"
            ? "completed"
            : undefined;
    const cacheKey = CACHE_KEYS.tournamentPage(stableCacheKey({
      activeFee,
      activeGame,
      activeSort,
      activeStatus,
      activeScope,
      searchQuery: debouncedSearch.trim(),
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
      const [data, registrations, joinedCreatorFeed] = await Promise.all([
        getTournamentPage({
          game: gameFilter,
          type: feeFilter,
          sort: sortMap[activeSort],
          search: debouncedSearch.trim() || undefined,
          status: statusFilter as Tournament["status"] | undefined,
          excludeCompleted: false,
          page: nextPage,
          limit: PAGE_SIZE,
        }),
        getMyTournamentRegistrations().catch(() => []),
        activeScope === "Joined Creators"
          ? getJoinedChannelTournaments({ status: statusFilter as Tournament["status"] | undefined, limit: 80 }).catch(() => ({ tournaments: [], total: 0 }))
          : Promise.resolve({ tournaments: [], total: 0 }),
      ]);
      const publicTournaments = data.tournaments.filter(isPublicTournament);
      const joinedIds = registrations
        .filter((registration) => registration.status !== "cancelled")
        .map(getRegistrationTournamentId)
        .filter(Boolean);
      const registeredTournaments = registrations
        .filter((registration) => registration.status !== "cancelled" && typeof registration.tournament !== "string")
        .map((registration) => registration.tournament as Tournament)
        .filter(isPublicTournament);
      const joinedCreatorTournaments = joinedCreatorFeed.tournaments.filter(isPublicTournament);
      const joinedCreatorIds = joinedCreatorTournaments.map((tournament) => tournament._id).filter(Boolean);
      const nextTournaments = mergeTournamentsById(publicTournaments, registeredTournaments, joinedCreatorTournaments);

      setTournaments((previous) => nextPage === 1 ? nextTournaments : mergeTournamentsById(previous, nextTournaments));
      setPage(data.page ?? nextPage);
      setHasMore(Boolean(data.hasMore));
      setJoinedTournamentIds(new Set(joinedIds));
      if (activeScope === "Joined Creators") {
        setJoinedCreatorTournamentIds(new Set(joinedCreatorIds));
      }
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
  }, [activeFee, activeGame, activeScope, activeSort, activeStatus, debouncedSearch]);

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

  const modeOptions = useMemo(() => {
    const modes = new Set<string>();
    tournaments.forEach((tournament) => {
      if (tournament.gameMode) modes.add(tournament.gameMode);
    });
    return ["All Modes", ...Array.from(modes).sort()];
  }, [tournaments]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = tournaments.filter(isPublicTournament);

    if (activeGame !== "All") {
      list = list.filter((t) => (gameLabels[t.game] ?? t.game) === activeGame || activeGame === "COD" && t.game === "callofduty");
    }
    if (activeFee === "Free") list = list.filter((t) => Number(t.entryFee || 0) === 0);
    if (activeFee === "Paid") list = list.filter((t) => Number(t.entryFee || 0) > 0);
    if (activeScope === "Joined") list = list.filter((t) => joinedTournamentIds.has(t._id));
    if (activeScope === "Joined Creators") list = list.filter((t) => joinedCreatorTournamentIds.has(t._id));
    if (activeStatus === "Live") list = list.filter((t) => t.status === "running");
    if (activeStatus === "Upcoming") list = list.filter((t) => t.status === "open");
    if (activeStatus === "Completed") list = list.filter((t) => t.status === "completed");
    if (activeMode !== "All Modes") list = list.filter((t) => t.gameMode === activeMode);
    if (query) {
      list = list.filter((t) =>
        t.title.toLowerCase().includes(query) ||
        (t.organizer?.username ?? "").toLowerCase().includes(query) ||
        (t.channel?.name ?? "").toLowerCase().includes(query) ||
        (gameLabels[t.game] ?? t.game).toLowerCase().includes(query) ||
        (t.gameMode ?? "").toLowerCase().includes(query)
      );
    }

    return [...list].sort((a, b) => {
      if (activeStatus === "All") {
        const statusDifference = getStatusRank(a.status) - getStatusRank(b.status);
        if (statusDifference !== 0) return statusDifference;
      }

      if (activeSort === "Prize Up") return getPrizeSortValue(a) - getPrizeSortValue(b);
      if (activeSort === "Prize Down") return getPrizeSortValue(b) - getPrizeSortValue(a);
      if (activeSort === "Latest") return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
      return getParticipants(b) - getParticipants(a);
    });
  }, [activeFee, activeGame, activeMode, activeScope, activeSort, activeStatus, joinedCreatorTournamentIds, joinedTournamentIds, searchQuery, tournaments]);

  const hasActiveFilters =
    activeScope !== "All" ||
    activeGame !== "All" ||
    activeFee !== "All Fees" ||
    activeStatus !== "All" ||
    activeSort !== "Latest" ||
    activeMode !== "All Modes";

  const resetFilters = () => {
    setActiveScope("All");
    setActiveGame("All");
    setActiveFee("All Fees");
    setActiveStatus("All");
    setActiveSort("Latest");
    setActiveMode("All Modes");
  };

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-4 pb-4">
      <PageHeader title="Tournaments" subtitle="Discover live rooms, upcoming events, and prize battles" />

      <div className="flex min-w-0 items-center gap-2">
        <SearchBox
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tournament, creator, mode..."
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          {...prefetchOnIntent(() => prefetchRoute("/tournaments"))}
          className={cn(
            "arena-focus inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-glass-border bg-card/80 px-3 font-heading text-[10px] font-bold transition-colors hover:border-primary/45 min-[420px]:gap-2 min-[420px]:px-4 min-[420px]:text-xs",
            showFilters || hasActiveFilters ? "neon-border text-primary" : "text-muted-foreground",
          )}
          aria-label="Toggle tournament filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden min-[360px]:inline">Filters</span>
        </button>
      </div>

      {showFilters && (
        <Surface className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-3 border-b border-glass-border/70 pb-2">
            <p className="font-heading text-xs font-black uppercase tracking-[0.08em] text-primary">Filters</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="arena-focus rounded-md px-2 py-1 font-heading text-[10px] font-bold text-muted-foreground hover:text-primary"
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FilterBlock label="View">
              <SegmentedControl
                value={activeScope}
                onChange={setActiveScope}
                options={scopeFilters.map((filter) => ({ label: filter, value: filter }))}
              />
            </FilterBlock>
            <FilterBlock label="Status">
              <SegmentedControl
                value={activeStatus}
                onChange={setActiveStatus}
                options={statusFilters.map((filter) => ({ label: filter, value: filter }))}
              />
            </FilterBlock>
            <FilterBlock label="Game">
              <SegmentedControl
                value={activeGame}
                onChange={setActiveGame}
                options={gameFilters.map((filter) => ({ label: filter, value: filter }))}
              />
            </FilterBlock>
            <FilterBlock label="Entry">
              <SegmentedControl
                value={activeFee}
                onChange={setActiveFee}
                options={feeFilters.map((filter) => ({ label: filter, value: filter }))}
              />
            </FilterBlock>
            <FilterBlock label="Sort">
              <SegmentedControl
                value={activeSort}
                onChange={setActiveSort}
                options={sortOptions.map((filter) => ({ label: filter, value: filter }))}
              />
            </FilterBlock>
            <FilterBlock label="Mode">
              <SegmentedControl
                value={activeMode}
                onChange={setActiveMode}
                options={modeOptions.map((filter) => ({ label: filter.replace(/_/g, " "), value: filter }))}
              />
            </FilterBlock>
          </div>
        </Surface>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading && [0, 1, 2, 3, 4, 5].map((item) => (
          <TournamentCardSkeleton key={item} compact />
        ))}

        {!loading && error && (
          <div className="sm:col-span-2 xl:col-span-3">
            <EmptyState
              icon={RefreshCcw}
              title="Could not load tournaments"
              description={error}
              action={<NeonButton variant="ghost" className="text-xs" onClick={() => loadTournaments(1)}>Retry</NeonButton>}
            />
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3">
            <EmptyState icon={Trophy} title="No tournaments found" description="Try changing search, game, or status filters." />
          </div>
        )}

        {!loading && !error && filtered.map((tournament) => {
          const joined = joinedTournamentIds.has(tournament._id);
          return (
            <TournamentDiscoveryCard
              key={tournament._id}
              tournament={tournament}
              joined={joined}
              onClick={() => navigate(`/tournament/${tournament._id}`)}
              onJoin={() => navigate(joined ? `/tournament/${tournament._id}/chat` : getSlotSelectionPath(tournament))}
              onCreatorClick={() => navigate(tournament.channel?._id ? `/creator/${tournament.channel._id}` : "/subscriptions")}
              onPrefetch={() => prefetchTournamentDetail(tournament._id)}
            />
          );
        })}
      </div>

      {!loading && !error && hasMore && (
        <NeonButton
          full
          variant="blue"
          className="min-h-11 text-xs"
          onClick={() => loadTournaments(page + 1)}
          disabled={loadingMore}
        >
          {loadingMore ? "LOADING..." : "LOAD MORE"}
        </NeonButton>
      )}

    </PageShell>
  );
};

export default TournamentsScreen;
