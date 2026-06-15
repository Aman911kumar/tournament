import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Gamepad2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trophy,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SearchBox,
  SegmentedControl,
  SkeletonBlock,
  Surface,
} from "@/components/design-system";
import { CreatorChannel, followCreator, getCreators, getJoinedChannels, unfollowCreator } from "@/api/creators";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";
import { prefetchCreatorProfile, prefetchOnIntent } from "@/lib/route-prefetch";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { UserAvatar } from "@/components/identity";
import { DISCOVERY_GAMES, formatCompactNumber } from "@/config/discovery.config";
import { cn } from "@/lib/utils";

type SortKey = "Trending" | "Followers" | "Tournaments" | "Rating";
type FilterKey = "All" | "Following" | "Live" | "Verified";

const sortOptions: SortKey[] = ["Trending", "Followers", "Tournaments", "Rating"];
const filterOptions: FilterKey[] = ["All", "Following", "Live", "Verified"];

const useDebouncedValue = (value: string, delay = 240) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
};

const getCreatorRating = (creator: CreatorChannel) =>
  Number(creator.owner?.stats?.rating || creator.ranking?.rating || 0);

const getTournamentCount = (creator: CreatorChannel & { tournamentCount?: number }) =>
  Number(creator.tournamentCount ?? creator.ranking?.activeTournaments ?? creator.ranking?.completedTournaments ?? 0);

const getCreatorGames = (creator: CreatorChannel) => {
  const text = `${creator.name} ${creator.handle} ${creator.description || ""}`.toLowerCase();
  const matches = DISCOVERY_GAMES.filter((game) => {
    if (game.key === "freefire") return /free\s*fire|freefire|\bff\b/.test(text);
    if (game.key === "callofduty") return /call\s*of\s*duty|codm|\bcod\b/.test(text);
    if (game.key === "bgmi") return /bgmi|pubg/.test(text);
    return text.includes(game.label.toLowerCase()) || text.includes(game.short.toLowerCase());
  });

  return matches.length > 0 ? matches.slice(0, 3) : [];
};

