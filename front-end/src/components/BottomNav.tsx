import { Home, Search, Trophy, Wallet, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-glass-border bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_44px_hsl(var(--background)/0.65)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "arena-focus relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-2 left-0 right-0 mx-auto h-1 w-8 rounded-full gradient-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                className="h-5 w-5 transition-colors"
              />
              <span
                className="text-[10px] font-heading font-semibold transition-colors"
              >
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
