import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Ban,
  Bell,
  CheckCircle2,
  Eye,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SearchBox,
  SkeletonBlock,
  Surface,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CreatorChannel,
  CreatorChannelMember,
  getMyChannel,
  getMyChannelMembers,
} from "@/api/creators";
import { UserAvatar } from "@/components/identity";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { prefetchOnIntent, prefetchRoute } from "@/lib/route-prefetch";
import { formatCompactNumber } from "@/config/discovery.config";
import { cn } from "@/lib/utils";

type CommunityTab =
  | "Members"
  | "Moderators";

type MemberRole = "member" | "subscriber" | "moderator" | "creator";
type MemberState = "active" | "inactive" | "restricted" | "blocked";
type ModerationAction = "warn" | "mute" | "restrict" | "block" | "promote" | "remove-moderator" | "unblock";

interface CommunityMember {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  email?: string;
  roles: MemberRole[];
  state: MemberState;
  joinedAt: string;
  followedAt: string;
  lastActiveAt: string;
  verified?: boolean;
  activityScore: number;
  subscription?: {
    status: "active" | "expired" | "gifted";
    startedAt: string;
    expiresAt: string;
    tier: string;
    supporterScore: number;
  };
  permissions?: Array<"Manage Chat" | "Manage Reports" | "Manage Tournaments" | "Manage Community">;
  restriction?: {
    reason: string;
    by: string;
    date: string;
    expiry: string;
  };
  block?: {
    reason: string;
    date: string;
    type: "Permanent" | "Temporary";
  };
  notes: string[];
}

const tabs: CommunityTab[] = [
  "Members",
  "Moderators",
];

const filterOptions = {
  Members: ["Newest", "Oldest", "Most Active", "Inactive", "Verified", "Creators"],
  Moderators: ["All", "Chat", "Reports", "Tournaments", "Community"],
} satisfies Record<CommunityTab, string[]>;

const advancedFilters = [
  "Active",
  "Inactive",
  "Moderator",
] as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const toIsoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const getStateTone = (state: MemberState) => {
  if (state === "blocked") return "bg-destructive/12 text-destructive";
  if (state === "restricted") return "bg-warning/12 text-warning";
  if (state === "inactive") return "bg-muted/55 text-muted-foreground";
  return "bg-accent/10 text-accent";
};

const getActivityScore = (lastActiveAt?: string | null) => {
  if (!lastActiveAt) return 30;
  const days = Math.max(0, Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (24 * 60 * 60 * 1000)));
  if (days <= 1) return 96;
  if (days <= 7) return 82;
  if (days <= 30) return 58;
  return 34;
};

const mapChannelMember = (subscription: CreatorChannelMember): CommunityMember => {
  const user = subscription.user;
  const roles: MemberRole[] = ["member"];
  if (user.role?.includes("creator")) roles.push("creator");
  if (user.role?.includes("moderator") || user.role?.includes("admin")) roles.push("moderator");

  const accountStatus = String(user.accountStatus || "active");
  const state: MemberState =
    accountStatus === "banned"
      ? "blocked"
      : accountStatus === "muted" || accountStatus === "suspended"
        ? "restricted"
        : user.isActive === false
          ? "inactive"
          : "active";

  return {
    id: String(user._id),
    name: user.username || "Battle4Arena user",
    username: user.username || String(user._id).slice(-8),
    avatarUrl: user.avatar?.url,
    email: user.email,
    roles,
    state,
    joinedAt: user.createdAt || subscription.joinedAt,
    followedAt: subscription.joinedAt,
    lastActiveAt: user.lastLoginAt || subscription.joinedAt,
    verified: Boolean(user.emailVerified || user.phoneVerified),
    activityScore: getActivityScore(user.lastLoginAt || subscription.joinedAt),
    permissions: roles.includes("moderator")
      ? ["Manage Chat", "Manage Reports"]
      : undefined,
    restriction: state === "restricted"
      ? {
          reason: accountStatus === "muted" ? "Muted account" : "Suspended account",
          by: "Platform",
          date: subscription.joinedAt,
          expiry: "Until review",
        }
      : undefined,
    block: state === "blocked"
      ? {
          reason: "Banned account",
          date: subscription.joinedAt,
          type: "Permanent",
        }
      : undefined,
    notes: [],
  };
};