const CreatorDiscoveryCard = ({
  creator,
  following,
  loading,
  onOpen,
  onFollowToggle,
  onPrefetch,
}: {
  creator: CreatorChannel & { tournamentCount?: number };
  following: boolean;
  loading: boolean;
  onOpen: () => void;
  onFollowToggle: () => void;
  onPrefetch?: () => void;
}) => {
  const rating = getCreatorRating(creator);
  const tournamentCount = getTournamentCount(creator);
  const banner = creator.banner?.url ?? creator.owner?.banner?.url;
  const games = getCreatorGames(creator);
  const description = creator.description || "Competitive tournament organizer.";

  return (
    <Surface className="relative min-h-[188px] overflow-hidden p-0 sm:min-h-[214px]">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/20 via-secondary/12 to-accent/10">
        {banner && (
          <img
            src={banner}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-35"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/15 to-card" />
      </div>

      <div className="relative flex h-full flex-col p-3">
        <div className="flex items-start gap-3">
          <UserAvatar
            user={{
              _id: creator.owner?._id,
              username: creator.name || creator.owner?.username,
              avatar: { url: creator.avatar?.url ?? creator.owner?.avatar?.url },
              role: ["creator"],
            }}
            size="lg"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate font-heading text-sm font-black leading-tight sm:text-base">{creator.name}</p>
              {!creator.virtual && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified creator" />}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">@{creator.handle}</p>
          </div>
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-heading text-[10px] font-bold",
              creator.isActive ? "bg-emerald-400/10 text-emerald-300" : "bg-muted/60 text-muted-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", creator.isActive ? "bg-emerald-300" : "bg-muted-foreground")} />
            {creator.isActive ? "Active" : "Recent"}
          </span>
        </div>

        <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
          {games.length > 0 ? games.map((game) => (
            <span key={game.key} className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 font-heading text-[10px] font-bold text-primary">
              <Gamepad2 className="h-3 w-3" />
              {game.short}
            </span>
          )) : (
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted/55 px-2 py-1 font-heading text-[10px] font-bold text-muted-foreground">
              <Gamepad2 className="h-3 w-3" />
              Multi-game
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.35rem] text-xs leading-5 text-muted-foreground">
          {description}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-heading font-bold text-accent">
            <Star className="h-3.5 w-3.5 fill-accent" />
            {rating > 0 ? rating.toFixed(1) : "New"}
          </span>
          <span>{formatCompactNumber(creator.memberCount)} followers</span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            {tournamentCount} events
          </span>
        </div>

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-3">
          <button
            type="button"
            onClick={onOpen}
            {...prefetchOnIntent(onPrefetch)}
            className="arena-focus inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm bg-primary px-3 font-heading text-xs font-bold text-primary-foreground"
          >
            View Profile
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={creator.virtual || loading}
            className={cn(
              "arena-focus inline-flex min-h-10 min-w-[5.5rem] items-center justify-center rounded-sm px-3 font-heading text-xs font-bold transition-colors disabled:opacity-50",
              following
                ? "bg-card text-primary"
                : "bg-secondary/15 text-secondary hover:bg-secondary/22",
            )}
          >
            {loading ? "..." : following ? "Following" : "Follow"}
          </button>
        </div>
      </div>
    </Surface>
  );
};

const SubscriptionsScreen = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All");
  const [activeSort, setActiveSort] = useState<SortKey>("Trending");
  const [showFilters, setShowFilters] = useState(false);
  const [creators, setCreators] = useState<(CreatorChannel & { tournamentCount?: number })[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const cachedCreators = readCache<(CreatorChannel & { tournamentCount?: number })[]>(CACHE_KEYS.creators);
    if (cachedCreators) {
      setCreators(cachedCreators.data);
      setLoading(false);
    }

    getCreators()
      .then((data) => {
        if (active) {
          setCreators(data);
          writeCache(CACHE_KEYS.creators, data);
        }
      })
      .catch(() => {
        if (active && !cachedCreators) setCreators([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    getJoinedChannels()
      .then((channels) => {
        if (active) setFollowingIds(new Set(channels.map((channel) => channel._id)));
      })
      .catch(() => {
        if (active) setFollowingIds(new Set());
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCreators = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let list = [...creators];

    if (activeFilter === "Following") list = list.filter((creator) => followingIds.has(creator._id));
    if (activeFilter === "Live") list = list.filter((creator) => creator.isActive);
    if (activeFilter === "Verified") list = list.filter((creator) => !creator.virtual);

    if (query) {
      list = list.filter((creator) =>
        creator.name.toLowerCase().includes(query) ||
        creator.handle.toLowerCase().includes(query) ||
        creator.owner?.username?.toLowerCase().includes(query) ||
        creator.description?.toLowerCase().includes(query)
      );
    }

    if (activeSort === "Followers") return list.sort((a, b) => Number(b.memberCount || 0) - Number(a.memberCount || 0));
    if (activeSort === "Tournaments") return list.sort((a, b) => getTournamentCount(b) - getTournamentCount(a));
    if (activeSort === "Rating") return list.sort((a, b) => getCreatorRating(b) - getCreatorRating(a));
    return list.sort((a, b) => Number(b.topScore || 0) - Number(a.topScore || 0));
  }, [activeFilter, activeSort, creators, debouncedSearch, followingIds]);

  const handleFollowToggle = async (creator: CreatorChannel) => {
    if (creator.virtual) {
      toast.info("Channel setup pending", { description: "You can follow this creator once the channel is ready." });
      return;
    }

    const isFollowing = followingIds.has(creator._id);
    const previous = new Set(followingIds);
    const next = new Set(followingIds);
    if (isFollowing) next.delete(creator._id);
    else next.add(creator._id);
    setFollowingIds(next);

    try {
      setFollowLoadingId(creator._id);
      if (isFollowing) {
        await unfollowCreator(creator._id);
        toast.success("Unfollowed", { description: creator.name });
      } else {
        await followCreator(creator._id);
        toast.success("Following", { description: creator.name });
      }
    } catch (error) {
      setFollowingIds(previous);
      const errorToast = getErrorToast(error, {
        action: isFollowing ? "Unfollow creator" : "Follow creator",
        fallback: "Could not update follow.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setFollowLoadingId(null);
    }
  };

  const hasActiveFilters = activeFilter !== "All" || activeSort !== "Trending";

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-4 pb-4">
      <PageHeader
        title="Creators"
        subtitle="Find organizers, communities, and tournament channels"
        onBack={() => navigate(-1)}
      />

      <div className="flex min-w-0 items-center gap-2">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search creators, handles, communities..."
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className={cn(
            "arena-focus inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-glass-border bg-card/80 px-3 font-heading text-[10px] font-bold transition-colors hover:border-primary/45 min-[420px]:gap-2 min-[420px]:px-4 min-[420px]:text-xs",
            showFilters || hasActiveFilters ? "neon-border text-primary" : "text-muted-foreground",
          )}
          aria-label="Toggle creator filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden min-[360px]:inline">Filters</span>
        </button>
      </div>

      {showFilters && (
        <Surface className="space-y-2.5 p-2.5 sm:p-3">
          <div className="grid gap-2.5 lg:grid-cols-2">
            <SegmentedControl
              value={activeFilter}
              onChange={(value) => setActiveFilter(value)}
              options={filterOptions.map((filter) => ({ label: filter, value: filter }))}
            />
            <SegmentedControl
              value={activeSort}
              onChange={(value) => setActiveSort(value)}
              options={sortOptions.map((sort) => ({ label: sort, value: sort }))}
            />
          </div>
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-3 border-t border-glass-border pt-2 text-[11px] text-muted-foreground">
              <span>
                Showing {activeFilter.toLowerCase()} creators sorted by {activeSort.toLowerCase()}.
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("All");
                  setActiveSort("Trending");
                }}
                className="arena-focus shrink-0 rounded-sm font-heading font-bold text-primary"
              >
                Reset
              </button>
            </div>
          )}
        </Surface>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && [0, 1, 2, 3, 4, 5].map((item) => (
          <Surface key={item} className="space-y-3 p-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
          </Surface>
        ))}

        {!loading && filteredCreators.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={Search}
              title="No creators found"
              description="Try a different search, filter, or sorting option."
              action={
                <NeonButton variant="ghost" className="text-xs" onClick={() => {
                  setSearch("");
                  setActiveFilter("All");
                }}>
                  Reset Search
                </NeonButton>
              }
            />
          </div>
        )}

        {!loading && filteredCreators.map((creator) => (
          <CreatorDiscoveryCard
            key={creator._id}
            creator={creator}
            following={followingIds.has(creator._id)}
            loading={followLoadingId === creator._id}
            onOpen={() => navigate(`/creator/${creator._id}`)}
            onPrefetch={() => prefetchCreatorProfile(creator._id)}
            onFollowToggle={() => handleFollowToggle(creator)}
          />
        ))}
      </div>

    </PageShell>
  );
};

export default SubscriptionsScreen;
