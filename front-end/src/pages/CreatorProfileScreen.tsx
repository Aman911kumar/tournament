import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Crown,
  Flag,
  LoaderCircle,
  MessageCircle,
  RefreshCcw,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SegmentedControl,
  SkeletonBlock,
  StatusPill,
  Surface,
} from "@/components/design-system";
import GameArtImage from "@/components/GameArtImage";
import {
  followCreator,
  getCreatorProfile,
  rateCreator,
  unfollowCreator,
  CreatorProfileData,
} from "@/api/creators";
import { Tournament } from "@/api/tournaments";
import { toast } from "@/components/ui/sonner";
import {
  formatCurrency,
  formatPrizeSummary,
  getErrorMessage,
  getErrorToast,
} from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";
import {
  prefetchOnIntent,
  prefetchRoute,
  prefetchTournamentDetail,
} from "@/lib/route-prefetch";
import { createReport } from "@/api/moderation";
import { startDmConversation } from "@/api/dm";
import { ProfileHero } from "@/components/identity";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  formatCompactNumber,
  formatDateShort,
  getDiscoveryGame,
} from "@/config/discovery.config";
import { cn } from "@/lib/utils";

const statusTone: Record<
  Tournament["status"],
  "primary" | "secondary" | "accent" | "danger" | "muted"
> = {
  draft: "muted",
  open: "accent",
  running: "danger",
  completed: "secondary",
  cancelled: "muted",
};

const starRatingOptions = [
  { value: 5, title: "Excellent!" },
  { value: 4, title: "Great!" },
  { value: 3, title: "Good" },
  { value: 2, title: "Okay" },
  { value: 1, title: "Bad" },
] as const;

const starPath =
  "M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z";

const normalizeRatingValue = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(numeric * 2) / 2));
};

const getRatingDraftValue = (profile?: CreatorProfileData | null) => {
  const ownRating = normalizeRatingValue(profile?.viewer?.myRating);
  const averageRating = normalizeRatingValue(
    (profile?.creator ?? profile?.channel?.owner)?.stats?.rating,
  );
  return ownRating ?? averageRating ?? 4;
};

const getStarDraftValue = (profile?: CreatorProfileData | null) =>
  Math.min(5, Math.max(1, Math.round(getRatingDraftValue(profile))));

const stripViewerState = (profile: CreatorProfileData): CreatorProfileData => ({
  ...profile,
  viewer: undefined,
});

const getTournamentFill = (tournament: Tournament) => {
  const capacity = Number(tournament.maxPlayers || 0);
  const teamCapacity = Number(tournament.maxTeams || 0);
  const participantCount = Number(tournament.participantCount || 0);
  const joinedPlayerCount = Array.isArray(tournament.joinedPlayers)
    ? tournament.joinedPlayers.length
    : 0;
  const registrationCount = Number(tournament.registrationCount || 0);
  const booked = Math.max(participantCount, joinedPlayerCount, registrationCount);
  const taken = capacity ? Math.min(booked, capacity) : booked;
  const percent = capacity
    ? Math.min(100, Math.max(0, Math.round((taken / capacity) * 100)))
    : 0;

  return {
    capacity,
    taken,
    remaining: capacity ? Math.max(capacity - taken, 0) : 0,
    percent,
    teamCapacity,
    teamBooked: registrationCount,
  };
};

const RatingStars = ({
  value,
  className = "h-4 w-4",
}: {
  value: number;
  className?: string;
}) => (
  <div
    className="flex items-center gap-1"
    aria-label={`${Number(value || 0).toFixed(1)} out of 5`}
  >
    {[1, 2, 3, 4, 5].map((star) => {
      const fillPercent =
        Math.max(0, Math.min(1, Number(value || 0) - (star - 1))) * 100;
      return (
        <span key={star} className={`relative inline-flex ${className}`}>
          <Star className={`${className} text-muted-foreground/35`} />
          <span
            className="absolute inset-0 overflow-hidden text-accent"
            style={{ width: `${fillPercent}%` }}
          >
            <Star className={`${className} fill-accent text-accent`} />
          </span>
        </span>
      );
    })}
  </div>
);

