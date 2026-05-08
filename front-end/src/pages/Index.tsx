import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Search, ChevronRight, Crosshair, Flame, Zap, Star, Users, Crown } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
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
      setTrendingTournaments(cachedHome.data.tournaments);
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
      setTrendingTournaments((previous) => nextPage === 1 ? tournaments.tournaments : [...previous, ...tournaments.tournaments]);
      setRecommendedCreators(creators.slice(0, 4));
      setPage(tournaments.page ?? nextPage);
      setHasMore(Boolean(tournaments.hasMore));
      const joinedIds = registrations.map(getRegistrationTournamentId).filter(Boolean);
      setJoinedTournamentIds(new Set(joinedIds));
      if (nextPage === 1) {
        writeCache(CACHE_KEYS.home, {
          tournaments: tournaments.tournaments,
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl flex items-center justify-between px-4 sm:px-5 pt-6 pb-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider neon-text-purple">
            BATTLEARENA
          </h1>
          <p className="text-xs text-muted-foreground font-heading">Welcome back, Warrior</p>
        </div>
        <div className="flex gap-3">
          <button className="w-9 h-9 glass rounded-full flex items-center justify-center">
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate("/notifications")}
            className="w-9 h-9 glass rounded-full flex items-center justify-center relative"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
          </button>
        </div>
      </div>

      {liveTournament && (
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
          <GlassCard neon className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-accent animate-glow-pulse" />
              <span className="text-xs font-heading font-semibold text-accent uppercase tracking-wider">
                Live Now
              </span>
            </div>
            <h2 className="font-heading text-lg font-bold">{liveTournament.title}</h2>
            <p className="text-xs text-muted-foreground font-body mb-1">
              by <span className="text-primary">{liveTournament.channel?.name ?? liveTournament.organizer?.username ?? "Creator"}</span> - Verified Creator
            </p>
            <p className="text-xs text-muted-foreground font-body mb-3">
              Prize: {getPrizeSummary(liveTournament)} - {Number(liveTournament.participantCount || liveTournament.registrationCount || 0)}/{liveTournament.maxPlayers} playing
            </p>
            <NeonButton variant="green" className="text-xs py-2 px-4" onClick={() => navigate(`/tournament/${liveTournament._id}`)}>
              Watch Live
            </NeonButton>
          </GlassCard>
        </div>
      )}

      {/* Recommended Creators */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
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
          {recommendedCreators.map((creator, i) => (
            <motion.button
              key={creator._id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/creator/${creator._id}`)}
              className="glass rounded-xl p-3 min-w-[120px] flex flex-col items-center gap-2 shrink-0"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center">
                  <span className="font-display text-lg font-bold text-primary-foreground">
                    {creator.name[0]}
                  </span>
                </div>
                {creator.isActive && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                    <Star className="w-3 h-3 text-secondary-foreground fill-secondary-foreground" />
                  </div>
                )}
              </div>
              <p className="font-heading font-bold text-xs text-foreground truncate w-full text-center">
                {creator.name}
              </p>
              <p className="text-[10px] text-muted-foreground">{creator.memberCount.toLocaleString("en-IN")} followers</p>
              <div className="flex items-center gap-1 text-[10px] text-accent">
                <Star className="w-2.5 h-2.5 fill-accent" /> {creator.owner?.stats?.rating ?? 4.5}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Popular Games */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Popular Games
          </h2>
          <button onClick={() => navigate("/tournaments")} className="text-xs text-primary font-heading flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {games.map((game, i) => (
            <motion.button
              key={game.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/tournaments?game=${game.query}`)}
              className="glass rounded-xl overflow-hidden group"
            >
              <div className="relative aspect-square">
                <img
                  src={game.image}
                  alt={game.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
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
      </div>

      {/* Trending Tournaments */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <div className="flex items-center justify-between mb-3">
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
        {trendingTournaments.map((t, i) => (
          <GlassCard
            key={t._id}
            neon
            className="mb-3"
            delay={i * 0.12}
            onClick={() => navigate(`/tournament/${t._id}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-heading font-bold text-sm">{t.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {gameLabels[t.game] ?? t.game} - {t.maxPlayers} slots
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-primary font-heading">by {t.channel?.name ?? t.organizer?.username ?? "Creator"}</span>
                  <Star className="w-2.5 h-2.5 text-secondary fill-secondary" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-heading font-bold text-accent neon-text-green flex items-center justify-end gap-1">
                  {t.prizeMode === "kill" && <Crosshair className="w-3 h-3" />}
                  {getPrizeSummary(t)}
                </p>
                <NeonButton variant={joinedTournamentIds.has(t._id) ? "green" : "purple"} className="text-[10px] py-1 px-3 mt-1">
                  {joinedTournamentIds.has(t._id) ? "Joined" : "Join"}
                </NeonButton>
              </div>
            </div>
          </GlassCard>
        ))}
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
      </div>

    </div>
  );
};

export default Index;
