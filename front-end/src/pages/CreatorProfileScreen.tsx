import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Flag,
  LoaderCircle,
  MessageCircle,
  RefreshCcw,
  Shield,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { followCreator, getCreatorProfile, rateCreator, unfollowCreator, CreatorProfileData } from "@/api/creators";
import { getMyProfile } from "@/api/profile";
import { Tournament } from "@/api/tournaments";
import { toast } from "@/components/ui/sonner";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getErrorToast } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/offline-cache";
import { createReport } from "@/api/moderation";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const statusClass: Record<Tournament["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-accent/20 text-accent",
  running: "bg-destructive/20 text-destructive",
  completed: "bg-secondary/20 text-secondary",
  cancelled: "bg-muted text-muted-foreground",
};

const ratingSteps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const normalizeRatingValue = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(numeric * 2) / 2));
};

const getRatingDraftValue = (profile?: CreatorProfileData | null) => {
  const ownRating = normalizeRatingValue(profile?.viewer?.myRating);
  const averageRating = normalizeRatingValue((profile?.creator ?? profile?.channel?.owner)?.stats?.rating);
  return ownRating ?? averageRating ?? 4;
};

const stripViewerState = (profile: CreatorProfileData): CreatorProfileData => ({
  ...profile,
  viewer: undefined,
});

const RatingStars = ({ value, className = "h-4 w-4" }: { value: number; className?: string }) => (
  <div className="flex items-center gap-1" aria-label={`${Number(value || 0).toFixed(1)} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => {
      const fillPercent = Math.max(0, Math.min(1, Number(value || 0) - (star - 1))) * 100;
      return (
        <span key={star} className={`relative inline-flex ${className}`}>
          <Star className={`${className} text-muted-foreground/35`} />
          <span className="absolute inset-0 overflow-hidden text-accent" style={{ width: `${fillPercent}%` }}>
            <Star className={`${className} fill-accent text-accent`} />
          </span>
        </span>
      );
    })}
  </div>
);

const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-lg bg-muted/70 ${className}`} />
);

const CreatorProfileSkeleton = () => (
  <div className="space-y-4">
    <div className="relative overflow-hidden rounded-xl">
      <SkeletonBlock className="h-28 w-full" />
      <div className="absolute -bottom-8 left-4">
        <SkeletonBlock className="h-20 w-20 rounded-full border-4 border-background" />
      </div>
    </div>
    <div className="pt-8 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-44 max-w-full" />
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-3 w-full max-w-md" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((item) => (
          <SkeletonBlock key={item} className="h-14" />
        ))}
      </div>
      <SkeletonBlock className="h-10 w-full" />
      <GlassCard>
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-10 w-full" />
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
            {ratingSteps.map((value) => (
              <SkeletonBlock key={value} className="h-8" />
            ))}
          </div>
        </div>
      </GlassCard>
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-28 rounded-full" />
        <SkeletonBlock className="h-8 w-20 rounded-full" />
      </div>
      {[0, 1].map((item) => (
        <GlassCard key={item}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-48 max-w-full" />
              <SkeletonBlock className="h-3 w-36" />
            </div>
            <SkeletonBlock className="h-8 w-20" />
          </div>
        </GlassCard>
      ))}
    </div>
  </div>
);

const CreatorProfileScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<"tournaments" | "about">("tournaments");

  const applyProfileData = useCallback((nextProfile: CreatorProfileData) => {
    setProfile(nextProfile);
    setIsFollowing(Boolean(nextProfile.viewer?.isFollowing));
    setMyRating(normalizeRatingValue(nextProfile.viewer?.myRating));
    setDraftRating(getRatingDraftValue(nextProfile));
  }, []);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    const cachedProfile = readCache<CreatorProfileData>(CACHE_KEYS.creatorProfile(id));
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
      if (!cachedProfile) setError(getErrorMessage(loadError, "Failed to load creator profile."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProfileData, id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((res) => {
        if (active) setCurrentUserId(res.data.user._id);
      })
      .catch(() => {
        if (active) setCurrentUserId(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const channel = profile?.channel;
  const creator = profile?.creator ?? channel?.owner;
  const displayName = channel?.name ?? creator?.username ?? "Creator";
  const handle = channel?.handle ? `@${channel.handle}` : creator?.username ? `@${creator.username}` : "";
  const description = channel?.description || "Tournament creator";
  const rating = Number(creator?.stats?.rating || 0);
  const ratingCount = Number(creator?.stats?.ratingCount || 0);
  const totalPrize = Number(profile?.totalPrize || 0);
  const tournaments = useMemo(() => profile?.tournaments ?? [], [profile]);
  const canFollow = Boolean(channel?._id && !channel.virtual);
  const isVerifiedCreator = Boolean(creator?.role?.includes("creator") || channel?._id);
  const isOwnCreatorProfile = Boolean(currentUserId && creator?._id === currentUserId);

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
          memberCount: Math.max(0, Number(current.channel.memberCount || 0) + (nextFollowing ? 1 : -1)),
        },
      };
    });

    try {
      setFollowLoading(true);
      const res = nextFollowing ? await followCreator(channel._id) : await unfollowCreator(channel._id);
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
      const res = await rateCreator(targetId, normalizedRating, channel?._id ? "channel" : "user");
      const updatedCreator = res.data.creator;
      setProfile((current) => current ? {
        ...current,
        viewer: { ...(current.viewer ?? {}), myRating: normalizedRating },
        creator: current.creator?._id === updatedCreator._id ? updatedCreator : current.creator,
        channel: current.channel ? { ...current.channel, owner: updatedCreator } : current.channel,
      } : current);
      setMyRating(normalizedRating);
      setDraftRating(normalizedRating);
      toast.success("Rating saved", { description: `You rated ${displayName} ${normalizedRating.toFixed(1)}/5.` });
    } catch (rateError) {
      const errorToast = getErrorToast(rateError, { action: "Rate creator", fallback: "Could not save rating." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleReportCreator = async () => {
    if (!creator?._id) return;
    if (reportDescription.trim().length < 12) {
      toast.error("Add more details", { description: "Tell admin what payout or creator issue happened." });
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
      toast.success("Creator report submitted", { description: "Admin will review the payout dispute." });
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

  const renderRatingCard = (compact = false) => (
    <div className={`rounded-lg border border-glass-border bg-card/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-heading font-bold">Rate this creator</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RatingStars value={rating} className="h-3.5 w-3.5" />
            <span className="text-[10px] text-muted-foreground">
              Average {rating.toFixed(1)} from {ratingCount} rating{ratingCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {myRating ? (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] font-heading font-semibold text-accent">
            {myRating.toFixed(1)}/5
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-glass-border bg-background/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-heading text-muted-foreground">{ratingStatusText}</span>
          <span className="text-sm font-heading font-bold text-accent">{draftRating.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={draftRating}
          onChange={(event) => setDraftRating(Number(event.target.value))}
          disabled={!canSubmitRating || ratingLoading}
          className="mt-3 w-full accent-[hsl(var(--accent))] disabled:opacity-50"
          aria-label="Select creator rating"
        />
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-9">
          {ratingSteps.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDraftRating(value)}
              disabled={!canSubmitRating || ratingLoading}
              className={`rounded-md border px-1.5 py-1.5 text-[10px] font-heading transition-colors disabled:opacity-50 ${
                draftRating === value
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-glass-border text-muted-foreground hover:border-accent/50 hover:text-accent"
              }`}
            >
              {value.toFixed(1)}
            </button>
          ))}
        </div>
        {!currentUserId && (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-3 w-full rounded-lg border border-primary/30 px-3 py-2 text-xs font-heading font-semibold text-primary transition-colors hover:bg-primary/10"
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
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-heading font-bold text-accent-foreground shadow-[0_0_18px_hsl(var(--accent)/0.25)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ratingLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            {ratingLoading ? "Saving rating..." : myRating === draftRating ? "Rating saved" : "Save rating"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Creator Profile</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        {loading && <CreatorProfileSkeleton />}

        {!loading && refreshing && profile && (
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-heading text-primary">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            Refreshing creator
          </div>
        )}

        {!loading && error && (
          <GlassCard className="text-center py-8">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load creator</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button onClick={loadProfile} className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-heading">
              <RefreshCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && profile && (
          <>
            <div className="relative rounded-xl overflow-hidden">
              {channel?.banner?.url ? (
                <img src={channel.banner.url} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 gradient-neon opacity-70" />
              )}
              <div className="absolute -bottom-8 left-4">
                <div className="relative">
                  {channel?.avatar?.url || creator?.avatar?.url ? (
                    <img
                      src={channel?.avatar?.url ?? creator?.avatar?.url}
                      alt=""
                      className="w-20 h-20 rounded-full object-cover border-4 border-background neon-glow-purple"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center border-4 border-background neon-glow-purple">
                      <span className="font-display text-2xl font-bold text-primary-foreground">{displayName[0]}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full border-2 border-background bg-accent flex items-center justify-center">
                    <Shield className="w-3 h-3 text-accent-foreground fill-accent-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-heading text-lg font-bold truncate">{displayName}</h2>
                    {isVerifiedCreator && (
                      <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-heading font-semibold text-accent">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-primary font-heading">{handle}</p>
                  <p className="text-xs text-muted-foreground font-body mt-1 max-w-md">{description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setReportOpen(true)} className="w-8 h-8 glass rounded-full flex items-center justify-center" title="Report creator">
                    <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button className="w-8 h-8 glass rounded-full flex items-center justify-center" title="Message creator">
                    <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: "Followers", value: (channel?.memberCount ?? 0).toLocaleString("en-IN") },
                  { label: "Events", value: String(profile.tournamentCount) },
                  { label: "Prize", value: formatCurrency(totalPrize) },
                  { label: "Rating", value: rating.toFixed(1) },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="glass rounded-lg p-2 text-center min-w-0"
                  >
                    <p className="text-xs font-heading font-bold text-foreground truncate">{item.value}</p>
                    <p className="text-[9px] text-muted-foreground">{item.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {canFollow ? (
                  <NeonButton
                    full
                    variant={isFollowing ? "blue" : "purple"}
                    className="text-xs py-2.5"
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {followLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                      {followLoading ? "UPDATING..." : isFollowing ? "FOLLOWING" : "FOLLOW CREATOR"}
                    </span>
                  </NeonButton>
                ) : (
                  <div className="rounded-lg border border-secondary/20 bg-secondary/10 px-3 py-2 text-center">
                    <p className="text-xs font-heading text-secondary">Creator approved</p>
                    <p className="text-[10px] text-muted-foreground">Channel setup is pending, but ratings and tournaments are available.</p>
                    {isOwnCreatorProfile && (
                      <button
                        type="button"
                        onClick={() => navigate("/channel-setup")}
                        className="mt-2 rounded-lg border border-secondary/30 px-3 py-1.5 text-[10px] font-heading font-semibold text-secondary transition-colors hover:bg-secondary/10"
                      >
                        Setup Channel
                      </button>
                    )}
                  </div>
                )}
                {renderRatingCard()}
              </div>
            </div>

            <div className="flex gap-2">
              {(["tournaments", "about"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-heading font-medium capitalize transition-colors ${
                    activeTab === tab ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "tournaments" && (
              <div className="space-y-3">
                {tournaments.length === 0 ? (
                  <GlassCard className="text-center py-8">
                    <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-heading">No tournaments yet</p>
                    <p className="text-xs text-muted-foreground mt-1">This creator has not published an event.</p>
                  </GlassCard>
                ) : (
                  tournaments.map((tournament, index) => (
                    <GlassCard key={tournament._id} neon delay={index * 0.06} onClick={() => navigate(`/tournament/${tournament._id}`)} className="cursor-pointer">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-sm truncate">{tournament.title}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            {gameLabels[tournament.game] ?? tournament.game} - {new Date(tournament.startAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-heading font-bold text-accent">{formatPrizeSummary(tournament)}</p>
                          <span className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full ${statusClass[tournament.status]}`}>
                            {tournament.status}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                )}
              </div>
            )}

            {activeTab === "about" && (
              <GlassCard>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <RatingStars value={rating} />
                    <p className="text-sm font-heading font-bold">{rating.toFixed(1)} creator rating</p>
                  </div>
                  {renderRatingCard(true)}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-secondary" />
                    <p className="text-sm font-heading">{(channel?.memberCount ?? 0).toLocaleString("en-IN")} followers</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-body">{description}</p>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass w-full max-w-md rounded-2xl border border-glass-border p-5"
            >
              <h3 className="font-heading text-lg font-bold">Report creator</h3>
              <p className="mt-1 text-xs text-muted-foreground">Use this for missing prize distribution, wrong payout, or creator misconduct.</p>

              <label className="mt-4 block">
                <span className="text-[10px] font-heading text-muted-foreground">Details</span>
                <textarea
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  rows={4}
                  placeholder="Mention tournament name, amount, date, and what was promised..."
                  className="mt-1 w-full resize-none rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading outline-none"
                />
              </label>

              <label className="mt-3 block">
                <span className="text-[10px] font-heading text-muted-foreground">Evidence link or proof text</span>
                <input
                  value={reportProof}
                  onChange={(event) => setReportProof(event.target.value)}
                  placeholder="Screenshot/video URL, transaction note, result proof..."
                  className="mt-1 w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading outline-none"
                />
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <NeonButton variant="blue" onClick={() => setReportOpen(false)} disabled={reportLoading}>Cancel</NeonButton>
                <NeonButton variant="purple" onClick={handleReportCreator} disabled={reportLoading}>
                  {reportLoading && <LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />}
                  {reportLoading ? "Submitting..." : "Submit"}
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default CreatorProfileScreen;
