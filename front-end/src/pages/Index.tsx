import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronRight, Flame, Zap, Crown, Trophy } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import NotificationBell from "@/components/NotificationBell";
import { CreatorCard, EmptyState, PageHeader, PageShell, StatusPill, Surface, TournamentCard } from "@/components/design-system";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { getCreators, CreatorChannel } from "@/api/creators";
import { formatPrizeSummary } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";

import gameFreefire from "@/assets/game-freefire.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameCod from "@/assets/game-cod.jpg";
import gameValorant from "@/assets/game-valorant.jpg";

const games = [
  { name: "Free Fire", image: gameFreefire, query: "freefire" },
  { name: "BGMI", image: gameBgmi, query: "bgmi" },
  { name: "Call of Duty", image: gameCod, query: "callofduty" },
  { name: "Valorant", image: gameValorant, query: "valorant" },
];

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const getPrizeSummary = (tournament?: Tournament) => formatPrizeSummary(tournament);
const isHomeTournament = (tournament: Tournament) =>
  tournament.visibility !== "private" && !["draft", "completed", "cancelled"].includes(tournament.status);
const PAGE_SIZE = 6;

const Index = () => {
  const navigate = useNavigate();
  const [trendingTournaments, setTrendingTournaments] = useState<Tournament[]>([]);
  const [recommendedCreators, setRecommendedCreators] = useState<(CreatorChannel & { tournamentCount?: number })[]>([]);
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadHome = useCallback(async (nextPage = 1) => {
    const cachedHome = readCache<{
      tournaments: Tournament[];
      creators: (CreatorChannel & { tournamentCount?: number })[];
      joinedIds: string[];
      page?: number;
      hasMore?: boolean;
    }>(CACHE_KEYS.home);
    if (nextPage === 1 && cachedHome) {
      setTrendingTournaments(cachedHome.data.tournaments.filter(isHomeTournament));
      setRecommendedCreators(cachedHome.data.creators);
      setJoinedTournamentIds(new Set(cachedHome.data.joinedIds));
      setPage(cachedHome.data.page ?? 1);
      setHasMore(Boolean(cachedHome.data.hasMore));
    }

    try {
      if (nextPage > 1) setLoadingMore(true);
      const [tournaments, creators, registrations] = await Promise.all([
        getTournamentPage({ sort: "trending", page: nextPage, limit: PAGE_SIZE, excludeCompleted: true }),
        getCreators(),
        getMyTournamentRegistrations().catch(() => []),
      ]);
      const visibleTournaments = tournaments.tournaments.filter(isHomeTournament);
      setTrendingTournaments((previous) => nextPage === 1 ? visibleTournaments : [...previous, ...visibleTournaments]);
      setRecommendedCreators(creators.slice(0, 4));
      setPage(tournaments.page ?? nextPage);
      setHasMore(Boolean(tournaments.hasMore));
      const joinedIds = registrations
        .filter((registration) => registration.status !== "cancelled")
        .map(getRegistrationTournamentId)
        .filter(Boolean);
      setJoinedTournamentIds(new Set(joinedIds));
      if (nextPage === 1) {
        writeCache(CACHE_KEYS.home, {
          tournaments: visibleTournaments,
          creators: creators.slice(0, 4),
          joinedIds,
          page: tournaments.page ?? nextPage,
          hasMore: Boolean(tournaments.hasMore),
        });
      }
    } catch {
      if (nextPage === 1 && cachedHome) return;
      setTrendingTournaments([]);
      setRecommendedCreators([]);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadHome(1);
  }, [loadHome]);

  const liveTournament = trendingTournaments.find((tournament) => tournament.status === "running");
  const gamePlayingCounts = useMemo(() => {
    return trendingTournaments.reduce<Record<string, number>>((counts, tournament) => {
      if (tournament.status !== "running") return counts;
      counts[tournament.game] = (counts[tournament.game] || 0) + Number(tournament.participantCount || tournament.registrationCount || 0);
      return counts;
    }, {});
  }, [trendingTournaments]);

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title={<span className="font-display text-xl tracking-wide neon-text-purple">BATTLE4ARENA</span>}
        subtitle="Welcome back, warrior"
        action={
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            type="button"
            onClick={() => navigate("/tournaments")}
            className="arena-focus flex h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-card/90 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            aria-label="Search tournaments"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        }
      />

      {liveTournament && (
          <Surface neon className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 gradient-neon" />
            <div className="mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent" />
              <span className="text-xs font-heading font-semibold text-accent uppercase tracking-wider">
                Live Now
              </span>
            </div>
            <h2 className="font-heading text-lg font-bold">{liveTournament.title}</h2>
            <p className="mb-1 text-xs text-muted-foreground">
              by <span className="text-primary">{liveTournament.channel?.name ?? liveTournament.organizer?.username ?? "Creator"}</span>{" "}
              <StatusPill tone="accent">Verified</StatusPill>
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Prize: {getPrizeSummary(liveTournament)} - {Number(liveTournament.participantCount || liveTournament.registrationCount || 0)}/{liveTournament.maxPlayers} playing
            </p>
            <NeonButton variant="green" className="text-xs py-2 px-4" onClick={() => navigate(`/tournament/${liveTournament._id}`)}>
              Watch Live
            </NeonButton>
          </Surface>
      )}

      {/* Recommended Creators */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Crown className="w-4 h-4 text-neon-pink" />
            Top Creators
          </h2>
          <button
            onClick={() => navigate("/subscriptions")}
            className="text-xs text-primary font-heading flex items-center gap-1"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {recommendedCreators.map((creator) => (
            <CreatorCard
              key={creator._id}
              name={creator.name}
              avatarUrl={creator.avatar?.url ?? creator.owner?.avatar?.url}
              followers={creator.memberCount}
              rating={creator.owner?.stats?.rating ?? 4.5}
              active={creator.isActive}
              onClick={() => navigate(`/creator/${creator._id}`)}
            />
          ))}
        </div>
      </section>

      {/* Popular Games */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Popular Games
          </h2>
          <button onClick={() => navigate("/tournaments")} className="text-xs text-primary font-heading flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {games.map((game, i) => (
            <motion.button
              key={game.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/tournaments?game=${game.query}`)}
              className="group overflow-hidden rounded-lg border border-glass-border bg-card/80 transition-colors hover:border-primary/45"
            >
              <div className="relative aspect-square">
                <img
                  src={game.image}
                  alt={game.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-heading font-bold text-sm text-foreground">{game.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(gamePlayingCounts[game.query] || 0).toLocaleString("en-IN")} playing
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Trending Tournaments */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" />
            Trending Tournaments
          </h2>
          <button
            onClick={() => navigate("/tournaments?sort=trending")}
            className="text-xs text-primary font-heading flex items-center gap-1"
          >
            See All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {trendingTournaments.length === 0 ? (
          <EmptyState icon={Trophy} title="No tournaments live yet" description="Fresh matches will appear here as creators publish them." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trendingTournaments.map((t) => (
          <TournamentCard
            key={t._id}
            title={t.title}
            game={`${gameLabels[t.game] ?? t.game}`}
            creator={t.channel?.name ?? t.organizer?.username ?? "Creator"}
            status={joinedTournamentIds.has(t._id) ? "Joined" : t.status === "running" ? "Live" : t.status}
            prize={getPrizeSummary(t)}
            slots={Number(t.registrationCount || 0)}
            maxSlots={t.maxPlayers}
            entry={Number(t.entryFee || 0) === 0 ? "Free" : `₹${Number(t.entryFee || 0).toLocaleString("en-IN")}`}
            joined={joinedTournamentIds.has(t._id)}
            onClick={() => navigate(`/tournament/${t._id}`)}
            onCreatorClick={() => navigate(t.channel?._id ? `/creator/${t.channel._id}` : "/subscriptions")}
          />
            ))}
          </div>
        )}
        {hasMore && (
          <NeonButton
            full
            variant="blue"
            className="text-xs py-2"
            onClick={() => loadHome(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? "LOADING..." : "LOAD MORE"}
          </NeonButton>
        )}
      </section>
    </PageShell>
  );
};

export default Index;
