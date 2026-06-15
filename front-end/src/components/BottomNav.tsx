import { Home, MessageCircle, Search, Trophy, Wallet, User } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { getDmUnreadCount } from "@/api/dm";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/identity";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { prefetchOnIntent, prefetchRoute } from "@/lib/route-prefetch";
import { getDmSocket } from "@/lib/dm-socket";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/tournaments", icon: Trophy, label: "Tournaments" },
  { path: "/subscriptions", icon: Search, label: "Channels" },
  { path: "/messages", icon: MessageCircle, label: "DMs" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useCurrentProfile();
  const { data: unread } = useQuery({
    queryKey: ["dm", "unread-count"],
    queryFn: getDmUnreadCount,
    staleTime: 20_000,
  });

  useEffect(() => {
    const socket = getDmSocket();
    if (!socket) return;
    const handleUnread = (payload: { count: number }) => {
      queryClient.setQueryData(["dm", "unread-count"], payload);
    };
    socket.on("dm:unread", handleUnread);
    return () => {
      socket.off("dm:unread", handleUnread);
    };
  }, [queryClient]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-glass-border bg-[#0D1117] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-[3.25rem] max-w-[560px] grid-cols-6 px-1 min-[380px]:h-14">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              {...prefetchOnIntent(() => prefetchRoute(tab.path))}
              className={cn(
                "arena-focus relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm px-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-[#161B22] hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-0.5 w-7 -translate-x-1/2 bg-primary" />
              )}
              {tab.path === "/profile" && profile ? (
                <UserAvatar
                  user={profile}
                  size="xs"
                  className="ring-1 ring-primary/25 transition-transform"
                />
              ) : (
                <tab.icon className="h-[18px] w-[18px] transition-colors" />
              )}
              {tab.path === "/messages" && (unread?.count || 0) > 0 && (
                <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-heading text-[9px] font-bold text-primary-foreground">
                  {(unread?.count || 0) > 9 ? "9+" : unread?.count}
                </span>
              )}
              <span className="max-w-full truncate font-heading text-[8px] font-bold uppercase leading-none tracking-[0.04em] transition-colors min-[380px]:text-[9px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
