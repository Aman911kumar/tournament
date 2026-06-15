import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  Crown,
  Edit,
  Gamepad2,
  HelpCircle,
  Lock,
  LogOut,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { logout } from "@/api/auth";
import { becomeCreator, leaveCreator } from "@/api/profile";
import { UserAvatar } from "@/components/identity";
import { CACHE_KEYS, removeCache, removeCacheByPrefix } from "@/lib/offline-cache";
import {
  formatCurrency,
  getErrorMessage,
  getErrorToast,
} from "@/lib/page-utils";
import {
  PROFILE_QUERY_KEY,
  setCurrentProfileCache,
  useCurrentProfile,
} from "@/hooks/useCurrentProfile";
import { clearAuthTokens } from "@/lib/auth-storage";
import {
  EmptyState,
  PageShell,
  SkeletonBlock,
} from "@/components/design-system";
import { prefetchOnIntent, prefetchRoute } from "@/lib/route-prefetch";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Edit, label: "Edit Profile", description: "Avatar, banner, username", route: "/edit-profile" },
  { icon: Trophy, label: "My Tournaments", description: "Joined events", route: "/my-tournaments" },
  { icon: Gamepad2, label: "Game Accounts", description: "Linked IDs", route: "/game-accounts" },
];

const helpMenu = [
  { icon: HelpCircle, label: "Help Center", description: "Support and guides", route: "/help" },
  { icon: ShieldCheck, label: "Legal & Policies", description: "Rules, privacy, safety", route: "/legal/terms" },
];

const creatorMenu = [
  { icon: Crown, label: "Creator Dashboard", description: "Manage hub", route: "/creator-dashboard" },
  { icon: Settings, label: "Channel Setup", description: "Branding", route: "/channel-setup" },
  { icon: BarChart3, label: "Create Tournament", description: "Publish arena", route: "/create-tournament" },
  { icon: Users, label: "My Subscribers", description: "Community", route: "/subscriptions" },
];

const getDisplayPhoneNumber = (phoneNumber?: string) => {
  const value = String(phoneNumber || "").trim();
  if (!value || /^(google|facebook):/i.test(value)) return "";
  return value.startsWith("+") ? value : `+91 ${value}`;
};

type MenuTone = "primary" | "secondary" | "accent" | "danger";

const toneClasses: Record<MenuTone, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  secondary: "border-secondary/25 bg-secondary/10 text-secondary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
};

const ProfileSkeleton = () => (
  <div className="space-y-4">
    <section className="border-b border-border pb-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-16 w-16 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-40 max-w-full" />
          <SkeletonBlock className="h-3 w-28 max-w-full" />
          <SkeletonBlock className="h-6 w-24 max-w-full" />
        </div>
      </div>
    </section>
    <div className="space-y-2">
      {[0, 1, 2, 3].map((item) => (
        <SkeletonBlock key={item} className="h-12" />
      ))}
    </div>
  </div>
);

