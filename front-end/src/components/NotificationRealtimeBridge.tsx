import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import type { NotificationItem } from "@/api/notifications";
import { getNotificationSocket } from "@/lib/notification-socket";

const NotificationRealtimeBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;

    const handleNewNotification = (notification: NotificationItem) => {
      toast.info(notification.title, {
        description: notification.body,
        action: notification.actionUrl
          ? {
              label: "Open",
              onClick: () => navigate(notification.actionUrl!),
            }
          : undefined,
      });
    };

    socket.on("notification:new", handleNewNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [navigate]);

  return null;
};

export default NotificationRealtimeBridge;
