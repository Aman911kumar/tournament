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
    const handleChatNotification = (payload: { tournamentId: string; message: { body?: string; sender?: { username?: string } | null; type?: string } }) => {
      if ([`/tournament/${payload.tournamentId}/comments`, `/tournament/${payload.tournamentId}/chat`].includes(window.location.pathname)) return;
      const sender = payload.message.sender?.username || "Room chat";
      const body = payload.message.body || (payload.message.type === "image" ? "Sent an image" : "Sent a file");
      toast.info(sender, {
        description: body,
        action: {
          label: "Open",
          onClick: () => navigate(`/tournament/${payload.tournamentId}/chat`),
        },
      });
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("chat:notify", handleChatNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("chat:notify", handleChatNotification);
    };
  }, [navigate]);

  return null;
};

export default NotificationRealtimeBridge;
