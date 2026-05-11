import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  Crown,
  Edit,
  FileText,
  Gamepad2,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  Phone,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { toast } from "@/components/ui/sonner";
import { logout } from "@/api/auth";
import { becomeCreator, getMyProfile, leaveCreator, User as ProfileUser } from "@/api/profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  removeCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorMessage, getErrorToast } from "@/lib/page-utils";
import { signOutClerkSession } from "@/lib/clerk-session";

const menuItems = [
  { icon: Edit, label: "Edit Profile", route: "/edit-profile" },
  { icon: Trophy, label: "My Tournaments", route: "/my-tournaments" },
  { icon: Gamepad2, label: "Game Accounts", route: "/game-accounts" },
];

const helpMenu = [
  { icon: HelpCircle, label: "Help Center", route: "/help" },
  { icon: ShieldCheck, label: "Rules & Regulations", route: "/rules" },
  { icon: FileText, label: "Privacy Policy", route: "/privacy" },
];

const creatorMenu = [
  { icon: Crown, label: "Creator Dashboard", route: "/creator-dashboard" },
  { icon: Settings, label: "Channel Setup", route: "/channel-setup" },
  { icon: BarChart3, label: "Create Tournament", route: "/create-tournament" },
  { icon: Users, label: "My Subscribers", route: "/subscriptions" },
];

const LEAVE_CREATOR_CONFIRM_TEXT = "Leave create";

const getDisplayPhoneNumber = (phoneNumber?: string) => {
  const value = String(phoneNumber || "").trim();
  if (!value || /^(google|facebook):/i.test(value)) return "";
  return value.startsWith("+") ? value : `+91 ${value}`;
};

const getDisplayName = (profile: ProfileUser) =>
  [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || profile.username;

const ProfileSkeleton = () => (
  <GlassCard neon className="flex flex-col items-center text-center">
    <div className="w-20 h-20 rounded-full bg-muted animate-pulse mb-3" />
    <div className="h-4 w-32 bg-muted rounded animate-pulse mb-3" />
    <div className="h-3 w-48 max-w-full bg-muted rounded animate-pulse mb-2" />
    <div className="h-3 w-36 bg-muted rounded animate-pulse mb-4" />
    <div className="grid grid-cols-3 gap-3 w-full">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-12 glass rounded-lg animate-pulse" />
      ))}
    </div>
  </GlassCard>
);