const buildCommunityData = (
  channel?: CreatorChannel | null,
  profile?: ReturnType<typeof useCurrentProfile>["profile"],
  fetchedMembers: CreatorChannelMember[] = [],
) => {
  const owner = channel?.owner;
  const ownerMember: CommunityMember | null = profile
    ? {
        id: String(profile._id),
        name: profile.username || owner?.username || channel?.name || "Creator",
        username: profile.username || owner?.username || channel?.handle || "creator",
        avatarUrl: profile.avatar?.url || owner?.avatar?.url || channel?.avatar?.url,
        email: profile.email,
        roles: ["creator", "moderator"],
        state: "active",
        joinedAt: profile.createdAt || toIsoDaysAgo(30),
        followedAt: profile.createdAt || toIsoDaysAgo(30),
        lastActiveAt: profile.lastLoginAt || new Date().toISOString(),
        verified: true,
        activityScore: 100,
        permissions: ["Manage Chat", "Manage Reports", "Manage Tournaments", "Manage Community"],
        notes: ["Owner account"],
      }
    : null;

  const fetchedCommunityMembers = fetchedMembers.map(mapChannelMember);
  const memberById = new Map(fetchedCommunityMembers.map((member) => [member.id, member]));
  if (ownerMember && !memberById.has(ownerMember.id)) {
    memberById.set(ownerMember.id, ownerMember);
  }

  const ownerId = ownerMember?.id;
  const members = Array.from(memberById.values()).filter((member) => member.id !== ownerId);
  const moderators = Array.from(memberById.values()).filter((member) => member.roles.includes("moderator"));

  return {
    members,
    moderators,
  };
};

const CommunityStat = ({
  icon: Icon,
  label,
  value,
  tone = "text-primary",
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  tone?: string;
}) => (
  <div className="min-w-0 rounded-sm bg-background/35 px-2.5 py-2">
    <div className="flex items-center gap-1.5">
      <Icon className={cn("h-4 w-4 shrink-0", tone)} />
      <p className="truncate font-heading text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
    </div>
    <p className="mt-1 truncate font-display text-base font-black leading-none">
      {typeof value === "number" ? formatCompactNumber(value) : value}
    </p>
  </div>
);

const CompactPill = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "arena-focus inline-flex min-h-9 shrink-0 items-center justify-center rounded-sm px-3 font-heading text-[11px] font-bold transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-card/65 text-muted-foreground hover:bg-muted/55 hover:text-foreground",
    )}
  >
    {children}
  </button>
);

const EmptyTabState = ({
  icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) => (
  <EmptyState
    icon={icon}
    title={title}
    description={description}
    className="border-0 bg-transparent py-8"
  />
);

const MemberRow = ({
  member,
  selected,
  onSelect,
  onOpen,
  onAction,
}: {
  member: CommunityMember;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onAction: (action: ModerationAction) => void;
}) => (
  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border py-2.5 last:border-b-0">
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "arena-focus grid h-6 w-6 place-items-center rounded-sm border text-[10px]",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/50 text-muted-foreground",
      )}
      aria-label={selected ? "Deselect member" : "Select member"}
    >
      {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : ""}
    </button>

    <button
      type="button"
      onClick={onOpen}
      className="arena-focus flex min-w-0 items-center gap-2.5 text-left"
    >
      <UserAvatar
        user={{ username: member.username, avatar: { url: member.avatarUrl }, role: member.roles }}
        size="md"
      />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-heading text-sm font-bold">{member.name}</span>
          {member.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          @{member.username} - active {formatDateTime(member.lastActiveAt)}
        </span>
      </span>
    </button>

    <div className="flex items-center gap-1">
      <span className={cn("hidden rounded-sm px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase min-[430px]:inline-flex", getStateTone(member.state))}>
        {member.state}
      </span>
      <button
        type="button"
        onClick={() => onAction("restrict")}
        className="arena-focus grid h-8 w-8 place-items-center rounded-sm text-muted-foreground hover:bg-warning/10 hover:text-warning"
        aria-label="Restrict member"
      >
        <ShieldAlert className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onAction("block")}
        className="arena-focus grid h-8 w-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Block member"
      >
        <Ban className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const PermissionChips = ({ permissions = [] }: { permissions?: CommunityMember["permissions"] }) => (
  <div className="flex flex-wrap gap-1.5">
    {(permissions || []).map((permission) => (
      <span key={permission} className="rounded-sm bg-secondary/10 px-2 py-1 font-heading text-[10px] font-bold text-secondary">
        {permission}
      </span>
    ))}
  </div>
);

