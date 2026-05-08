import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Flag,
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
import { createSupportTicket } from "@/api/support";

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

const CreatorProfileScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportProof, setReportProof] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tournaments" | "about">("tournaments");

  const loadProfile = useCallback(async () => {
    if (!id) return;
    const cachedProfile = readCache<CreatorProfileData>(CACHE_KEYS.creatorProfile(id));
    if (cachedProfile) {
      setProfile(cachedProfile.data);
      setLoading(false);
    }

    try {
      setLoading(!cachedProfile);
      setError(null);
      const nextProfile = await getCreatorProfile(id);
      setProfile(nextProfile);
      writeCache(CACHE_KEYS.creatorProfile(id), nextProfile);
    } catch (loadError) {
      if (!cachedProfile) setError(getErrorMessage(loadError, "Failed to load creator profile."));
    } finally {
      setLoading(false);
    }
  }, [id]);

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

    try {
      setFollowLoading(true);
      const res = isFollowing ? await unfollowCreator(channel._id) : await followCreator(channel._id);
      setIsFollowing(!isFollowing);
      toast.success(res.message);
    } catch (followError) {
      const errorToast = getErrorToast(followError, {
        action: isFollowing ? "Unfollow creator" : "Follow creator",
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

    try {
      setRatingLoading(true);
      const res = await rateCreator(targetId, value, channel?._id ? "channel" : "user");
      const updatedCreator = res.data.creator;
      setProfile((current) => current ? {
        ...current,
        creator: current.creator?._id === updatedCreator._id ? updatedCreator : current.creator,
        channel: current.channel ? { ...current.channel, owner: updatedCreator } : current.channel,
      } : current);
      toast.success("Rating saved", { description: `You rated ${displayName} ${value}/5.` });
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
      await createSupportTicket({
        title: `Creator report: ${displayName}`,
        description: reportDescription.trim(),
        type: "dispute",
        reason: "payout_not_distributed",
        targetUser: creator._id,
        evidence: { matchProof: reportProof.trim() },
        priority: "high",
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Creator Profile</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        {loading && (
          <GlassCard neon>
            <div className="animate-pulse space-y-4">
              <div className="h-28 rounded-lg bg-muted" />
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="h-3 w-64 max-w-full rounded bg-muted" />
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-14 rounded-lg bg-muted" />
                ))}
              </div>
            </div>
          </GlassCard>
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
                    {followLoading ? "UPDATING..." : isFollowing ? "FOLLOWING" : "FOLLOW CREATOR"}
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
                <div className="rounded-lg border border-glass-border bg-card/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-heading font-bold">Rate this creator</p>
                    <span className="text-[10px] text-muted-foreground">{ratingCount} rating{ratingCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleRate(value)}
                        disabled={ratingLoading}
                        className={`flex h-9 items-center justify-center rounded-lg border text-xs font-heading transition-colors disabled:opacity-50 ${
                          value <= Math.round(rating)
                            ? "border-accent/40 bg-accent/15 text-accent"
                            : "border-glass-border text-muted-foreground"
                        }`}
                        aria-label={`Rate ${value} out of 5`}
                      >
                        <Star className={`h-3.5 w-3.5 ${value <= Math.round(rating) ? "fill-accent" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>
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
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <p className="text-sm font-heading font-bold">{rating.toFixed(1)} creator rating</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleRate(value)}
                        disabled={ratingLoading}
                        className="rounded-lg border border-glass-border px-2 py-1 text-xs font-heading text-accent disabled:opacity-50"
                      >
                        {value}
                      </button>
                    ))}
                    <span className="self-center text-[10px] text-muted-foreground">{ratingCount} rating{ratingCount === 1 ? "" : "s"}</span>
                  </div>
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
