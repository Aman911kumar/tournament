import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Bell, Megaphone, RefreshCcw, Swords, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import BottomNav from "@/components/BottomNav";
import { toast } from "@/components/ui/sonner";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "@/api/notifications";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";

const iconColorMap: Record<string, string> = {
  match_update: "text-destructive",
  payment: "text-accent",
  system: "text-neon-pink",
};

const iconMap = {
  match_update: Swords,
  payment: Wallet,
  system: Megaphone,
};

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotifications(await getNotifications());
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load notifications."));
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

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (notification.read) return;

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
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="font-heading text-xl font-bold">Notifications</h1>
        </div>
        <button onClick={handleMarkAllRead} className="ml-auto text-xs text-primary font-heading hover:underline">
          Mark all read
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
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
                <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </GlassCard>
        )})}
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsScreen;