const StarRatingInput = ({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => {
  const controlId = useId();
  const selectedValue = Math.min(5, Math.max(1, Math.round(value || 0)));

  return (
    <div
      className={cn("b4a-star-rating", disabled && "is-disabled")}
      aria-label="Select creator rating"
    >
      {starRatingOptions.map((option) => {
        const inputId = `${controlId}-star-${option.value}`;
        return (
          <Fragment key={option.value}>
            <input
              type="radio"
              id={inputId}
              name={`${controlId}-creator-rating`}
              value={option.value}
              checked={selectedValue === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <label
              title={option.title}
              htmlFor={inputId}
              data-rating={option.value}
              aria-label={`${option.value} star${option.value === 1 ? "" : "s"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true">
                <path d={starPath} />
              </svg>
            </label>
          </Fragment>
        );
      })}
    </div>
  );
};

const CreatorProfileSkeleton = () => (
  <div className="space-y-3 sm:space-y-4">
    <Surface className="overflow-hidden p-0">
      <SkeletonBlock className="h-28 rounded-none sm:h-36" />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-end gap-3">
          <SkeletonBlock className="h-20 w-20 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pb-1">
            <SkeletonBlock className="h-5 w-48 max-w-full" />
            <SkeletonBlock className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <SkeletonBlock key={item} className="h-14" />
          ))}
        </div>
      </div>
    </Surface>
    <Surface>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock className="h-8 w-full sm:w-72" />
        <SkeletonBlock className="h-10 w-full sm:w-40" />
      </div>
    </Surface>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <SkeletonBlock className="h-10 w-full" />
        {[0, 1].map((item) => (
          <Surface key={item} className="p-0">
            <SkeletonBlock className="h-24 rounded-b-none" />
            <div className="space-y-3 p-3">
              <SkeletonBlock className="h-4 w-56 max-w-full" />
              <div className="grid grid-cols-3 gap-2">
                <SkeletonBlock className="h-12" />
                <SkeletonBlock className="h-12" />
                <SkeletonBlock className="h-12" />
              </div>
            </div>
          </Surface>
        ))}
      </div>
      <Surface>
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-9 w-full" />
        </div>
      </Surface>
    </div>
  </div>
);

const CreatorTournamentCard = ({
  tournament,
  onClick,
  onPrefetch,
}: {
  tournament: Tournament;
  onClick: () => void;
  onPrefetch?: () => void;
}) => {
  const game = getDiscoveryGame(tournament.game);
  const fill = getTournamentFill(tournament);

  return (
    <Surface
      interactive
      onClick={onClick}
      {...prefetchOnIntent(onPrefetch)}
      neon
      className="overflow-hidden p-0 transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="relative h-24 overflow-hidden sm:h-28">
        <GameArtImage game={game.key} alt={game.label} variant="banner" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.92),hsl(var(--background)/0.52),hsl(var(--background)/0.82))]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <StatusPill tone={statusTone[tournament.status]}>
            {tournament.status}
          </StatusPill>
          <StatusPill tone={tournament.entryFee > 0 ? "primary" : "accent"}>
            {tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : "Free"}
          </StatusPill>
        </div>
        <div className="absolute bottom-3 left-3 right-3 min-w-0">
          <p className="truncate font-heading text-base font-black text-white">
            {tournament.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {game.label} - {formatDateShort(tournament.startAt)}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-lg border border-glass-border bg-background/45 p-2">
            <p className="text-[10px] text-muted-foreground">Prize</p>
            <p className="truncate font-heading text-xs font-bold text-accent">
              {formatPrizeSummary(tournament)}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-glass-border bg-background/45 p-2">
            <p className="text-[10px] text-muted-foreground">Booked</p>
            <p className="font-heading text-xs font-bold">
              {fill.taken}/{fill.capacity || "-"}
            </p>
            {fill.teamCapacity > 0 && (
              <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                {fill.teamBooked}/{fill.teamCapacity} teams
              </p>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-glass-border bg-background/45 p-2">
            <p className="text-[10px] text-muted-foreground">Mode</p>
            <p className="truncate font-heading text-xs font-bold capitalize">
              {tournament.gameMode || tournament.type}
            </p>
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
            style={{ width: `${fill.percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {fill.remaining} slots left
          </span>
          <span className="inline-flex items-center gap-1 font-heading text-[11px] font-bold text-primary">
            Open event
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Surface>
  );
};

const CreatorProfileScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const { profile: currentProfile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [draftRating, setDraftRating] = useState(4);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportProof, setReportProof] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tournaments" | "about">(
    "tournaments",
  );

  const applyProfileData = useCallback((nextProfile: CreatorProfileData) => {
    setProfile(nextProfile);
    setIsFollowing(Boolean(nextProfile.viewer?.isFollowing));
    setMyRating(normalizeRatingValue(nextProfile.viewer?.myRating));
    setDraftRating(getStarDraftValue(nextProfile));
  }, []);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    const cachedProfile = readCache<CreatorProfileData>(
      CACHE_KEYS.creatorProfile(id),
    );
    if (cachedProfile) {
      applyProfileData(stripViewerState(cachedProfile.data));
      setLoading(false);
    }

    try {
      setLoading(!cachedProfile);
      setRefreshing(Boolean(cachedProfile));
      setError(null);
      const nextProfile = await getCreatorProfile(id);
      applyProfileData(nextProfile);
      writeCache(CACHE_KEYS.creatorProfile(id), stripViewerState(nextProfile));
    } catch (loadError) {
      if (!cachedProfile) {
        setError(getErrorMessage(loadError, "Failed to load creator profile."));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProfileData, id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const channel = profile?.channel;
  const creator = profile?.creator ?? channel?.owner;
  const displayName = channel?.name ?? creator?.username ?? "Creator";
  const handle = channel?.handle
    ? `@${channel.handle}`
    : creator?.username
      ? `@${creator.username}`
      : "";
  const description = channel?.description || "Tournament creator";
  const rating = Number(creator?.stats?.rating || 0);
  const ratingCount = Number(creator?.stats?.ratingCount || 0);
  const totalPrize = Number(profile?.totalPrize || 0);
  const tournaments = useMemo(() => profile?.tournaments ?? [], [profile]);
  const liveEvents = tournaments.filter((item) => item.status === "running").length;
  const openEvents = tournaments.filter((item) => item.status === "open").length;
  const canFollow = Boolean(channel?._id && !channel.virtual);
  const isVerifiedCreator = Boolean(creator?.role?.includes("creator") || channel?._id);
  const currentUserId = currentProfile?._id || null;
  const isOwnCreatorProfile = Boolean(currentUserId && creator?._id === currentUserId);
  const ownProfileAvatarUrl = isOwnCreatorProfile ? currentProfile?.avatar?.url : undefined;
  const ownProfileBannerUrl = isOwnCreatorProfile ? currentProfile?.banner?.url : undefined;
  const creatorAvatarUrl = ownProfileAvatarUrl || channel?.avatar?.url || creator?.avatar?.url;
  const creatorBannerUrl = ownProfileBannerUrl || channel?.banner?.url || creator?.banner?.url;

  const handleMessageCreator = async () => {
    if (!creator?._id) {
      toast.error("Creator account not available");
      return;
    }
    if (isOwnCreatorProfile) {
      toast.info("This is your creator profile");
      return;
    }
    try {
      setDmLoading(true);
      const { conversation } = await startDmConversation({
        targetUserId: creator._id,
        metadata: {
          source: "creator-profile",
          creatorId: creator._id,
          creatorName: displayName,
        },
      });
      navigate(`/messages/${conversation._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open direct message");
    } finally {
      setDmLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!channel?._id) {
      toast.info("This creator has no channel yet.");
      return;
    }

    const nextFollowing = !isFollowing;
    const previousFollowing = isFollowing;
    const previousProfile = profile;

    setIsFollowing(nextFollowing);
    setProfile((current) => {
      if (!current?.channel) return current;
      return {
        ...current,
        viewer: { ...(current.viewer ?? {}), isFollowing: nextFollowing },
        channel: {
          ...current.channel,
          memberCount: Math.max(
            0,
            Number(current.channel.memberCount || 0) + (nextFollowing ? 1 : -1),
          ),
        },
      };
    });

    try {
      setFollowLoading(true);
      const res = nextFollowing
        ? await followCreator(channel._id)
        : await unfollowCreator(channel._id);
      toast.success(res.message);
    } catch (followError) {
      setIsFollowing(previousFollowing);
      setProfile(previousProfile);
      const errorToast = getErrorToast(followError, {
        action: nextFollowing ? "Follow creator" : "Unfollow creator",
        fallback: "Could not update follow status.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRate = async (value: number) => {
    const targetId = channel?._id || creator?._id;
    if (!targetId) return;
    const normalizedRating = normalizeRatingValue(value);
    if (!normalizedRating) return;

    try {
      setRatingLoading(true);
      const res = await rateCreator(
        targetId,
        normalizedRating,
        channel?._id ? "channel" : "user",
      );
      const updatedCreator = res.data.creator;
      setProfile((current) =>
        current
          ? {
              ...current,
              viewer: { ...(current.viewer ?? {}), myRating: normalizedRating },
              creator:
                current.creator?._id === updatedCreator._id
                  ? updatedCreator
                  : current.creator,
              channel: current.channel
                ? { ...current.channel, owner: updatedCreator }
                : current.channel,
            }
          : current,
      );
      setMyRating(normalizedRating);
      setDraftRating(normalizedRating);
      toast.success("Rating saved", {
        description: `You rated ${displayName} ${normalizedRating.toFixed(1)}/5.`,
      });
    } catch (rateError) {
      const errorToast = getErrorToast(rateError, {
        action: "Rate creator",
        fallback: "Could not save rating.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleReportCreator = async () => {
    if (!creator?._id) return;
    if (reportDescription.trim().length < 12) {
      toast.error("Add more details", {
        description: "Tell admin what payout or creator issue happened.",
      });
      return;
    }

    try {
      setReportLoading(true);
      await createReport({
        title: `Creator report: ${displayName}`,
        targetType: "creator",
        category: "creator",
        message: reportDescription.trim(),
        reportedCreator: creator._id,
        evidence: { matchProof: reportProof.trim() },
        severity: "high",
      });
      toast.success("Creator report submitted", {
        description: "Admin will review the payout dispute.",
      });
      setReportOpen(false);
      setReportDescription("");
      setReportProof("");
    } catch (reportError) {
      toast.error(getErrorMessage(reportError, "Could not submit creator report."));
    } finally {
      setReportLoading(false);
    }
  };

  const canSubmitRating = Boolean(currentUserId && !isOwnCreatorProfile && creator?._id);
  const ratingStatusText = myRating
    ? `Your rating: ${myRating.toFixed(1)}/5`
    : currentUserId
      ? "You have not rated this creator yet"
      : "Login to rate this creator";

  const renderRatingCard = () => (
    <Surface className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-accent" />
            <p className="font-heading text-sm font-bold">Creator trust</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RatingStars value={rating} className="h-3.5 w-3.5" />
            <span className="text-[11px] text-muted-foreground">
              {rating.toFixed(1)} average from {ratingCount} rating
              {ratingCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {myRating ? (
          <StatusPill tone="accent">{myRating.toFixed(1)}/5</StatusPill>
        ) : null}
      </div>

      <div className="rounded-xl border border-glass-border bg-background/58 p-3">
        <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {ratingStatusText}
          </span>
          <span className="font-heading text-sm font-bold text-accent">
            {draftRating.toFixed(0)}/5
          </span>
        </div>

        <div className="mt-3 flex items-center justify-center rounded-lg bg-[#0D1117]/75 px-3 py-3">
          <StarRatingInput
            value={draftRating}
            onChange={setDraftRating}
            disabled={!canSubmitRating || ratingLoading}
          />
        </div>

        {!currentUserId && (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="arena-focus mt-3 w-full rounded-xl border border-primary/30 px-3 py-2 font-heading text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Login to rate
          </button>
        )}
        {currentUserId && isOwnCreatorProfile && (
          <p className="mt-3 rounded-lg border border-secondary/20 bg-secondary/10 px-3 py-2 text-[10px] text-secondary">
            You cannot rate your own creator profile.
          </p>
        )}
        {canSubmitRating && (
          <button
            type="button"
            onClick={() => handleRate(draftRating)}
            disabled={ratingLoading || myRating === draftRating}
            className="arena-focus mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 font-heading text-xs font-bold text-accent-foreground shadow-[0_0_18px_hsl(var(--accent)/0.18)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ratingLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            {ratingLoading
              ? "Saving rating..."
              : myRating === draftRating
                ? "Rating saved"
                : "Save rating"}
          </button>
        )}
      </div>
    </Surface>
  );

  const heroSubtitle = [handle, description].filter(Boolean).join(" - ");

  return (
    <PageShell wide contentClassName="max-w-6xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Creator Profile"
        subtitle="Organizer identity, ratings, and active events"
        onBack={() => navigate(-1)}
        action={
          refreshing ? (
            <StatusPill tone="primary" className="hidden sm:inline-flex">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Syncing
            </StatusPill>
          ) : null
        }
      />

      {loading && <CreatorProfileSkeleton />}

      {!loading && error && (
        <EmptyState
          icon={AlertCircle}
          title="Could not load creator"
          description={error}
          action={
            <button
              type="button"
              onClick={loadProfile}
              className="arena-focus inline-flex items-center gap-1.5 rounded-xl border border-primary/25 px-3 py-2 font-heading text-xs font-bold text-primary"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          }
        />
      )}

      {!loading && !error && profile && (
        <>
          {refreshing && (
            <StatusPill tone="primary" className="sm:hidden">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Refreshing creator
            </StatusPill>
          )}

          <ProfileHero
            compact
            className="rounded-xl sm:rounded-2xl"
            user={{
              _id: creator?._id,
              username: displayName,
              avatar: creatorAvatarUrl ? { url: creatorAvatarUrl } : undefined,
              role: isVerifiedCreator ? ["creator"] : creator?.role,
            }}
            title={displayName}
            subtitle={heroSubtitle}
            bannerUrl={creatorBannerUrl}
            stats={[
              {
                label: "Followers",
                value: formatCompactNumber(channel?.memberCount ?? 0),
              },
              {
                label: "Events",
                value: formatCompactNumber(profile.tournamentCount),
              },
              { label: "Prize", value: formatCurrency(totalPrize) },
            ]}
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="arena-focus grid h-9 w-9 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:border-destructive/55 hover:bg-destructive/15"
                  title="Report creator"
                >
                  <Flag className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleMessageCreator}
                  disabled={dmLoading || isOwnCreatorProfile}
                  className="arena-focus grid h-9 w-9 place-items-center rounded-xl border border-glass-border bg-secondary/[0.045] text-muted-foreground transition-colors hover:border-secondary/40 hover:text-secondary"
                  title="Message creator"
                >
                  {dmLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                </button>
                {isVerifiedCreator && (
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/25 bg-accent/10">
                    <Shield className="h-4 w-4 fill-accent text-accent" />
                  </span>
                )}
              </div>
            }
          />

          <Surface className="p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={isVerifiedCreator ? "secondary" : "muted"}>
                    <Sparkles className="h-3 w-3" />
                    {isVerifiedCreator ? "Verified creator" : "Creator"}
                  </StatusPill>
                  <StatusPill tone={liveEvents ? "danger" : openEvents ? "accent" : "muted"}>
                    {liveEvents
                      ? `${liveEvents} live`
                      : openEvents
                        ? `${openEvents} open`
                        : "No live events"}
                  </StatusPill>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>

              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                {canFollow ? (
                  <NeonButton
                    variant={isFollowing ? "blue" : "purple"}
                    className="min-h-10 px-4 py-2 text-xs min-[420px]:w-auto"
                    onClick={handleFollow}
                    disabled={followLoading}
                    full
                  >
                    {followLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    {followLoading
                      ? "Updating"
                      : isFollowing
                        ? "Following"
                        : "Follow creator"}
                  </NeonButton>
                ) : (
                  <div className="rounded-xl border border-secondary/20 bg-secondary/10 px-3 py-2 text-xs text-secondary">
                    Channel setup pending
                  </div>
                )}

                {!canFollow && isOwnCreatorProfile && (
                  <button
                    type="button"
                    onClick={() => navigate("/channel-setup")}
                    {...prefetchOnIntent(() => prefetchRoute("/channel-setup"))}
                    className="arena-focus rounded-xl border border-secondary/30 px-3 py-2 font-heading text-xs font-semibold text-secondary transition-colors hover:bg-secondary/10"
                  >
                    Setup channel
                  </button>
                )}
              </div>
            </div>
          </Surface>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <main className="min-w-0 space-y-3">
              <SegmentedControl
                value={activeTab}
                onChange={(value) => setActiveTab(value)}
                options={[
                  { value: "tournaments", label: "Events" },
                  { value: "about", label: "About" },
                ]}
              />

              {activeTab === "tournaments" && (
                <div className="space-y-3">
                  {tournaments.length === 0 ? (
                    <EmptyState
                      icon={Trophy}
                      title="No tournaments yet"
                      description="This creator has not published an event."
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {tournaments.map((tournament) => (
                    <CreatorTournamentCard
                      key={tournament._id}
                      tournament={tournament}
                      onClick={() => navigate(`/tournament/${tournament._id}`)}
                      onPrefetch={() => prefetchTournamentDetail(tournament._id)}
                    />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "about" && (
                <Surface className="space-y-4">
                  <div>
                    <p className="font-heading text-sm font-bold">About creator</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <div className="grid gap-2 min-[420px]:grid-cols-3">
                    <div className="rounded-xl border border-glass-border bg-background/45 p-3">
                      <Users className="mb-2 h-4 w-4 text-secondary" />
                      <p className="font-heading text-sm font-bold">
                        {(channel?.memberCount ?? 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Followers
                      </p>
                    </div>
                    <div className="rounded-xl border border-glass-border bg-background/45 p-3">
                      <Trophy className="mb-2 h-4 w-4 text-primary" />
                      <p className="font-heading text-sm font-bold">
                        {profile.tournamentCount}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Events
                      </p>
                    </div>
                    <div className="rounded-xl border border-glass-border bg-background/45 p-3">
                      <WalletCards className="mb-2 h-4 w-4 text-accent" />
                      <p className="font-heading text-sm font-bold">
                        {formatCurrency(totalPrize)}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Prize hosted
                      </p>
                    </div>
                  </div>
                </Surface>
              )}
            </main>

            <aside className="space-y-3 lg:sticky lg:top-4">
              {renderRatingCard()}
              <Surface className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-secondary" />
                  <p className="font-heading text-sm font-bold">Creator pulse</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-glass-border bg-background/45 p-3">
                    <p className="font-heading text-lg font-black text-primary">
                      {openEvents}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      Open
                    </p>
                  </div>
                  <div className="rounded-xl border border-glass-border bg-background/45 p-3">
                    <p className="font-heading text-lg font-black text-destructive">
                      {liveEvents}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      Live
                    </p>
                  </div>
                </div>
              </Surface>
            </aside>
          </div>
        </>
      )}

      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/88 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass w-full max-w-md rounded-2xl border border-glass-border p-4 sm:p-5"
            >
              <h3 className="font-heading text-lg font-bold">Report creator</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Use this for missing prize distribution, wrong payout, or creator
                misconduct.
              </p>

              <label className="mt-4 block">
                <span className="font-heading text-[10px] text-muted-foreground">
                  Details
                </span>
                <textarea
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  rows={4}
                  placeholder="Mention tournament name, amount, date, and what was promised..."
                  className="arena-focus mt-1 w-full resize-none rounded-xl border border-glass-border bg-background px-3 py-2 font-heading text-xs outline-none"
                />
              </label>

              <label className="mt-3 block">
                <span className="font-heading text-[10px] text-muted-foreground">
                  Evidence link or proof text
                </span>
                <input
                  value={reportProof}
                  onChange={(event) => setReportProof(event.target.value)}
                  placeholder="Screenshot/video URL, transaction note, result proof..."
                  className="arena-focus mt-1 w-full rounded-xl border border-glass-border bg-background px-3 py-2 font-heading text-xs outline-none"
                />
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <NeonButton
                  variant="blue"
                  onClick={() => setReportOpen(false)}
                  disabled={reportLoading}
                >
                  Cancel
                </NeonButton>
                <NeonButton
                  variant="danger"
                  onClick={handleReportCreator}
                  disabled={reportLoading}
                >
                  {reportLoading && (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {reportLoading ? "Submitting..." : "Submit"}
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
};

export default CreatorProfileScreen;
