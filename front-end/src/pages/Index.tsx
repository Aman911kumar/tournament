import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BellRing,
  ChevronRight,
  Crown,
  Flame,
  Gamepad2,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import GameArtImage from "@/components/GameArtImage";
import NotificationBell from "@/components/NotificationBell";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SkeletonBlock,
  StatusPill,
  Surface,
} from "@/components/design-system";
import { UserAvatar } from "@/components/identity";
import { getMyTournamentRegistrations, getTournamentPage, Tournament } from "@/api/tournaments";
import { getCreators, CreatorChannel } from "@/api/creators";
import { formatCurrency, formatPrizeSummary } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";
import {
  DISCOVERY_GAMES,
  formatCompactNumber,
  formatDateShort,
  gameLabels,
  getDiscoveryGame,
} from "@/config/discovery.config";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const isHomeTournament = (tournament: Tournament) =>
  tournament.visibility !== "private" && !["draft", "completed", "cancelled"].includes(tournament.status);

const getParticipants = (tournament: Tournament) =>
  Number(tournament.participantCount ?? tournament.registrationCount ?? 0);

const SectionHeading = ({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Trophy;
  title: string;
  action?: React.ReactNode;
}) => (
  <div className="mb-3 flex items-center justify-between gap-3">
    <h2 className="flex min-w-0 items-center gap-2 font-heading text-base font-black">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">{title}</span>
    </h2>
    {action}
  </div>
);

