import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Bell, Megaphone, RefreshCcw, Shield, Sparkles, Trophy, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
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
import { CACHE_KEYS, readCache, writeAuthenticatedCache } from "@/lib/offline-cache";
import { copyText } from "@/lib/clipboard";

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
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
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
    const cachedNotifications = readCache<NotificationItem[]>(CACHE_KEYS.notifications);
    if (cachedNotifications) {
      setNotifications(cachedNotifications.data);
      setLoading(false);
    }

    try {
      setLoading(!cachedNotifications);
      setError(null);
      const nextNotifications = await getNotifications({ limit: 50 });
      setNotifications(nextNotifications.notifications);
      writeAuthenticatedCache(CACHE_KEYS.notifications, nextNotifications.notifications);
    } catch (err) {
      if (!cachedNotifications) setError(getErrorMessage(err, "Failed to load notifications."));
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
      toast.success("Marked all as read", { description: "All notifications have been cleared." });
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Mark notifications read", fallback: "Update failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  };

  const copyValue = async (label: string, value: unknown) => {
    const copied = await copyText(value);
    if (copied) toast.success(`${label} copied`);
    else toast.error("Copy failed", { description: `Could not copy ${label.toLowerCase()}.` });
  };

  const enablePushNotifications = async () => {
    if (!pushSupported) {
      toast.error("Push not supported", { description: "Use Chrome/Edge or install the app on a supported mobile browser." });
      return;
    }

    try {
      setPushLoading(true);
      const config = await getPushConfig();
      if (!config?.enabled || !config.publicKey) {
        toast.error("Push not configured", { description: "Add VAPID keys on the backend to enable real browser notifications." });
        return;
      }

      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications blocked", { description: "Allow notifications from browser settings to receive alerts." });
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });

      await savePushSubscription(subscription.toJSON());
      toast.success("Push notifications enabled", { description: "Money, room, and creator alerts can now reach this device." });
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Enable push notifications", fallback: "Could not enable push." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setPushLoading(false);
    }
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((item) => (item._id === notification._id ? { ...item, read: true } : item)),
      );

      try {
        await markNotificationRead(notification._id);
      } catch {
        setNotifications((prev) =>
          prev.map((item) => (item._id === notification._id ? { ...item, read: false } : item)),
        );
      }
    }

    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  return (
    <div className="arena-shell min-h-screen pb-20">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="arena-focus grid h-10 w-10 place-items-center rounded-full border border-glass-border bg-card/85"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="font-heading text-xl font-bold">Notifications</h1>
        </div>
        <button onClick={handleMarkAllRead} className="arena-focus ml-auto rounded-md px-2 py-1 text-xs text-primary font-heading hover:bg-primary/10">
          Mark all read
        </button>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 space-y-3">
        <GlassCard className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold">Device notifications</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Receive wallet, creator, and room alerts even when the app is closed.
            </p>
          </div>
          <button
            onClick={enablePushNotifications}
            disabled={pushLoading}
            className="shrink-0 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-heading text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
          >
            {pushLoading ? "Enabling" : "Enable"}
          </button>
        </GlassCard>

        {loading && [0, 1, 2].map((item) => (
          <GlassCard key={item}>
            <div className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-2.5 w-4/5 rounded bg-muted" />
                <div className="h-2 w-20 rounded bg-muted" />
              </div>
            </div>
          </GlassCard>
        ))}

        {!loading && error && (
          <GlassCard className="text-center py-10">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load notifications</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button onClick={loadNotifications} className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-heading">
              <RefreshCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && notifications.length === 0 && (
          <GlassCard className="text-center py-10">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You are all caught up.</p>
          </GlassCard>
        )}

        {!loading && !error && notifications.map((n, i) => {
          const Icon = iconMap[n.type] ?? Megaphone;
          return (
          <GlassCard key={n._id} delay={i * 0.08} className={!n.read ? "neon-border cursor-pointer" : "cursor-pointer"} onClick={() => handleOpenNotification(n)}>
            <div className="flex gap-3">
              <div className={`w-9 h-9 rounded-full glass flex items-center justify-center shrink-0 ${!n.read ? "neon-glow-purple" : ""}`}>
                <Icon className={`w-4 h-4 ${iconColorMap[n.type] ?? iconColorMap.system}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-heading text-xs font-bold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                    {n.title}
                  </p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5 line-clamp-2">{n.body}</p>
                {n.type === "room" && (n.data?.roomId || n.data?.roomPass) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {n.data?.roomId && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyValue("Room ID", n.data?.roomId);
                        }}
                        className="rounded-md border border-secondary/30 bg-secondary/10 px-2 py-1 text-[10px] font-heading text-secondary hover:bg-secondary/20"
                      >
                        Copy Room ID: {String(n.data.roomId)}
                      </button>
                    )}
                    {n.data?.roomPass && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyValue("Password", n.data?.roomPass);
                        }}
                        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-heading text-primary hover:bg-primary/20"
                      >
                        Copy Pass: {String(n.data.roomPass)}
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </GlassCard>
        )})}
      </div>

    </div>
  );
};

export default NotificationsScreen;
