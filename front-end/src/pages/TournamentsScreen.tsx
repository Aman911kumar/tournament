import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Radio,
  RefreshCcw,
  SlidersHorizontal,
  Sparkles,
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
  SkeletonBlock,
  StatusPill,
  Surface,
} from "@/components/design-system";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getPrizeSortValue } from "@/lib/page-utils";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { CACHE_KEYS, readCache, stableCacheKey, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import { getNotificationSocket } from "@/lib/notification-socket";
import type { NotificationItem } from "@/api/notifications";
import {
  formatCompactNumber,
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

const TournamentDiscoveryCard = ({
  tournament,
  joined,
  onClick,
  onCreatorClick,
}: {
  tournament: Tournament;
  joined?: boolean;
  onClick: () => void;
  onCreatorClick: () => void;
}) => {
  const game = getDiscoveryGame(tournament.game);
  const participants = getParticipants(tournament);
  const fill = tournament.maxPlayers ? Math.min((participants / tournament.maxPlayers) * 100, 100) : 0;
  const slotsLeft = Math.max(Number(tournament.maxPlayers || 0) - participants, 0);

  return (
    <Surface interactive onClick={onClick} className="group overflow-hidden p-0">
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
            className="arena-focus min-w-0 truncate rounded-lg text-xs text-muted-foreground hover:text-primary"
          >
            {tournament.channel?.name ?? tournament.organizer?.username ?? "Creator"}
          </button>
          <span className="inline-flex items-center gap-1 font-heading text-xs font-bold text-primary">
            {joined ? "Open" : "View"} <ChevronRight className="h-3.5 w-3.5" />
          </span>
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
      const [data, registrations] = await Promise.all([
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
  }, [activeFee, activeGame, activeSort, activeStatus, debouncedSearch]);

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
  }, [activeFee, activeGame, activeMode, activeSort, activeStatus, searchQuery, tournaments]);

  const liveCount = tournaments.filter((t) => t.status === "running").length;
  const playerCount = tournaments.reduce((sum, tournament) => sum + getParticipants(tournament), 0);

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-4 pb-4">
      <PageHeader title="Tournaments" subtitle="Discover live rooms, upcoming events, and prize battles" />

      <Surface neon className="overflow-hidden p-0">
        <div className="relative p-3 sm:p-4 lg:p-5">
          <div className="absolute inset-x-0 top-0 h-px gradient-neon" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 font-heading text-[10px] font-bold text-accent">
                <Radio className="h-3.5 w-3.5" />
                TOURNAMENT DISCOVERY
              </div>
              <h1 className="mt-3 font-heading text-2xl font-black leading-tight sm:text-4xl">
                Browse arenas built for fast competitive play.
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Search by game, mode, creator, fee, prize, and live status. Results stay cached and update from tournament notifications.
              </p>
            </div>
            <div className="arena-data-grid grid-cols-3">
              <div className="arena-data-tile text-center">
                <p className="font-heading text-lg font-black text-accent">{liveCount}</p>
                <p className="text-[10px] text-muted-foreground">Live</p>
              </div>
              <div className="arena-data-tile text-center">
                <p className="font-heading text-lg font-black text-secondary">{formatCompactNumber(playerCount)}</p>
                <p className="text-[10px] text-muted-foreground">Players</p>
              </div>
              <div className="arena-data-tile text-center">
                <p className="font-heading text-lg font-black text-primary">{filtered.length}</p>
                <p className="text-[10px] text-muted-foreground">Shown</p>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchBox
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tournament, creator, mode..."
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className={cn(
            "arena-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-glass-border bg-card/80 px-4 font-heading text-xs font-bold transition-colors hover:border-primary/45",
            showFilters ? "neon-border text-primary" : "text-muted-foreground",
          )}
          aria-label="Toggle tournament filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      {showFilters && (
        <Surface className="space-y-2.5 p-2.5 sm:p-3">
          <div className="grid gap-2.5 lg:grid-cols-2">
            <SegmentedControl
              value={activeStatus}
              onChange={setActiveStatus}
              options={statusFilters.map((filter) => ({ label: filter, value: filter }))}
            />
            <SegmentedControl
              value={activeGame}
              onChange={setActiveGame}
              options={gameFilters.map((filter) => ({ label: filter, value: filter }))}
            />
          </div>
          <div className="grid gap-2.5 lg:grid-cols-3">
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
            <SegmentedControl
              value={activeMode}
              onChange={setActiveMode}
              options={modeOptions.map((filter) => ({ label: filter.replace(/_/g, " "), value: filter }))}
            />
          </div>
        </Surface>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading && [0, 1, 2, 3, 4, 5].map((item) => (
          <Surface key={item} className="space-y-3">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-8" />
          </Surface>
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
              onCreatorClick={() => navigate(tournament.channel?._id ? `/creator/${tournament.channel._id}` : "/subscriptions")}
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

      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-card/55 px-3 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Results update from tournament and creator notifications.
          </span>
          <button
            type="button"
            onClick={() => navigate("/create-tournament")}
            className="arena-focus shrink-0 rounded-lg px-2 py-1 font-heading font-bold text-primary"
          >
            Create
          </button>
        </div>
      )}
    </PageShell>
  );
};

export default TournamentsScreen;