const ModerationDialog = ({
  action,
  count,
  open,
  onOpenChange,
  onSubmit,
}: {
  action: ModerationAction | null;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: string; duration: string; notes: string }) => void;
}) => {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("24h");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setDuration("24h");
      setNotes("");
    }
  }, [open]);

  const label = action ? action.replace("-", " ") : "moderation action";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading capitalize">{label}</DialogTitle>
          <DialogDescription>
            Add a reason, duration, and staff note for {count} selected user{count === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reason</span>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Spam, abuse, scam, harassment..." />
          </label>
          <label className="block space-y-1.5">
            <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duration</span>
            <Input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="24h, 7d, permanent" />
          </label>
          <label className="block space-y-1.5">
            <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Staff notes</span>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Visible only to creator staff." rows={4} />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={action === "block" || action === "unblock" ? "destructive" : "default"}
            disabled={!reason.trim()}
            onClick={() => onSubmit({ reason, duration, notes })}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommunityManagementScreen = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [channel, setChannel] = useState<CreatorChannel | null>(null);
  const [channelMembers, setChannelMembers] = useState<CreatorChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CommunityTab>("Members");
  const [activeFilter, setActiveFilter] = useState<string>("Newest");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [moderationTargets, setModerationTargets] = useState<string[]>([]);
  const profileId = profile?._id ? String(profile._id) : "";
  const hasCreatorAccess = Boolean(profile?.role?.includes("creator"));

  useEffect(() => {
    let active = true;

    if (profileLoading) {
      return () => {
        active = false;
      };
    }

    if (!hasCreatorAccess) {
      setLoading(false);
      setChannel(null);
      setChannelMembers([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);

    Promise.allSettled([
      getMyChannel(),
      getMyChannelMembers({ limit: 200 }),
    ])
      .then(([channelResult, membersResult]) => {
        if (!active) return;

        if (channelResult.status === "fulfilled") {
          setChannel(channelResult.value?.channel ?? null);
        } else {
          setChannel(null);
          const errorToast = getErrorToast(channelResult.reason, {
            action: "Load channel",
            fallback: "Could not load creator channel.",
          });
          toast.error(errorToast.title, { description: errorToast.description });
        }

        if (membersResult.status === "fulfilled") {
          setChannelMembers(membersResult.value.members ?? []);
          if (channelResult.status !== "fulfilled" && membersResult.value.channel) {
            setChannel(membersResult.value.channel);
          }
        } else {
          setChannelMembers([]);
          const errorToast = getErrorToast(membersResult.reason, {
            action: "Load members",
            fallback: "Could not load channel members.",
          });
          toast.error(errorToast.title, { description: errorToast.description });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasCreatorAccess, profileId, profileLoading]);

  useEffect(() => {
    setActiveFilter(filterOptions[activeTab][0]);
    setSelectedIds(new Set());
  }, [activeTab]);

  const communityData = useMemo(
    () => buildCommunityData(channel, profile, channelMembers),
    [channel, channelMembers, profile],
  );

  const stats = useMemo(() => {
    const totalFollowers = Number(channel?.memberCount || 0);
    return [
      { icon: Users, label: "Followers", value: totalFollowers, tone: "text-primary" },
      { icon: Activity, label: "Active", value: communityData.members.filter((member) => member.state === "active").length, tone: "text-accent" },
      { icon: Shield, label: "Moderators", value: communityData.moderators.length, tone: "text-primary" },
    ];
  }, [channel?.memberCount, communityData]);

  const applyPeopleFilters = (members: CommunityMember[]) => {
    const query = search.trim().toLowerCase();
    let list = [...members];

    if (query) {
      list = list.filter((member) =>
        member.name.toLowerCase().includes(query) ||
        member.username.toLowerCase().includes(query) ||
        member.id.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query),
      );
    }

    enabledFilters.forEach((filter) => {
      if (filter === "Active") list = list.filter((member) => member.state === "active");
      if (filter === "Inactive") list = list.filter((member) => member.state === "inactive");
      if (filter === "Moderator") list = list.filter((member) => member.roles.includes("moderator"));
    });

    if (activeTab === "Members") {
      if (activeFilter === "Oldest") list.sort((a, b) => +new Date(a.followedAt) - +new Date(b.followedAt));
      else if (activeFilter === "Most Active") list.sort((a, b) => b.activityScore - a.activityScore);
      else if (activeFilter === "Inactive") list = list.filter((member) => member.state === "inactive");
      else if (activeFilter === "Verified") list = list.filter((member) => member.verified);
      else if (activeFilter === "Creators") list = list.filter((member) => member.roles.includes("creator"));
      else list.sort((a, b) => +new Date(b.followedAt) - +new Date(a.followedAt));
    }

    return list;
  };

  const visibleMembers = useMemo(() => applyPeopleFilters(communityData.members), [activeFilter, activeTab, communityData.members, enabledFilters, search]);
  const visibleModerators = useMemo(() => {
    let list = applyPeopleFilters(communityData.moderators);
    if (activeFilter !== "All") {
      list = list.filter((member) => member.permissions?.some((permission) => permission.includes(activeFilter)));
    }
    return list;
  }, [activeFilter, communityData.moderators, enabledFilters, search]);

  const toggleAdvancedFilter = (filter: string) => {
    setEnabledFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openModeration = (action: ModerationAction, targetIds?: string[]) => {
    setModerationAction(action);
    setModerationTargets(targetIds?.length ? targetIds : Array.from(selectedIds));
  };

  const handleModerationSubmit = (payload: { reason: string; duration: string; notes: string }) => {
    const label = moderationAction?.replace("-", " ") || "moderation";
    toast.success("Action queued", {
      description: `${label} for ${moderationTargets.length || 1} user(s). Reason: ${payload.reason}`,
    });
    setModerationAction(null);
    setModerationTargets([]);
    setSelectedIds(new Set());
  };

  const channelReady = Boolean(channel);
  const isCreator = hasCreatorAccess;

  const renderTabContent = () => {
    if (activeTab === "Members") {
      if (visibleMembers.length === 0) {
        return (
          <EmptyTabState
            icon={Users}
            title="No member records yet"
            description="Follower/member rows will appear here when community member data is available."
          />
        );
      }

      return visibleMembers.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          selected={selectedIds.has(member.id)}
          onSelect={() => toggleSelected(member.id)}
          onOpen={() => setSelectedMember(member)}
          onAction={(action) => openModeration(action, [member.id])}
        />
      ));
    }

    if (activeTab === "Moderators") {
      if (visibleModerators.length === 0) {
        return (
          <EmptyTabState
            icon={Shield}
            title="No moderators assigned"
            description="Promoted moderators and their permissions will appear here."
          />
        );
      }

      return visibleModerators.map((member) => (
        <div key={member.id} className="grid gap-2 border-b border-border py-3 last:border-b-0 min-[620px]:grid-cols-[1fr_1.2fr_auto] min-[620px]:items-center">
          <button type="button" onClick={() => setSelectedMember(member)} className="arena-focus flex min-w-0 items-center gap-2.5 text-left">
            <UserAvatar user={{ username: member.username, avatar: { url: member.avatarUrl }, role: member.roles }} size="md" />
            <span className="min-w-0">
              <span className="truncate font-heading text-sm font-bold">{member.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">@{member.username}</span>
            </span>
          </button>
          <PermissionChips permissions={member.permissions} />
          <div className="flex gap-2">
            <Button size="sm" variant="soft" onClick={() => openModeration("promote", [member.id])}>Edit</Button>
            <Button size="sm" variant="outline" onClick={() => openModeration("remove-moderator", [member.id])}>Remove</Button>
          </div>
        </div>
      ));
    }

    return null;
  };

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-3 pb-4">
      <PageHeader
        title="Community Management"
        subtitle="Followers and moderator controls"
        onBack={() => navigate(-1)}
        action={
          <Button
            type="button"
            size="sm"
            variant="soft"
            onClick={() => navigate("/channel-setup")}
            {...prefetchOnIntent(() => prefetchRoute("/channel-setup"))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Setup
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-72" />
        </div>
      ) : !isCreator ? (
          <EmptyState
          icon={Users}
          title="Creator access required"
          description="Request creator access from your profile to manage followers and moderators."
          action={
            <Button type="button" onClick={() => navigate("/profile")}>
              Open Profile
            </Button>
          }
        />
      ) : (
        <>
          <Surface className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-primary/10 px-2 py-1 font-heading text-[10px] font-bold uppercase text-primary">
                    Creator Studio
                  </span>
                  {channelReady ? (
                    <span className="rounded-sm bg-accent/10 px-2 py-1 font-heading text-[10px] font-bold uppercase text-accent">
                      Channel Active
                    </span>
                  ) : (
                    <span className="rounded-sm bg-warning/10 px-2 py-1 font-heading text-[10px] font-bold uppercase text-warning">
                      Setup Needed
                    </span>
                  )}
                </div>
                <h2 className="mt-2 truncate font-display text-lg font-black leading-tight text-foreground sm:text-xl">
                  {channel?.name || "Your Community"}
                </h2>
                <p className="mt-1 line-clamp-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
                  Manage followers and moderators from one compact workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="soft" onClick={() => setActiveTab("Members")}>
                  <Users className="mr-1 h-3.5 w-3.5" />
                  Members
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("Moderators")}>
                  <Shield className="mr-1 h-3.5 w-3.5" />
                  Moderators
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {stats.map((stat) => (
                <CommunityStat key={stat.label} {...stat} />
              ))}
            </div>
          </Surface>

          <div className="flex min-w-0 items-center gap-2">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search username, name, user ID..."
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={cn(
                "arena-focus inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-card/80 px-3 font-heading text-[10px] font-bold transition-colors hover:bg-muted/55 min-[420px]:px-4 min-[420px]:text-xs",
                showFilters || enabledFilters.size > 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden min-[360px]:inline">Filters</span>
            </button>
          </div>

          {showFilters && (
            <Surface className="space-y-3 p-2.5">
              <div>
                <p className="mb-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {activeTab} filters
                </p>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {filterOptions[activeTab].map((filter) => (
                    <CompactPill key={filter} active={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
                      {filter}
                    </CompactPill>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Advanced
                </p>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {advancedFilters.map((filter) => (
                    <CompactPill key={filter} active={enabledFilters.has(filter)} onClick={() => toggleAdvancedFilter(filter)}>
                      {filter}
                    </CompactPill>
                  ))}
                </div>
              </div>
            </Surface>
          )}

          <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-1 scrollbar-hide" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "arena-focus inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm px-3 font-heading text-[11px] font-bold transition-colors",
                  activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card/75 hover:text-foreground",
                )}
                role="tab"
                aria-selected={activeTab === tab}
              >
                {tab === "Members" && <Users className="h-3.5 w-3.5" />}
                {tab === "Moderators" && <Shield className="h-3.5 w-3.5" />}
                {tab}
              </button>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <Surface className="flex flex-col gap-2 p-2.5 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
              <p className="font-heading text-xs font-bold text-primary">
                {selectedIds.size} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toast.info("Bulk message ready for chat integration.")}>
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                  Message
                </Button>
                <Button size="sm" variant="soft" onClick={() => openModeration("restrict")}>Restrict</Button>
                <Button size="sm" variant="destructive" onClick={() => openModeration("block")}>Block</Button>
                <Button size="sm" variant="outline" onClick={() => toast.success("Export prepared", { description: "CSV export can attach to backend when available." })}>Export</Button>
              </div>
            </Surface>
          )}

          <Surface className="min-h-[280px] p-3">
            {renderTabContent()}
          </Surface>
        </>
      )}

      <Sheet open={Boolean(selectedMember)} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent side="right" className="w-[92vw] overflow-y-auto sm:max-w-md">
          {selectedMember && (
            <>
              <SheetHeader className="pr-9">
                <SheetTitle>{selectedMember.name}</SheetTitle>
                <SheetDescription>@{selectedMember.username}</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar user={{ username: selectedMember.username, avatar: { url: selectedMember.avatarUrl }, role: selectedMember.roles }} size="lg" />
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-bold">{selectedMember.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedMember.email || "Email hidden"}</p>
                    <span className={cn("mt-2 inline-flex rounded-sm px-2 py-1 font-heading text-[10px] font-bold uppercase", getStateTone(selectedMember.state))}>
                      {selectedMember.state}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="border-b border-border pb-2">
                    <p className="font-heading text-[10px] uppercase text-muted-foreground">Joined</p>
                    <p className="font-heading text-xs font-bold">{formatDate(selectedMember.joinedAt)}</p>
                  </div>
                  <div className="border-b border-border pb-2">
                    <p className="font-heading text-[10px] uppercase text-muted-foreground">Follower Since</p>
                    <p className="font-heading text-xs font-bold">{formatDate(selectedMember.followedAt)}</p>
                  </div>
                  <div className="border-b border-border pb-2">
                    <p className="font-heading text-[10px] uppercase text-muted-foreground">Last Active</p>
                    <p className="font-heading text-xs font-bold">{formatDateTime(selectedMember.lastActiveAt)}</p>
                  </div>
                  <div className="border-b border-border pb-2">
                    <p className="font-heading text-[10px] uppercase text-muted-foreground">Activity</p>
                    <p className="font-heading text-xs font-bold text-primary">{selectedMember.activityScore}/100</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Creator notes
                  </p>
                  {selectedMember.notes.length > 0 ? (
                    <div className="space-y-2">
                      {selectedMember.notes.map((note) => (
                        <p key={note} className="rounded-sm bg-card/60 px-3 py-2 text-xs text-muted-foreground">{note}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No staff notes yet.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="soft" onClick={() => toast.info("Message flow will use chat integration when available.")}>
                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                    Message
                  </Button>
                  <Button type="button" variant="outline" onClick={() => toast.info("Profile preview will open public user profile when available.")}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Profile
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openModeration("promote", [selectedMember.id])}>
                    <UserCog className="mr-1 h-3.5 w-3.5" />
                    Promote
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openModeration("restrict", [selectedMember.id])}>
                    <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                    Restrict
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openModeration("warn", [selectedMember.id])}>
                    <Bell className="mr-1 h-3.5 w-3.5" />
                    Warn
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => openModeration("block", [selectedMember.id])}>
                    <Ban className="mr-1 h-3.5 w-3.5" />
                    Block
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ModerationDialog
        open={Boolean(moderationAction)}
        action={moderationAction}
        count={moderationTargets.length || selectedIds.size || 1}
        onOpenChange={(open) => {
          if (!open) {
            setModerationAction(null);
            setModerationTargets([]);
          }
        }}
        onSubmit={handleModerationSubmit}
      />
    </PageShell>
  );
};

export default CommunityManagementScreen;
