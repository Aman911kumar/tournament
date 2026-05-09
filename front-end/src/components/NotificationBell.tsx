import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Shield, Sparkles, Trophy, Wallet, X } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationType,
} from "@/api/notifications";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotificationSocket } from "@/lib/notification-socket";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const typeIcon: Record<NotificationType, typeof Bell> = {
  system: Bell,
  wallet: Wallet,
  payment: Wallet,
  tournament: Trophy,
  tournament_update: Trophy,
  room: Trophy,
  creator: Sparkles,
  reward: Sparkles,
  security: Shield,
  report: Shield,
  moderation: Shield,
};

const typeColor: Record<NotificationType, string> = {
  system: "text-primary",
  wallet: "text-accent",
  payment: "text-accent",
  tournament: "text-secondary",
  tournament_update: "text-secondary",
  room: "text-secondary",
  creator: "text-primary",
  reward: "text-accent",
  security: "text-destructive",
  report: "text-secondary",
  moderation: "text-destructive",
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const visibleItems = useMemo(() => items.slice(0, 8), [items]);

  const loadNotifications = async () => {
    const res = await getNotifications({ limit: 8 });
    setItems(res.notifications);
    setUnreadCount(res.unreadCount);
  };

  useEffect(() => {
    loadNotifications().catch(() => undefined);

    const socket = getNotificationSocket();
    if (!socket) return;

    const handleNewNotification = (notification: NotificationItem) => {
      setItems((prev) => [notification, ...prev.filter((item) => item._id !== notification._id)].slice(0, 8));
      setUnreadCount((prev) => prev + 1);
    };
    const handleConnect = () => {
      loadNotifications().catch(() => undefined);
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("connect", handleConnect);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("connect", handleConnect);
    };
  }, [navigate]);

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      setItems((prev) => prev.map((item) => (item._id === notification._id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(notification._id).catch(() => {
        setItems((prev) => prev.map((item) => (item._id === notification._id ? { ...item, read: false } : item)));
        setUnreadCount((prev) => prev + 1);
      });
    }

    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
    else navigate("/notifications");
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead().catch(() => loadNotifications().catch(() => undefined));
  };

  const copyValue = async (label: string, value: unknown) => {
    const copied = await copyText(value);
    if (copied) toast.success(`${label} copied`);
    else toast.error("Copy failed", { description: `Could not copy ${label.toLowerCase()}.` });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="arena-focus relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-glass-border bg-card/90 text-foreground transition-colors hover:border-primary/60 hover:text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-lg border-glass-border bg-card/96 p-0 shadow-[0_24px_80px_hsl(0_0%_0%/0.34)]">
        <div className="flex items-center justify-between gap-2 border-b border-glass-border px-4 py-3">
          <div>
            <p className="font-heading text-sm font-bold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              className="arena-focus rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Mark all read"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="arena-focus rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="arena-scrollbar max-h-[420px] overflow-y-auto p-2">
          {visibleItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-heading text-sm">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Wallet, tournament, and security alerts will appear here.</p>
            </div>
          ) : (
            visibleItems.map((item) => {
              const Icon = typeIcon[item.type] ?? Bell;
              return (
                <div
                  key={item._id}
                  onClick={() => openNotification(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openNotification(item);
                  }}
                  className={cn(
                    "arena-focus mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/70",
                    !item.read && "bg-primary/10",
                  )}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-glass-border bg-muted/50">
                    <Icon className={cn("h-4 w-4", typeColor[item.type] ?? "text-primary")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("line-clamp-1 font-heading text-xs font-bold", item.read && "text-muted-foreground")}>{item.title}</span>
                      {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.body}</span>
                    {item.type === "room" && (item.data?.roomId || item.data?.roomPass) && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {item.data?.roomId && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyValue("Room ID", item.data?.roomId);
                            }}
                            className="rounded-md border border-secondary/30 bg-secondary/10 px-2 py-1 text-[10px] font-heading text-secondary hover:bg-secondary/20"
                          >
                            Room ID: {String(item.data.roomId)}
                          </button>
                        )}
                        {item.data?.roomPass && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyValue("Password", item.data?.roomPass);
                            }}
                            className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-heading text-primary hover:bg-primary/20"
                          >
                            Pass: {String(item.data.roomPass)}
                          </button>
                        )}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-muted-foreground/70">{formatTime(item.createdAt)}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <button
          onClick={() => {
            setOpen(false);
            navigate("/notifications");
          }}
          className="arena-focus w-full px-4 py-3 text-center text-xs font-heading text-primary transition-colors hover:bg-muted/60"
        >
          View all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
