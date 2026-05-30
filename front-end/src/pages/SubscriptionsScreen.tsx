import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Crown,
  Flame,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
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
import { CreatorChannel, followCreator, getCreators, getJoinedChannels, unfollowCreator } from "@/api/creators";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { UserAvatar } from "@/components/identity";
import { formatCompactNumber } from "@/config/discovery.config";
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

const CreatorDiscoveryCard = ({
  creator,
  following,
  loading,
  onOpen,
  onFollowToggle,
}: {
  creator: CreatorChannel & { tournamentCount?: number };
  following: boolean;
  loading: boolean;
  onOpen: () => void;
  onFollowToggle: () => void;
}) => {
  const rating = getCreatorRating(creator);
  const tournamentCount = getTournamentCount(creator);
  const banner = creator.banner?.url ?? creator.owner?.banner?.url;

  return (
    <Surface className="overflow-hidden p-0">
      <button type="button" onClick={onOpen} className="arena-focus block w-full text-left">
        <div className="relative h-24 bg-gradient-to-r from-primary/30 via-secondary/20 to-accent/20">
          {banner && (
            <img
              src={banner}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/88 via-background/25 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-2">
            <StatusPill tone={creator.isActive ? "accent" : "muted"}>
              {creator.isActive ? "Live" : "Creator"}
            </StatusPill>
            {!creator.virtual && <StatusPill tone="secondary">Verified</StatusPill>}
          </div>
        </div>

        <div className="-mt-7 flex items-end gap-3 px-3 pb-3">
          <UserAvatar
            user={{
              _id: creator.owner?._id,
              username: creator.name || creator.owner?.username,
              avatar: { url: creator.avatar?.url ?? creator.owner?.avatar?.url },
              role: ["creator"],
            }}
            size="xl"
          />
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate font-heading text-base font-black">{creator.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{creator.handle}</p>
          </div>
          <ChevronRight className="mb-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </button>

      <div className="grid grid-cols-3 gap-2 border-y border-glass-border/70 px-3 py-2 text-center">
        <div>
          <p className="font-heading text-sm font-black">{formatCompactNumber(creator.memberCount)}</p>
          <p className="text-[10px] text-muted-foreground">Followers</p>
        </div>
        <div>
          <p className="font-heading text-sm font-black text-primary">{tournamentCount}</p>
          <p className="text-[10px] text-muted-foreground">Events</p>
        </div>
        <div>
          <p className="font-heading text-sm font-black text-accent">{rating.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Rating</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {creator.description || "Tournament organizer and esports creator"}
          </p>
        </div>
        <NeonButton
          variant={following ? "blue" : "purple"}
          className="min-h-9 shrink-0 px-3 py-1.5 text-[10px]"
          onClick={onFollowToggle}
          disabled={creator.virtual || loading}
        >
          {loading ? "..." : following ? "Following" : "Follow"}
        </NeonButton>
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

  const followingCount = followingIds.size;
  const liveCreators = creators.filter((creator) => creator.isActive).length;
  const verifiedCreators = creators.filter((creator) => !creator.virtual).length;
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

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { icon: Crown, label: `${creators.length} creators` },
          { icon: Shield, label: `${verifiedCreators} verified` },
          { icon: Flame, label: `${liveCreators} live` },
          { icon: Users, label: `${followingCount} following` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.label}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-glass-border bg-card/75 px-2.5 text-[11px] text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {item.label}
            </span>
          );
        })}
      </div>

      {showFilters && (
        <Surface className="space-y-2.5 p-2.5 sm:p-3">
          <div className="grid gap-2.5 lg:grid-cols-2">
            <SegmentedControl
              value={activeFilter}
              onChange={setActiveFilter}
              options={filterOptions.map((filter) => ({ label: filter, value: filter }))}
            />
            <SegmentedControl
              value={activeSort}
              onChange={setActiveSort}
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

      {filteredCreators.length > 0 && (
        <Surface className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-sm font-black">Trending Creator</p>
              <p className="text-xs text-muted-foreground">Best match for current filters</p>
            </div>
            <StatusPill tone="accent">Featured</StatusPill>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/creator/${filteredCreators[0]._id}`)}
            className="arena-focus mt-3 flex w-full items-center gap-3 border-t border-glass-border/70 px-0 py-3 text-left transition-colors hover:text-primary"
          >
            <UserAvatar
              user={{
                _id: filteredCreators[0].owner?._id,
                username: filteredCreators[0].name,
                avatar: { url: filteredCreators[0].avatar?.url ?? filteredCreators[0].owner?.avatar?.url },
                role: ["creator"],
              }}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-black">{filteredCreators[0].name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatCompactNumber(filteredCreators[0].memberCount)} followers - {getTournamentCount(filteredCreators[0])} tournaments
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Surface>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && [0, 1, 2, 3, 4, 5].map((item) => (
          <Surface key={item} className="space-y-3">
            <SkeletonBlock className="h-24" />
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
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
            onFollowToggle={() => handleFollowToggle(creator)}
          />
        ))}
      </div>

      {!loading && filteredCreators.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-card/55 px-3 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Follow creators to surface room alerts and new tournaments faster.
          </span>
          <button
            type="button"
            onClick={() => navigate("/channel-setup")}
            className="arena-focus shrink-0 rounded-lg px-2 py-1 font-heading font-bold text-primary"
          >
            Create channel
          </button>
        </div>
      )}
    </PageShell>
  );
};

export default SubscriptionsScreen;
