import { useState } from "react";
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
import { ProfileHero } from "@/components/identity";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CACHE_KEYS, removeCache } from "@/lib/offline-cache";
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
import {
  EmptyState,
  PageHeader,
  PageShell,
  SkeletonBlock,
  StatusPill,
  Surface,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import UiPreferencesPanel from "@/components/UiPreferencesPanel";

const menuItems = [
  { icon: Edit, label: "Edit Profile", route: "/edit-profile" },
  { icon: Trophy, label: "My Tournaments", route: "/my-tournaments" },
  { icon: Gamepad2, label: "Game Accounts", route: "/game-accounts" },
];

const helpMenu = [
  { icon: HelpCircle, label: "Help Center", route: "/help" },
  { icon: ShieldCheck, label: "Legal & Policies", route: "/legal/terms" },
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

type MenuTone = "primary" | "secondary" | "accent" | "danger";

const toneClasses: Record<MenuTone, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  secondary: "border-secondary/25 bg-secondary/10 text-secondary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
};

const ProfileSkeleton = () => (
  <Surface className="overflow-hidden p-0" neon>
    <SkeletonBlock className="h-28 rounded-none sm:h-36" />
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-end gap-3">
        <SkeletonBlock className="h-20 w-20 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pb-1">
          <SkeletonBlock className="h-5 w-44 max-w-full" />
          <SkeletonBlock className="h-3 w-60 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <SkeletonBlock key={item} className="h-14" />
        ))}
      </div>
    </div>
  </Surface>
);