const MenuRow = ({
  icon: Icon,
  label,
  description,
  tone = "primary",
  disabled = false,
  onClick,
  onPrefetch,
}: {
  icon: typeof Edit;
  label: string;
  description?: string;
  tone?: MenuTone;
  disabled?: boolean;
  onClick?: () => void;
  onPrefetch?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    {...prefetchOnIntent(onPrefetch)}
    disabled={disabled}
    className="arena-focus flex min-h-[50px] w-full items-center justify-between gap-3 bg-transparent px-1 py-2 text-left transition-colors hover:bg-primary/[0.035] disabled:cursor-not-allowed disabled:opacity-60"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md",
          toneClasses[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-heading text-sm font-bold leading-tight",
            tone === "danger" && "text-destructive",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="b4a-soft-copy mt-0.5 block truncate text-[10px] text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </div>
    <ChevronRight
      className={cn(
        "h-4 w-4 shrink-0 text-muted-foreground",
        tone === "danger" && "text-destructive",
      )}
    />
  </button>
);

const MenuSection = ({
  title,
  children,
  danger = false,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <section className="space-y-2">
    <h2
      className={cn(
        "px-1 font-heading text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
        danger && "text-destructive",
      )}
    >
      {title}
    </h2>
    <div className="divide-y divide-border border-y border-border">
      {children}
    </div>
  </section>
);

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const ProfileScreen = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    profile,
    isLoading: profileLoading,
    error: profileLoadError,
    refetch: refetchProfile,
    cacheNotice,
  } = useCurrentProfile();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [leaveCreatorLoading, setLeaveCreatorLoading] = useState(false);
  const passwordStatusRefetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    const profileId = profile?._id ? String(profile._id) : "";
    if (
      !profileId ||
      !profile?.socialProvider ||
      profile.passwordLoginEnabled === true ||
      passwordStatusRefetchedForRef.current === profileId
    ) {
      return;
    }

    passwordStatusRefetchedForRef.current = profileId;
    void refetchProfile();
  }, [
    profile?._id,
    profile?.passwordLoginEnabled,
    profile?.socialProvider,
    refetchProfile,
  ]);

  const profileError = profile
    ? null
    : profileLoadError
      ? getErrorMessage(profileLoadError, "Failed to load profile.")
      : null;

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      const res = await logout();
      toast.success(res.message);
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Logout",
        fallback: "Logout failed.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      clearAuthTokens();
      removeCache(CACHE_KEYS.profile);
      removeCache(CACHE_KEYS.gameAccounts);
      removeCache(CACHE_KEYS.walletSummary);
      queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
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
  const passwordLabel =
    profile?.socialProvider && profile.passwordLoginEnabled !== true
      ? "Set Password"
      : "Change Password";
  const accountMenuItems = [
    menuItems[0],
    ...menuItems.slice(1),
    { icon: Lock, label: "Security", description: passwordLabel, route: "/change-password" },
  ];

  const handleCreatorRequest = async () => {
    if (creatorRequestPending || isCreator) return;

    try {
      setCreatorLoading(true);
      const res = await becomeCreator();
      setCurrentProfileCache(queryClient, res.data.user, res);
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

  const handleLeaveCreator = async () => {
    if (!isCreator || leaveCreatorLoading) return;

    const confirmed = window.confirm(
      "Leave creator access? You will lose creator tools until admin approves access again.",
    );
    if (!confirmed) return;

    try {
      setLeaveCreatorLoading(true);
      const res = await leaveCreator();
      setCurrentProfileCache(queryClient, res.data.user, res);
      removeCacheByPrefix("creatorDashboard.");
      removeCacheByPrefix("creatorProfile.");
      toast.success(res.message || "Creator access removed.");
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Leave creator",
        fallback: "Could not remove creator access.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLeaveCreatorLoading(false);
    }
  };

  const emailVerified = Boolean(profile?.emailVerified ?? profile?.email_verified);
  const phoneVerified = Boolean(profile?.phoneVerified ?? profile?.phone_verified);
  const passwordReady = Boolean(profile?.passwordLoginEnabled || !profile?.socialProvider);
  const onboardingReady = Boolean(
    profile?.onboarding?.completedAt ||
      profile?.legalAgreements?.acceptedAt ||
      profile?.legalAgreements?.termsAcceptedAt,
  );
  const readinessScore = [emailVerified, phoneVerified, passwordReady, onboardingReady].filter(Boolean).length;
  const battleRecordItems = profile
    ? [
        { label: "Email", value: profile.email || "Not set" },
        { label: "Phone", value: getDisplayPhoneNumber(profile.phone_number) || "Not set" },
        { label: "Last login", value: formatDateLabel(profile.lastLoginAt) },
        { label: "Joined", value: formatDateLabel(profile.createdAt) },
        {
          label: "Kills",
          value: profile.stats?.kills ?? 0,
          className: "text-accent",
        },
        {
          label: "Status",
          value: profile.isActive ? "Active" : "Restricted",
          className: profile.isActive ? "text-accent" : "text-destructive",
        },
      ]
    : [];
  const creatorMetricSource = profile as
    | (typeof profile & {
        followerCount?: number;
        followersCount?: number;
        memberCount?: number;
      })
    | null;
  const creatorFollowers = Number(
    creatorMetricSource?.followerCount ??
      creatorMetricSource?.followersCount ??
      creatorMetricSource?.memberCount ??
      0,
  );
  const tournamentCount =
    Number(
      profile?.stats?.tournamentsPlayed ??
        profile?.stats?.matchesPlayed ??
        0,
    ) || 0;

  return (
    <PageShell contentClassName="max-w-3xl space-y-4 pb-6">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-3 pt-1">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-black leading-tight text-primary">
            Profile
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Identity and account
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetchProfile()}
          className="arena-focus grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card/45 text-muted-foreground transition-colors hover:bg-card/75 hover:text-foreground"
          aria-label="Refresh profile"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </header>

      {profileLoading ? (
        <ProfileSkeleton />
      ) : profileError ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load profile"
          description={profileError}
          action={
            <button
              type="button"
              onClick={() => refetchProfile()}
              className="arena-focus inline-flex items-center gap-2 rounded-xl border border-primary/25 px-3 py-2 font-heading text-xs font-bold text-primary"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          }
        />
      ) : profile ? (
        <section className="border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <UserAvatar user={profile} size="lg" priority />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 pr-1">
                <h2 className="truncate font-display text-lg font-black leading-tight sm:text-xl">
                  {profile.username}
                </h2>
                {isCreator && (
                  <span className="shrink-0 rounded-sm bg-secondary/10 px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase text-secondary">
                    Creator
                  </span>
                )}
                {profile.role?.includes("admin") && (
                  <span className="shrink-0 rounded-sm bg-accent/10 px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase text-accent">
                    Admin
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                @{profile.username}
              </p>
              {cacheNotice && (
                <p className="mt-1 truncate text-[10px] font-heading text-secondary" title={cacheNotice}>
                  {cacheNotice}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate("/edit-profile")}
              {...prefetchOnIntent(() => prefetchRoute("/edit-profile"))}
              className="arena-focus inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md bg-card/45 px-2.5 font-heading text-[10px] font-bold uppercase text-foreground transition-colors hover:bg-card/75"
            >
              <Edit className="h-3.5 w-3.5" />
              <span className="hidden min-[380px]:inline">Edit Visuals</span>
              <span className="min-[380px]:hidden">Edit</span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">
                Balance
              </p>
              <p className="mt-0.5 font-display text-2xl font-black leading-none text-accent">
                {formatCurrency(profile.walletBalance ?? 0)}
              </p>
            </div>
            {isCreator && (
              <>
                <div>
                  <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">
                    Followers
                  </p>
                  <p className="mt-0.5 font-heading text-sm font-black">
                    {creatorFollowers.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">
                    Tournaments
                  </p>
                  <p className="mt-0.5 font-heading text-sm font-black">
                    {tournamentCount}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={AlertCircle}
          title="No saved profile data"
          description="Connect once to save your profile for offline use."
        />
      )}

      {profile && (
        <>
          {readinessScore < 4 && (
            <div className="flex items-center justify-between gap-3 border-b border-primary/10 pb-3">
              <div className="min-w-0">
                <p className="font-heading text-xs font-bold text-primary">
                  Setup {readinessScore}/4 ready
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  Finish recovery and security setup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/edit-profile")}
                className="arena-focus min-h-9 shrink-0 rounded-md bg-primary px-3 font-heading text-[10px] font-bold text-primary-foreground"
              >
                Fix
              </button>
            </div>
          )}

          <MenuSection title="Account">
            {accountMenuItems.map((item) => (
              <MenuRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                description={item.description}
                tone="primary"
                onClick={() => navigate(item.route)}
                onPrefetch={() => prefetchRoute(item.route)}
              />
            ))}
          </MenuSection>

          <MenuSection title={isCreator ? "Creator Tools" : "Creator Access"}>
            {isCreator ? (
              creatorMenu.map((item) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  tone="secondary"
                  onClick={() => navigate(item.route)}
                  onPrefetch={() => prefetchRoute(item.route)}
                />
              ))
            ) : (
              <MenuRow
                icon={UserPlus}
                label={
                  creatorLoading
                    ? "Updating..."
                    : creatorRequestPending
                      ? "Creator Request Pending"
                      : "Request Creator Access"
                }
                description={
                  creatorRequestPending
                    ? "Waiting for admin approval"
                    : "Host tournaments and manage players"
                }
                tone="secondary"
                disabled={creatorLoading || creatorRequestPending}
                onClick={handleCreatorRequest}
              />
            )}
          </MenuSection>

          {adminMenu.length > 0 && (
            <MenuSection title="Admin">
              {adminMenu.map((item) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  description="Platform operations"
                  tone="accent"
                  onClick={() => navigate(item.route)}
                  onPrefetch={() => prefetchRoute(item.route)}
                />
              ))}
            </MenuSection>
          )}

          <details className="group border-y border-border">
            <summary className="arena-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2.5">
              <span className="font-heading text-xs font-black">Profile Details</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="divide-y divide-border pb-1">
              {battleRecordItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "min-w-0 truncate text-right font-heading text-xs font-bold",
                      item.className,
                    )}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </details>

          <details className="group border-b border-border">
            <summary className="arena-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2.5">
              <span className="font-heading text-xs font-black">Support & Legal</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="divide-y divide-border pb-1">
              {helpMenu.map((item) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  tone="secondary"
                  onClick={() => navigate(item.route)}
                  onPrefetch={() => prefetchRoute(item.route)}
                />
              ))}
            </div>
          </details>

          <MenuSection title="Critical" danger>
            {isCreator && (
              <MenuRow
                icon={UserMinus}
                label={leaveCreatorLoading ? "Leaving Creator..." : "Leave Creator"}
                description="Remove creator tools from this account"
                tone="danger"
                disabled={leaveCreatorLoading}
                onClick={handleLeaveCreator}
              />
            )}
            <MenuRow
              icon={LogOut}
              label={logoutLoading ? "Logging out..." : "Logout"}
              description="End this session on this device"
              tone="danger"
              disabled={logoutLoading}
              onClick={handleLogout}
            />
          </MenuSection>
        </>
      )}
    </PageShell>
  );
};

export default ProfileScreen;
