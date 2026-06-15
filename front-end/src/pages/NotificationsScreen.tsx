import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Megaphone,
  RefreshCcw,
  Shield,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "@/api/notifications";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";
import {
  CACHE_KEYS,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { copyText } from "@/lib/clipboard";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SkeletonBlock,
  Surface,
} from "@/components/design-system";
import { getNotificationSocket } from "@/lib/notification-socket";
import { cn } from "@/lib/utils";

const iconColorMap: Record<string, string> = {
  tournament_update: "text-destructive",
  payment: "text-accent",
  wallet: "text-accent",
  creator: "text-primary",
  room: "text-secondary",
  tournament: "text-secondary",
  reward: "text-accent",
  security: "text-destructive",
  report: "text-destructive",
  moderation: "text-destructive",
  system: "text-neon-pink",
};

const iconMap = {
  tournament_update: Trophy,
  payment: Wallet,
  wallet: Wallet,
  creator: Sparkles,
  room: Trophy,
  tournament: Trophy,
  reward: Sparkles,
  security: Shield,
  report: Shield,
  moderation: Shield,
  system: Megaphone,
};

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    const cachedNotifications = readCache<NotificationItem[]>(
      CACHE_KEYS.notifications,
    );
    if (cachedNotifications) {
      setNotifications(cachedNotifications.data);
      setLoading(false);
    }

    try {
      setLoading(!cachedNotifications);
      setError(null);
      const nextNotifications = await getNotifications({ limit: 50 });
      setNotifications(nextNotifications.notifications);
      writeAuthenticatedCache(
        CACHE_KEYS.notifications,
        nextNotifications.notifications,
      );
    } catch (err) {
      if (!cachedNotifications) {
        setError(getErrorMessage(err, "Failed to load notifications."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;

    const handleNewNotification = (notification: NotificationItem) => {
      setNotifications((prev) => [
        notification,
        ...prev.filter((item) => item._id !== notification._id),
      ].slice(0, 50));
    };

    socket.on("notification:new", handleNewNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, []);

  const handleMarkAllRead = async () => {
    if (!notifications.some((n) => !n.read)) {
      toast.info("All caught up!", { description: "No unread notifications." });
      return;
    }
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Marked all as read", {
        description: "All notifications have been cleared.",
      });
    } catch (err) {
      const errorToast = getErrorToast(err, {
        action: "Mark notifications read",
        fallback: "Update failed.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  };

  const copyValue = async (label: string, value: unknown) => {
    const copied = await copyText(value);
    if (copied) toast.success(`${label} copied`);
    else {
      toast.error("Copy failed", {
        description: `Could not copy ${label.toLowerCase()}.`,
      });
    }
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notification._id ? { ...item, read: true } : item,
        ),
      );

      try {
        await markNotificationRead(notification._id);
      } catch {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id ? { ...item, read: false } : item,
          ),
        );
      }
    }

    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <PageShell contentClassName="max-w-4xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread alerts`}
        icon={Bell}
        onBack={() => navigate(-1)}
        action={
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="arena-focus rounded-md border border-primary/30 bg-[#101620] px-3 py-2 font-heading text-xs font-bold text-primary transition-colors hover:bg-primary/10"
          >
            Mark read
          </button>
        }
      />

      {loading &&
        [0, 1, 2].map((item) => (
          <Surface key={item}>
            <div className="flex gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-1/2" />
                <SkeletonBlock className="h-3 w-4/5" />
                <SkeletonBlock className="h-2.5 w-20" />
              </div>
            </div>
          </Surface>
        ))}

      {!loading && error && (
        <EmptyState
          icon={AlertCircle}
          title="Could not load notifications"
          description={error}
          action={
            <button
              type="button"
              onClick={loadNotifications}
              className="arena-focus inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-[#101620] px-3 py-2 font-heading text-xs font-bold text-primary"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </button>
          }
        />
      )}

      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You are all caught up."
        />
      )}

      {!loading &&
        !error &&
        notifications.map((notification) => {
          const Icon = iconMap[notification.type] ?? Megaphone;
          return (
            <Surface
              key={notification._id}
              interactive
              neon={!notification.read}
              onClick={() => handleOpenNotification(notification)}
              className={cn(
                "p-3",
                notification.read ? "bg-[#101620]" : "border-primary/35 bg-[#0F1B24]",
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-glass-border bg-background/45",
                    !notification.read ? "border-primary/30 bg-primary/10" : "bg-[#0D1117]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      iconColorMap[notification.type] ?? iconColorMap.system,
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "line-clamp-1 font-heading text-xs font-bold",
                        notification.read && "text-muted-foreground",
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {notification.body}
                  </p>
                  {notification.type === "room" &&
                    (notification.data?.roomId || notification.data?.roomPass) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {notification.data?.roomId && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyValue("Room ID", notification.data?.roomId);
                            }}
                            className="arena-focus rounded-lg border border-secondary/30 bg-secondary/10 px-2 py-1 font-heading text-[10px] text-secondary hover:bg-secondary/20"
                          >
                            Room: {String(notification.data.roomId)}
                          </button>
                        )}
                        {notification.data?.roomPass && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyValue("Password", notification.data?.roomPass);
                            }}
                            className="arena-focus rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 font-heading text-[10px] text-primary hover:bg-primary/20"
                          >
                            Pass: {String(notification.data.roomPass)}
                          </button>
                        )}
                      </div>
                    )}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Surface>
          );
        })}
    </PageShell>
  );
};

export default NotificationsScreen;