const MenuRow = ({
  icon: Icon,
  label,
  description,
  tone = "primary",
  disabled = false,
  onClick,
}: {
  icon: typeof Edit;
  label: string;
  description?: string;
  tone?: MenuTone;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="arena-focus flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border border-glass-border bg-background/38 px-3 py-2.5 text-left transition-colors hover:border-primary/35 hover:bg-background/55 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
          toneClasses[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-heading text-sm font-bold",
            tone === "danger" && "text-destructive",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
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
    <Surface className="space-y-2 p-2.5 sm:p-3">{children}</Surface>
  </section>
);

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
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveUsernameInput, setLeaveUsernameInput] = useState("");
  const [leavePhraseInput, setLeavePhraseInput] = useState("");

  const stats = [
    { label: "Balance", value: formatCurrency(profile?.walletBalance ?? 0) },
    {
      label: "Won",
      value: formatCurrency(
        profile?.stats?.amount_won ?? profile?.playerEarnings ?? 0,
      ),
    },
    {
      label: "Tournaments",
      value:
        profile?.stats?.tournamentsPlayed ??
        profile?.stats?.matchesPlayed ??
        0,
    },
  ];
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
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
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
    { icon: Lock, label: passwordLabel, route: "/change-password" },
    ...menuItems.slice(1),
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

  const resetLeaveDialog = () => {
    setLeaveUsernameInput("");
    setLeavePhraseInput("");
  };

  const handleLeaveCreator = async () => {
    if (
      !profile ||
      leaveUsernameInput.trim() !== profile.username ||
      leavePhraseInput.trim() !== LEAVE_CREATOR_CONFIRM_TEXT
    ) {
      toast.error("Confirmation does not match.", {
        description: `Type your username and "${LEAVE_CREATOR_CONFIRM_TEXT}" to continue.`,
      });
      return;
    }

    try {
      setCreatorLoading(true);
      const res = await leaveCreator();
      setCurrentProfileCache(queryClient, res.data.user, res);
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

  const leaveCreatorConfirmReady =
    Boolean(profile) &&
    leaveUsernameInput.trim() === profile?.username &&
    leavePhraseInput.trim() === LEAVE_CREATOR_CONFIRM_TEXT;

  return (
    <PageShell contentClassName="max-w-4xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Profile"
        subtitle="Battle identity, creator tools, and account controls"
        action={
          <button
            type="button"
            onClick={() => refetchProfile()}
            className="arena-icon-button"
            aria-label="Refresh profile"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        }
      />

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
        <ProfileHero
          compact
          user={profile}
          title={profile.username}
          subtitle={[profile.email, getDisplayPhoneNumber(profile.phone_number)]
            .filter(Boolean)
            .join(" - ")}
          bannerUrl={profile.banner?.url}
          stats={stats}
          cacheNotice={cacheNotice}
          onEditImages={() => navigate("/edit-profile")}
        />
      ) : (
        <EmptyState
          icon={AlertCircle}
          title="No saved profile data"
          description="Connect once to save your profile for offline use."
        />
      )}

      {profile && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
          <div className="space-y-3">
            <MenuSection title="Creator Tools">
              {!isCreator && (
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
                      ? "Admin approval is required before creating tournaments"
                      : "Admin approval is required"
                  }
                  tone="secondary"
                  disabled={creatorLoading || creatorRequestPending}
                  onClick={handleCreatorRequest}
                />
              )}

              {isCreator &&
                creatorMenu.map((item) => (
                  <MenuRow
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    tone="secondary"
                    onClick={() => navigate(item.route)}
                  />
                ))}
            </MenuSection>

            <MenuSection title="Account">
              {accountMenuItems.map((item) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  tone="primary"
                  onClick={() => navigate(item.route)}
                />
              ))}
            </MenuSection>
          </div>

          <div className="space-y-3">
            {adminMenu.length > 0 && (
              <MenuSection title="Admin">
                {adminMenu.map((item) => (
                  <MenuRow
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    tone="accent"
                    onClick={() => navigate(item.route)}
                  />
                ))}
              </MenuSection>
            )}

            <MenuSection title="Help & Legal">
              {helpMenu.map((item) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  tone="secondary"
                  onClick={() => navigate(item.route)}
                />
              ))}
            </MenuSection>

            <Surface className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold">Account status</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Keep your profile, phone, and game IDs updated for payouts.
                  </p>
                </div>
                <StatusPill tone={isCreator ? "secondary" : "muted"}>
                  {isCreator ? "Creator" : "Player"}
                </StatusPill>
              </div>
            </Surface>

            <UiPreferencesPanel />

            <MenuSection title="Critical Section" danger>
              {isCreator && (
                <MenuRow
                  icon={UserMinus}
                  label="Leave Creator"
                  description="Removes creator access after confirmation"
                  tone="danger"
                  disabled={creatorLoading}
                  onClick={() => setLeaveDialogOpen(true)}
                />
              )}

              <MenuRow
                icon={LogOut}
                label={logoutLoading ? "Logging out..." : "Logout"}
                tone="danger"
                disabled={logoutLoading}
                onClick={handleLogout}
              />
            </MenuSection>
          </div>
        </div>
      )}

      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          setLeaveDialogOpen(open);
          if (!open) resetLeaveDialog();
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-destructive/30 bg-card/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive">
              Leave Creator
            </DialogTitle>
            <DialogDescription>
              This removes creator access from your account. Existing platform
              records remain saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-heading text-xs text-muted-foreground">
                Type your username
              </label>
              <input
                type="text"
                value={leaveUsernameInput}
                onChange={(event) => setLeaveUsernameInput(event.target.value)}
                placeholder={profile?.username || "username"}
                className="arena-focus w-full rounded-xl border border-glass-border bg-transparent px-3 py-2.5 font-heading text-sm focus:border-destructive"
              />
            </div>

            <div>
              <label className="mb-1 block font-heading text-xs text-muted-foreground">
                Type "{LEAVE_CREATOR_CONFIRM_TEXT}"
              </label>
              <input
                type="text"
                value={leavePhraseInput}
                onChange={(event) => setLeavePhraseInput(event.target.value)}
                placeholder={LEAVE_CREATOR_CONFIRM_TEXT}
                className="arena-focus w-full rounded-xl border border-glass-border bg-transparent px-3 py-2.5 font-heading text-sm focus:border-destructive"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLeaveDialogOpen(false)}
                disabled={creatorLoading}
                className="arena-focus rounded-xl border border-glass-border px-4 py-2 font-heading text-sm text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveCreator}
                disabled={!leaveCreatorConfirmReady || creatorLoading}
                className="arena-focus rounded-xl bg-destructive px-4 py-2 font-heading text-sm text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatorLoading ? "Leaving..." : "Leave Creator"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default ProfileScreen;