const ProfileScreen = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveUsernameInput, setLeaveUsernameInput] = useState("");
  const [leavePhraseInput, setLeavePhraseInput] = useState("");

  const stats = [
    { label: "Balance", value: formatCurrency(profile?.walletBalance ?? 0) },
    { label: "Won", value: formatCurrency(profile?.stats?.amount_won ?? profile?.playerEarnings ?? 0) },
    { label: "Tournaments", value: profile?.stats?.tournamentsPlayed ?? profile?.stats?.matchesPlayed ?? 0 },
  ];

  const fetchProfile = useCallback(async () => {
    const cachedProfile = readCache<ProfileUser>(CACHE_KEYS.profile);

    try {
      setProfileLoading(true);
      setProfileError(null);
      if (cachedProfile) {
        setProfile(cachedProfile.data);
        setCacheNotice(getSavedDataLabel(cachedProfile.savedAt));
      }

      const res = await getMyProfile();
      const user = res.data.user;
      setProfile(user);
      setCacheNotice(null);
      writeAuthenticatedCache(CACHE_KEYS.profile, user, res);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to load profile.");
      if (cachedProfile) {
        setProfile(cachedProfile.data);
        setProfileError(null);
        const notice = getSavedDataNotice(cachedProfile.savedAt, error);
        setCacheNotice(notice);
        toast.info("Showing saved profile data.", { description: notice });
      } else {
        setProfileError(message);
        const errorToast = getErrorToast(error, { action: "Load profile", fallback: "Failed to load profile." });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      const res = await logout();
      toast.success(res.message);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Logout", fallback: "Logout failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      await signOutClerkSession();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      removeCache(CACHE_KEYS.profile);
      removeCache(CACHE_KEYS.gameAccounts);
      removeCache(CACHE_KEYS.walletSummary);
      setLogoutLoading(false);
      navigate("/login");
    }
  };

  const adminMenu = profile?.role?.includes("admin")
    ? [{ icon: ShieldCheck, label: "Admin Panel", route: "/admin" }]
    : [];
  const isCreator = Boolean(profile?.role?.includes("creator"));
  const creatorRequestStatus = profile?.creatorRequest?.status ?? "none";
  const creatorRequestPending = creatorRequestStatus === "pending";
  const passwordLabel = profile?.socialProvider && profile.passwordLoginEnabled !== true ? "Set Password" : "Change Password";
  const accountMenuItems = [
    menuItems[0],
    { icon: Lock, label: passwordLabel, route: "/change-password" },
    ...menuItems.slice(1),
  ];

  const handleCreatorRequest = async () => {
    if (creatorRequestPending || isCreator) return;

    try {
      setCreatorLoading(true);
      const res = await becomeCreator();
      setProfile(res.data.user);
      writeAuthenticatedCache(CACHE_KEYS.profile, res.data.user, res);
      toast.success(res.message);
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Become creator",
        fallback: "Could not request creator access.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setCreatorLoading(false);
    }
  };

  const resetLeaveDialog = () => {
    setLeaveUsernameInput("");
    setLeavePhraseInput("");
  };

  const handleLeaveCreator = async () => {
    if (!profile || leaveUsernameInput.trim() !== profile.username || leavePhraseInput.trim() !== LEAVE_CREATOR_CONFIRM_TEXT) {
      toast.error("Confirmation does not match.", {
        description: `Type your username and "${LEAVE_CREATOR_CONFIRM_TEXT}" to continue.`,
      });
      return;
    }

    try {
      setCreatorLoading(true);
      const res = await leaveCreator();
      setProfile(res.data.user);
      writeAuthenticatedCache(CACHE_KEYS.profile, res.data.user, res);
      toast.success(res.message);
      setLeaveDialogOpen(false);
      resetLeaveDialog();
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Leave creator mode",
        fallback: "Could not leave creator mode.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setCreatorLoading(false);
    }
  };

  const leaveCreatorConfirmReady = Boolean(profile)
    && leaveUsernameInput.trim() === profile.username
    && leavePhraseInput.trim() === LEAVE_CREATOR_CONFIRM_TEXT;

  return (
    <div className="arena-shell min-h-screen pb-20">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 pt-6 pb-4">
        <h1 className="font-heading text-xl font-bold">Profile</h1>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mb-6">
        {profileLoading ? (
          <ProfileSkeleton />
        ) : profileError ? (
          <GlassCard className="text-center py-8">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load profile</p>
            <p className="text-xs text-muted-foreground mt-1 break-words">{profileError}</p>
            <button
              type="button"
              onClick={fetchProfile}
              className="mt-4 inline-flex items-center gap-2 text-xs font-heading text-primary"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </GlassCard>
        ) : profile ? (
          <GlassCard neon className="flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-28 h-28 bg-primary/10 rounded-full blur-xl" />
            {cacheNotice && (
              <span className="relative z-10 mb-4 max-w-full rounded-full bg-secondary/10 px-3 py-1.5 text-center text-[10px] font-heading leading-snug text-secondary sm:max-w-[90%]" title={cacheNotice}>
                {cacheNotice}
              </span>
            )}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative z-10 w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-3 neon-glow-purple overflow-hidden"
            >
              {profile.avatar?.url ? (
                <img
                  src={profile.avatar.url}
                  alt={profile.username}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-8 h-8 text-primary-foreground" />
              )}
            </motion.div>
            <h2 className="font-heading text-lg font-bold max-w-full truncate">{getDisplayName(profile)}</h2>
            {getDisplayName(profile) !== profile.username && (
              <p className="mb-1 max-w-full truncate text-[11px] text-muted-foreground">@{profile.username}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 max-w-full">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
            {getDisplayPhoneNumber(profile.phone_number) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4 max-w-full">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{getDisplayPhoneNumber(profile.phone_number)}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 w-full">
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-lg py-2 px-1 min-w-0">
                  <p className="font-display text-xs sm:text-sm font-bold text-primary truncate">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-heading">{s.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="text-center py-8">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No saved profile data</p>
            <p className="text-xs text-muted-foreground mt-1">Connect once to save your profile for offline use.</p>
          </GlassCard>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mb-2">
        <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Creator Tools
        </h2>
        <div className="space-y-2">
          {!isCreator && (
            <GlassCard
              className={`flex items-center justify-between ${creatorRequestPending ? "opacity-75" : "cursor-pointer"}`}
              onClick={handleCreatorRequest}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-sm font-heading font-medium truncate block">
                    {creatorLoading ? "Updating..." : creatorRequestPending ? "Creator Request Pending" : "Request Creator Access"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {creatorRequestPending ? "Admin approval is required before creating tournaments" : "Admin approval is required"}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </GlassCard>
          )}

          {isCreator &&
            creatorMenu.map((item, i) => (
              <GlassCard
                key={item.label}
                delay={i * 0.06}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => navigate(item.route)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-secondary" />
                  </div>
                  <span className="text-sm font-heading font-medium truncate">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </GlassCard>
            ))}
        </div>
      </div>

      {adminMenu.length > 0 && (
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mb-2 mt-4">
          <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Admin
          </h2>
          <div className="space-y-2">
            {adminMenu.map((item) => (
              <GlassCard
                key={item.label}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => navigate(item.route)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-sm font-heading font-medium truncate">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mt-4">
        <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Account
        </h2>
        <div className="space-y-2">
          {accountMenuItems.map((item, i) => (
            <GlassCard
              key={item.label}
              delay={i * 0.06}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => navigate(item.route)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-heading font-medium truncate">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mt-4">
        <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Help & Legal
        </h2>
        <div className="space-y-2">
          {helpMenu.map((item) => (
            <GlassCard
              key={item.label}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => navigate(item.route)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-secondary" />
                </div>
                <span className="text-sm font-heading font-medium truncate">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mt-8 pb-4">
        <h2 className="font-heading text-xs font-bold text-destructive mb-2 uppercase tracking-wider">
          Critical Section
        </h2>
        <div className="space-y-2">
          {isCreator && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setLeaveDialogOpen(true)}
              disabled={creatorLoading}
              className="w-full glass rounded-xl p-4 flex items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 disabled:opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <UserMinus className="w-4 h-4 text-destructive" />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-sm font-heading font-medium text-destructive truncate block">
                    Leave Creator
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Removes creator access after confirmation
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-destructive shrink-0" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full glass rounded-xl p-4 flex items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 disabled:opacity-60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-destructive" />
              </div>
              <span className="text-sm font-heading font-medium text-destructive">
                {logoutLoading ? "Logging out..." : "Logout"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-destructive shrink-0" />
          </motion.button>
        </div>
      </div>

      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          setLeaveDialogOpen(open);
          if (!open) resetLeaveDialog();
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg border-destructive/30 bg-card/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive">Leave Creator</DialogTitle>
            <DialogDescription>
              This removes creator access from your account. Existing platform records remain saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-heading text-muted-foreground">
                Type your username
              </label>
              <input
                type="text"
                value={leaveUsernameInput}
                onChange={(event) => setLeaveUsernameInput(event.target.value)}
                placeholder={profile?.username || "username"}
                className="w-full rounded-lg border border-glass-border bg-transparent px-3 py-2.5 text-sm font-heading focus:border-destructive focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-heading text-muted-foreground">
                Type "{LEAVE_CREATOR_CONFIRM_TEXT}"
              </label>
              <input
                type="text"
                value={leavePhraseInput}
                onChange={(event) => setLeavePhraseInput(event.target.value)}
                placeholder={LEAVE_CREATOR_CONFIRM_TEXT}
                className="w-full rounded-lg border border-glass-border bg-transparent px-3 py-2.5 text-sm font-heading focus:border-destructive focus:outline-none"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLeaveDialogOpen(false)}
                disabled={creatorLoading}
                className="rounded-lg border border-glass-border px-4 py-2 text-sm font-heading text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveCreator}
                disabled={!leaveCreatorConfirmReady || creatorLoading}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-heading text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatorLoading ? "Leaving..." : "Leave Creator"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ProfileScreen;
