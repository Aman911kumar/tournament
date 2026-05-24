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
  getPushConfig,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
  savePushSubscription,
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
  StatusPill,
  Surface,
} from "@/components/design-system";
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
  report: "text-secondary",
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

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported] = useState(
    typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );

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

  const enablePushNotifications = async () => {
    if (!pushSupported) {
      toast.error("Push not supported", {
        description:
          "Use Chrome/Edge or install the app on a supported mobile browser.",
      });
      return;
    }

    try {
      setPushLoading(true);
      const config = await getPushConfig();
      if (!config?.enabled || !config.publicKey) {
        toast.error("Push not configured", {
          description: "Add VAPID keys on the backend to enable real browser notifications.",
        });
        return;
      }

      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications blocked", {
          description: "Allow notifications from browser settings to receive alerts.",
        });
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        }));

      await savePushSubscription(subscription.toJSON());
      toast.success("Push notifications enabled", {
        description: "Money, room, and creator alerts can now reach this device.",
      });
    } catch (err) {
      const errorToast = getErrorToast(err, {
        action: "Enable push notifications",
        fallback: "Could not enable push.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setPushLoading(false);
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
            className="arena-focus rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 font-heading text-xs font-bold text-primary"
          >
            Mark read
          </button>
        }
      />

      <Surface className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill tone="primary">Device alerts</StatusPill>
            <StatusPill tone={pushSupported ? "accent" : "muted"}>
              {pushSupported ? "Supported" : "Browser limited"}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Receive wallet, creator, and room alerts even when the app is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={enablePushNotifications}
          disabled={pushLoading}
          className="arena-focus min-h-10 rounded-xl border border-primary/40 bg-primary/10 px-4 font-heading text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {pushLoading ? "Enabling..." : "Enable"}
        </button>
      </Surface>

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
              className="arena-focus inline-flex items-center gap-1.5 rounded-xl border border-primary/25 px-3 py-2 font-heading text-xs font-bold text-primary"
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
              className="p-3"
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-glass-border bg-background/45",
                    !notification.read && "border-primary/30 bg-primary/10",
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
