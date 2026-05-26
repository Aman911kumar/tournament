import { Home, Search, Trophy, Wallet, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/identity";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/tournaments", icon: Trophy, label: "Tournaments" },
  { path: "/subscriptions", icon: Search, label: "Channels" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-[#10151D] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-[520px] grid-cols-5 px-1">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "arena-focus relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-[#161B22] hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 bg-primary" />
              )}
              {tab.path === "/profile" && profile ? (
                <UserAvatar
                  user={profile}
                  size="xs"
                  className="ring-1 ring-white/10 transition-transform"
                />
              ) : (
                <tab.icon className="h-5 w-5 transition-colors" />
              )}
              <span className="max-w-full truncate font-heading text-[9px] font-bold uppercase leading-none tracking-[0.06em] transition-colors min-[380px]:text-[10px]">
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
