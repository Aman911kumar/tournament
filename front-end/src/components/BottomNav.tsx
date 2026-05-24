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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-glass-border bg-[linear-gradient(180deg,hsl(var(--card)/0.98)_0%,hsl(var(--background))_100%)] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_20px_hsl(var(--background)/0.36)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "arena-focus relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="absolute -top-1 left-0 right-0 mx-auto h-0.5 w-7 rounded-full gradient-primary" />
              )}
              {tab.path === "/profile" && profile ? (
                <UserAvatar
                  user={profile}
                  size="xs"
                  className="transition-transform"
                />
              ) : (
                <tab.icon className="h-[18px] w-[18px] transition-colors" />
              )}
              <span className="max-w-full truncate text-[9px] font-heading font-semibold transition-colors min-[380px]:text-[10px]">
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
