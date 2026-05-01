import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  Crown,
  Edit,
  Gamepad2,
  Lock,
  LogOut,
  Mail,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Trophy,
  User,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import BottomNav from "@/components/BottomNav";
import { toast } from "@/components/ui/sonner";
import { logout } from "@/api/auth";
import { getMyProfile, User as ProfileUser } from "@/api/profile";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  removeCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorMessage, getErrorToast } from "@/lib/page-utils";

const menuItems = [
  { icon: Edit, label: "Edit Profile", route: "/edit-profile" },
  { icon: Lock, label: "Change Password", route: "/change-password" },
  { icon: Trophy, label: "My Tournaments", route: "/tournaments" },
  { icon: Gamepad2, label: "Game Accounts", route: "/game-accounts" },
];

const creatorMenu = [
  { icon: Crown, label: "Creator Dashboard", route: "/creator-dashboard" },
  { icon: BarChart3, label: "Create Tournament", route: "/create-tournament" },
  { icon: Users, label: "My Subscribers", route: "/subscriptions" },
];

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

  const stats = [
    { label: "Matches", value: profile?.stats.matchesPlayed ?? 0 },
    { label: "Balance", value: formatCurrency(profile?.walletBalance ?? 0) },
    { label: "Won", value: formatCurrency(profile?.stats.amount_won ?? 0) },
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4">
        <h1 className="font-heading text-xl font-bold">Profile</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
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
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            {cacheNotice && (
              <span className="relative z-10 mb-4 max-w-full rounded-full bg-secondary/10 px-3 py-1.5 text-center text-[10px] font-heading leading-snug text-secondary sm:max-w-[90%]" title={cacheNotice}>
                {cacheNotice}
              </span>
            )}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative z-10 w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-3 neon-glow-purple"
            >
              <User className="w-8 h-8 text-primary-foreground" />
            </motion.div>
            <h2 className="font-heading text-lg font-bold max-w-full truncate">{profile.username}</h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 max-w-full">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <Phone className="w-3 h-3" />+91 {profile.phone_number}
            </div>

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

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-2">
        <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Creator Tools
        </h2>
        <div className="space-y-2">
          {creatorMenu.map((item, i) => (
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
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-2 mt-4">
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

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mt-4">
        <h2 className="font-heading text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Account
        </h2>
        <div className="space-y-2">
          {menuItems.map((item, i) => (
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

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full glass rounded-xl p-4 flex items-center gap-3 mt-2 border border-destructive/20 disabled:opacity-60"
          >
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-destructive" />
            </div>
            <span className="text-sm font-heading font-medium text-destructive">
              {logoutLoading ? "Logging out..." : "Logout"}
            </span>
          </motion.button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfileScreen;
