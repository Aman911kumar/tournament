import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Calendar, Crosshair, DollarSign, RefreshCcw, Search, Shield, SlidersHorizontal, Trophy, Users } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getPrizeSortValue } from "@/lib/page-utils";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { CACHE_KEYS, readCache, stableCacheKey, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";

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

const statusStyle = (status: Tournament["status"]) => {
  if (status === "running") return "bg-destructive/20 text-destructive";
  if (status === "completed") return "bg-muted text-muted-foreground";
  if (status === "open") return "bg-secondary/20 text-secondary";
  if (status === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-primary/10 text-primary";
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const getPrizeSummary = (tournament: Tournament) => formatPrizeSummary(tournament, { killPrefix: true });
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
      setTournaments(cachedPage.data.tournaments);
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
      setTournaments((previous) => nextPage === 1 ? data.tournaments : [...previous, ...data.tournaments]);
      setPage(data.page ?? nextPage);
      setHasMore(Boolean(data.hasMore));
      const joinedIds = registrations.map(getRegistrationTournamentId).filter(Boolean);
      setJoinedTournamentIds(new Set(joinedIds));
      if (nextPage === 1) {
        writeCache(cacheKey, {
          tournaments: data.tournaments,
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

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = activeGame === "All"
      ? tournaments.filter((t) => t.status !== "completed")
      : tournaments.filter((t) => {
        if (t.status === "completed") return false;
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
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4">
        <h1 className="font-heading text-xl font-bold">Tournaments</h1>
        <p className="text-xs text-muted-foreground font-heading">Find your next battle</p>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-3 flex gap-2">
        <div className="flex-1 glass rounded-lg flex items-center gap-2 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tournaments or creators..."
            className="min-w-0 bg-transparent text-xs font-heading flex-1 focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowFilters(!showFilters)}
          className={`w-10 h-10 glass rounded-lg flex items-center justify-center shrink-0 ${showFilters ? "neon-border" : ""}`}
        >
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {gameFilters.map((f) => (
          <motion.button
            key={f}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveGame(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-heading font-medium whitespace-nowrap transition-colors ${
              activeGame === f ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground"
            }`}
          >
            {f}
          </motion.button>
        ))}
      </div>

      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-3 space-y-2"
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {feeFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFee(f)}
                className={`px-3 py-1 rounded-full text-[10px] font-heading font-medium whitespace-nowrap transition-colors ${
                  activeFee === f ? "bg-secondary text-secondary-foreground" : "glass text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {sortOptions.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSort(s)}
                className={`px-3 py-1 rounded-full text-[10px] font-heading font-medium whitespace-nowrap transition-colors ${
                  activeSort === s ? "bg-accent text-accent-foreground" : "glass text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        {loading && [0, 1, 2].map((item) => (
          <GlassCard key={item}>
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 rounded bg-muted" />
                <div className="h-3 rounded bg-muted" />
              </div>
              <div className="h-9 rounded bg-muted" />
            </div>
          </GlassCard>
        ))}

        {!loading && error && (
          <GlassCard className="text-center py-10">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load tournaments</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button onClick={() => loadTournaments(1)} className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-heading">
              <RefreshCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && (filtered.length === 0 ? (
          <GlassCard className="text-center py-10">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No tournaments found</p>
            <p className="text-xs text-muted-foreground mt-1">Try changing search or filters.</p>
          </GlassCard>
        ) : (
          filtered.map((t, i) => {
            const gameName = gameLabels[t.game] ?? t.game;
            const creatorName = t.channel?.name ?? t.organizer?.username ?? "Creator";
            const joined = joinedTournamentIds.has(t._id);
            return (
            <GlassCard key={t._id} neon delay={i * 0.06}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{t.title}</p>
                  <p className="text-[10px] text-muted-foreground">{gameName}</p>
                </div>
                <span
                  className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle(t.status)}`}
                >
                  {t.status === "running" ? "Live" : t.status}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(t.channel?._id ? `/creator/${t.channel._id}` : "/subscriptions");
                }}
                className="flex items-center gap-1.5 mb-3"
              >
                <span className="text-[10px] text-primary font-heading">by {creatorName}</span>
                <Shield className="w-2.5 h-2.5 text-secondary fill-secondary" />
              </button>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="w-3 h-3 shrink-0" /> <span className="truncate">{new Date(t.startAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Users className="w-3 h-3 shrink-0" /> {Number(t.registrationCount || 0)}/{t.maxPlayers} slots
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <DollarSign className="w-3 h-3 shrink-0" /> Entry: {Number(t.entryFee || 0) === 0 ? "FREE" : formatCurrency(t.entryFee)}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent neon-text-green">
                  {t.prizeMode === "kill" ? <Crosshair className="w-3 h-3 shrink-0" /> : <Trophy className="w-3 h-3 shrink-0" />} {getPrizeSummary(t)}
                </div>
              </div>
              <NeonButton full variant={joined ? "green" : "purple"} className="text-xs py-2" onClick={() => navigate(`/tournament/${t._id}`)}>
                {joined ? "JOINED" : "VIEW & REGISTER"}
              </NeonButton>
            </GlassCard>
          )})
        ))}

        {!loading && !error && hasMore && (
          <NeonButton full variant="blue" className="text-xs py-2" onClick={() => loadTournaments(page + 1)} disabled={loadingMore}>
            {loadingMore ? "LOADING..." : "LOAD MORE"}
          </NeonButton>
        )}
      </div>

    </div>
  );
};

export default TournamentsScreen;
