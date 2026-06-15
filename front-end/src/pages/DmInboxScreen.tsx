import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Pin, Search, Shield, SlidersHorizontal, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDmSettings, listDmConversations, updateDmSettings, type DmConversation, type DmSettings } from "@/api/dm";
import { EmptyState, PageHeader, PageShell, SkeletonBlock, StatusPill } from "@/components/design-system";
import { UserAvatar } from "@/components/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDmSocket } from "@/lib/dm-socket";
import { cn } from "@/lib/utils";

const useDebouncedValue = (value: string, delay = 220) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
};

const filters = [
  { value: "inbox", label: "Inbox" },
  { value: "requests", label: "Requests" },
  { value: "sent_requests", label: "Sent" },
  { value: "archived", label: "Archived" },
];

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getLastMessageText = (conversation: DmConversation) => {
  if (conversation.request.status === "pending") return "Message request";
  const last = conversation.lastMessage;
  if (!last?.body) return "No messages yet";
  if (last.type === "image") return "Image";
  if (last.type === "file") return "Attachment";
  return last.body;
};

const DmInboxScreen = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("inbox");
  const [showSettings, setShowSettings] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const queryKey = useMemo(() => ["dm", "conversations", status, debouncedSearch.trim()] as const, [debouncedSearch, status]);

  const {
    data: conversations = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => listDmConversations({ status, q: debouncedSearch.trim(), limit: 60 }),
    staleTime: 30_000,
  });
  const { data: settings } = useQuery({
    queryKey: ["dm", "settings"],
    queryFn: getDmSettings,
    staleTime: 2 * 60_000,
  });
  const settingsMutation = useMutation({
    mutationFn: (payload: Partial<DmSettings>) => updateDmSettings(payload),
    onSuccess: (next) => queryClient.setQueryData(["dm", "settings"], next),
  });

  useEffect(() => {
    const socket = getDmSocket();
    if (!socket) return;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["dm", "conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["dm", "unread-count"] });
    };

    socket.on("conversation:created", refresh);
    socket.on("conversation:update", refresh);
    socket.on("conversation:accepted", refresh);
    socket.on("conversation:block", refresh);
    socket.on("conversation:delete", refresh);
    socket.on("message:receive", refresh);
    socket.on("dm:unread", refresh);

    return () => {
      socket.off("conversation:created", refresh);
      socket.off("conversation:update", refresh);
      socket.off("conversation:accepted", refresh);
      socket.off("conversation:block", refresh);
      socket.off("conversation:delete", refresh);
      socket.off("message:receive", refresh);
      socket.off("dm:unread", refresh);
    };
  }, [queryClient]);

  return (
    <PageShell>
      <PageHeader
        title="Messages"
        subtitle="Private chats, requests, and creator conversations"
        icon={MessageCircle}
        action={
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowSettings((value) => !value)} aria-label="DM settings">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        }
      />

      {showSettings && settings && (
        <section className="grid gap-3 border-b border-glass-border/60 pb-3 text-sm sm:grid-cols-3">
          <label className="space-y-1">
            <span className="font-heading text-[10px] font-bold uppercase text-muted-foreground">Who can DM</span>
            <select
              value={settings.privacy}
              disabled={settingsMutation.isPending}
              onChange={(event) => settingsMutation.mutate({ privacy: event.target.value as DmSettings["privacy"] })}
              className="arena-focus min-h-10 w-full rounded-sm border border-glass-border bg-background px-2 text-xs"
            >
              <option value="everyone">Everyone</option>
              <option value="followers_only">Followers only</option>
              <option value="subscribers_only">Subscribers only</option>
              <option value="mutual_followers">Mutual followers</option>
              <option value="nobody">Nobody</option>
            </select>
          </label>
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-sm bg-card/65 px-3">
            <span className="text-xs text-muted-foreground">Read receipts</span>
            <input
              type="checkbox"
              checked={settings.readReceipts}
              disabled={settingsMutation.isPending}
              onChange={(event) => settingsMutation.mutate({ readReceipts: event.target.checked })}
            />
          </label>
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-sm bg-card/65 px-3">
            <span className="text-xs text-muted-foreground">Online status</span>
            <input
              type="checkbox"
              checked={settings.onlineStatus}
              disabled={settingsMutation.isPending}
              onChange={(event) => settingsMutation.mutate({ onlineStatus: event.target.checked })}
            />
          </label>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-glass-border/70 pb-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search messages..."
            className="min-h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {isFetching && !isLoading ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={status === filter.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatus(filter.value)}
              className="shrink-0"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-glass-border/55 py-3">
              <SkeletonBlock className="h-11 w-11 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-36" />
                <SkeletonBlock className="h-3 w-52 max-w-full" />
              </div>
            </div>
          ))
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={status === "requests" ? "No message requests" : "No conversations yet"}
            description="Use Message on creator profiles, community members, tournament participants, or player profiles to start a DM."
          />
        ) : (
          conversations.map((conversation) => {
            const requestIsPending = conversation.request.status === "pending";
            return (
              <button
                key={conversation._id}
                type="button"
                onClick={() => navigate(`/messages/${conversation._id}`)}
                className="arena-focus flex w-full items-center gap-3 border-b border-glass-border/60 py-3 text-left transition-colors hover:bg-muted/35"
              >
                <div className="relative shrink-0">
                  <UserAvatar user={conversation.otherUser} size="sm" />
                  {conversation.unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-heading text-[10px] font-bold text-primary-foreground">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-display text-sm font-extrabold">{conversation.otherUser.username}</p>
                    {conversation.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    {requestIsPending && <StatusPill tone="secondary">Request</StatusPill>}
                    {conversation.isBlocked && <StatusPill tone="danger">Blocked</StatusPill>}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-xs",
                      conversation.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {getLastMessageText(conversation)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">{formatTime(conversation.lastActivityAt)}</p>
                  {conversation.muted && <Shield className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </button>
            );
          })
        )}
      </section>
    </PageShell>
  );
};

export default DmInboxScreen;