const TournamentShowcaseCard = ({
  tournament,
  joined,
  compact = false,
  onClick,
  onCreatorClick,
}: {
  tournament: Tournament;
  joined?: boolean;
  compact?: boolean;
  onClick: () => void;
  onCreatorClick?: () => void;
}) => {
  const game = getDiscoveryGame(tournament.game);
  const participants = getParticipants(tournament);
  const fill = tournament.maxPlayers ? Math.min((participants / tournament.maxPlayers) * 100, 100) : 0;
  const isLive = tournament.status === "running";

  return (
    <button
      type="button"
      onClick={onClick}
      className="arena-focus group overflow-hidden rounded-xl border border-glass-border bg-card/82 text-left transition-colors hover:border-primary/45 hover:bg-card"
    >
      <div className={cn("relative", compact ? "h-24" : "h-32 sm:h-36")}>
        <GameArtImage
          game={game.key}
          variant={compact ? "banner" : "card"}
          className="transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusPill tone={isLive ? "accent" : "primary"}>{isLive ? "Live" : tournament.status}</StatusPill>
          {joined && <StatusPill tone="secondary">Joined</StatusPill>}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="truncate font-heading text-base font-black">{tournament.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {game.label} - {tournament.gameMode || tournament.type}
          </p>
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">Prize</p>
            <p className="truncate font-heading text-xs font-bold text-accent">
              {formatPrizeSummary(tournament)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Starts</p>
            <p className="truncate font-heading text-xs font-bold">{formatDateShort(tournament.startAt)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Entry</p>
            <p className="truncate font-heading text-xs font-bold">
              {Number(tournament.entryFee || 0) === 0 ? "Free" : formatCurrency(tournament.entryFee)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{participants}/{tournament.maxPlayers} players</span>
            <span>{Math.max(Number(tournament.maxPlayers || 0) - participants, 0)} slots left</span>
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
              onCreatorClick?.();
            }}
            className="arena-focus min-w-0 truncate rounded-lg text-xs text-muted-foreground hover:text-primary"
          >
            {tournament.channel?.name ?? tournament.organizer?.username ?? "Creator"}
          </button>
          <span className="inline-flex items-center gap-1 font-heading text-xs font-bold text-primary">
            {joined ? "Open" : "Join"} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [trendingTournaments, setTrendingTournaments] = useState<Tournament[]>([]);
  const [recommendedCreators, setRecommendedCreators] = useState<(CreatorChannel & { tournamentCount?: number })[]>([]);
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    }

    try {
      if (nextPage === 1) setLoading(!cachedHome);
      if (nextPage > 1) setLoadingMore(true);
      const [tournaments, creators, registrations] = await Promise.all([
        getTournamentPage({ sort: "trending", page: nextPage, limit: PAGE_SIZE, excludeCompleted: true }),
        getCreators(),
        getMyTournamentRegistrations().catch(() => []),
      ]);
      const visibleTournaments = tournaments.tournaments.filter(isHomeTournament);
      setTrendingTournaments((previous) =>
        nextPage === 1 ? visibleTournaments : [...previous, ...visibleTournaments],
      );
      setRecommendedCreators(creators.slice(0, 5));
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
          creators: creators.slice(0, 5),
          joinedIds,
          page: tournaments.page ?? nextPage,
          hasMore: Boolean(tournaments.hasMore),
        });
      }
    } catch {
      if (nextPage === 1 && !cachedHome) {
        setTrendingTournaments([]);
        setRecommendedCreators([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadHome(1);
  }, [loadHome]);

  const liveTournaments = useMemo(
    () => trendingTournaments.filter((tournament) => tournament.status === "running"),
    [trendingTournaments],
  );

  const featuredTournament = liveTournaments[0] ?? trendingTournaments[0];
  const livePlayers = useMemo(
    () => liveTournaments.reduce((sum, tournament) => sum + getParticipants(tournament), 0),
    [liveTournaments],
  );

  const gameCounts = useMemo(() => {
    return trendingTournaments.reduce<Record<string, { count: number; players: number }>>((acc, tournament) => {
      const item = acc[tournament.game] ?? { count: 0, players: 0 };
      item.count += 1;
      item.players += getParticipants(tournament);
      acc[tournament.game] = item;
      return acc;
    }, {});
  }, [trendingTournaments]);

  const activityFeed = useMemo(() => {
    const tournamentItems = trendingTournaments.slice(0, 4).map((tournament) => ({
      icon: tournament.status === "running" ? Radio : Trophy,
      title: tournament.status === "running" ? "Live room active" : "Tournament opened",
      description: `${tournament.title} - ${gameLabels[tournament.game] ?? tournament.game}`,
      tone: tournament.status === "running" ? "text-accent" : "text-primary",
    }));

    const creatorItems = recommendedCreators.slice(0, 2).map((creator) => ({
      icon: Crown,
      title: "Creator trending",
      description: `${creator.name} has ${formatCompactNumber(creator.memberCount)} followers`,
      tone: "text-secondary",
    }));

    return [...tournamentItems, ...creatorItems].slice(0, 5);
  }, [recommendedCreators, trendingTournaments]);

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-5 pb-4 sm:space-y-6">
      <PageHeader
        title={<span className="font-display text-xl tracking-wide neon-text-purple">BATTLE4ARENA</span>}
        subtitle="Live tournaments, creators, rewards"
        action={
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={() => navigate("/tournaments")}
              className="arena-icon-button"
              aria-label="Search tournaments"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Surface neon className="relative overflow-hidden p-0">
          <div className="absolute inset-0 opacity-70">
            {featuredTournament && (
              <GameArtImage game={featuredTournament.game} variant="banner" alt="" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/88 to-background/45" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.25),transparent_30%),radial-gradient(circle_at_80%_10%,hsl(var(--secondary)/0.16),transparent_28%)]" />
          </div>

          <div className="relative p-4 sm:p-6 lg:p-7">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 font-heading text-[10px] font-bold text-accent">
              <Radio className="h-3.5 w-3.5" />
              {liveTournaments.length > 0 ? "LIVE ECOSYSTEM" : "MATCH DISCOVERY"}
            </div>
            <h1 className="mt-4 max-w-2xl font-heading text-3xl font-black leading-[0.98] sm:text-4xl lg:text-5xl">
              Find your next arena, squad up, and win real rewards.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Browse live rooms, follow trusted creators, and jump into mobile-first esports tournaments built for fast play.
            </p>

            <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
              <NeonButton variant="green" className="min-h-11 text-xs" onClick={() => navigate("/tournaments")}>
                <Trophy className="h-4 w-4" />
                Join Tournament
              </NeonButton>
              <NeonButton variant="ghost" className="min-h-11 text-xs" onClick={() => navigate("/create-tournament")}>
                <Sparkles className="h-4 w-4" />
                Create
              </NeonButton>
              <NeonButton variant="blue" className="min-h-11 text-xs" onClick={() => navigate("/subscriptions")}>
                <Crown className="h-4 w-4" />
                Discover Creators
              </NeonButton>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 max-w-xl">
              <div className="rounded-xl border border-glass-border bg-background/55 p-2.5">
                <p className="font-heading text-lg font-black text-accent">{liveTournaments.length}</p>
                <p className="text-[10px] text-muted-foreground">Live</p>
              </div>
              <div className="rounded-xl border border-glass-border bg-background/55 p-2.5">
                <p className="font-heading text-lg font-black text-secondary">{formatCompactNumber(livePlayers)}</p>
                <p className="text-[10px] text-muted-foreground">Players</p>
              </div>
              <div className="rounded-xl border border-glass-border bg-background/55 p-2.5">
                <p className="font-heading text-lg font-black text-primary">{recommendedCreators.length}</p>
                <p className="text-[10px] text-muted-foreground">Creators</p>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-sm font-black">Live Activity</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Platform pulse</p>
            </div>
            <StatusPill tone="accent">Realtime</StatusPill>
          </div>
          <div className="mt-4 space-y-2">
            {loading && !activityFeed.length
              ? [0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-12" />)
              : activityFeed.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={`${item.title}-${index}`} className="flex items-center gap-3 rounded-xl border border-glass-border bg-background/35 p-2.5">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/55", item.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-xs font-bold">{item.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </Surface>
      </section>

      <section>
        <SectionHeading
          icon={Flame}
          title="Live & Trending"
          action={
            <button
              type="button"
              onClick={() => navigate("/tournaments?sort=trending")}
              className="arena-focus inline-flex items-center gap-1 rounded-lg px-2 py-1 font-heading text-xs font-bold text-primary"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        {loading && trendingTournaments.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Surface key={item} className="space-y-3">
                <SkeletonBlock className="h-32" />
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/2" />
              </Surface>
            ))}
          </div>
        ) : trendingTournaments.length === 0 ? (
          <EmptyState icon={Trophy} title="No tournaments live yet" description="Fresh matches will appear here as creators publish them." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trendingTournaments.map((tournament) => (
              <TournamentShowcaseCard
                key={tournament._id}
                tournament={tournament}
                joined={joinedTournamentIds.has(tournament._id)}
                onClick={() => navigate(`/tournament/${tournament._id}`)}
                onCreatorClick={() => navigate(tournament.channel?._id ? `/creator/${tournament.channel._id}` : "/subscriptions")}
              />
            ))}
          </div>
        )}
        {hasMore && (
          <NeonButton
            full
            variant="blue"
            className="mt-3 min-h-11 text-xs"
            onClick={() => loadHome(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? "LOADING..." : "LOAD MORE"}
          </NeonButton>
        )}
      </section>

      <section>
        <SectionHeading
          icon={Gamepad2}
          title="Game Categories"
          action={
            <button
              type="button"
              onClick={() => navigate("/tournaments")}
              className="arena-focus inline-flex items-center gap-1 rounded-lg px-2 py-1 font-heading text-xs font-bold text-primary"
            >
              Browse <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {DISCOVERY_GAMES.map((game, index) => {
            const stats = gameCounts[game.key] ?? { count: 0, players: 0 };
            return (
              <motion.button
                key={game.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                type="button"
                onClick={() => navigate(`/tournaments?game=${game.key}`)}
                className="arena-focus group overflow-hidden rounded-xl border border-glass-border bg-card/82 text-left transition-colors hover:border-primary/45"
              >
                <div className="relative aspect-[1.15]">
                  <GameArtImage
                    game={game.key}
                    alt={game.label}
                    className="transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-heading text-sm font-black">{game.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{game.tagline}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 text-xs">
                  <span className="text-muted-foreground">{stats.count} events</span>
                  <span className="font-heading font-bold text-accent">{formatCompactNumber(stats.players)} players</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div>
          <SectionHeading
            icon={Crown}
            title="Featured Creators"
            action={
              <button
                type="button"
                onClick={() => navigate("/subscriptions")}
                className="arena-focus inline-flex items-center gap-1 rounded-lg px-2 py-1 font-heading text-xs font-bold text-primary"
              >
                Discover <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendedCreators.slice(0, 4).map((creator) => (
              <Surface
                key={creator._id}
                interactive
                onClick={() => navigate(`/creator/${creator._id}`)}
                className="overflow-hidden p-0"
              >
                <div className="h-16 bg-gradient-to-r from-primary/30 via-secondary/20 to-accent/20">
                  {(creator.banner?.url || creator.owner?.banner?.url) && (
                    <img
                      src={creator.banner?.url ?? creator.owner?.banner?.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="-mt-6 flex items-end gap-3 px-3 pb-3">
                  <UserAvatar
                    user={{
                      _id: creator.owner?._id,
                      username: creator.name,
                      avatar: { url: creator.avatar?.url ?? creator.owner?.avatar?.url },
                      role: ["creator"],
                    }}
                    size="xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-black">{creator.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">@{creator.handle}</p>
                  </div>
                  <StatusPill tone={creator.isActive ? "accent" : "muted"}>
                    {creator.isActive ? "Active" : "Creator"}
                  </StatusPill>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-glass-border/70 px-3 py-2.5 text-center text-[10px] text-muted-foreground">
                  <span><b className="block font-heading text-xs text-foreground">{formatCompactNumber(creator.memberCount)}</b>Followers</span>
                  <span><b className="block font-heading text-xs text-foreground">{creator.tournamentCount ?? creator.ranking?.activeTournaments ?? 0}</b>Events</span>
                  <span><b className="block font-heading text-xs text-accent">{Number(creator.owner?.stats?.rating || creator.ranking?.rating || 0).toFixed(1)}</b>Rating</span>
                </div>
              </Surface>
            ))}
          </div>
        </div>

        <Surface className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-accent" />
            <p className="font-heading text-sm font-black">Rewards Preview</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Join tournaments, claim winnings, follow reliable creators, and keep room alerts synced from one mobile-first esports hub.
          </p>
          <div className="mt-4 grid gap-2">
            {[
              { icon: ShieldCheck, label: "Verified creators", value: `${recommendedCreators.filter((c) => c.isActive).length}+ active` },
              { icon: BellRing, label: "Room alerts", value: "Chat + push ready" },
              { icon: Zap, label: "Fast routing", value: "Optimized API cache" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-background/35 p-2.5">
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </span>
                  <span className="font-heading text-xs font-bold">{item.value}</span>
                </div>
              );
            })}
          </div>
        </Surface>
      </section>
    </PageShell>
  );
};

export default Index;
