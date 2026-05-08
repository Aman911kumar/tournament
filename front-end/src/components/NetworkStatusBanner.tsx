import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

const NetworkStatusBanner = () => {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed left-3 right-3 top-3 z-[80] mx-auto flex max-w-2xl items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/95 px-3 py-2 text-xs font-heading font-semibold text-destructive-foreground shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="min-w-0">You are offline. Some data may be saved or delayed.</span>
    </div>
  );
};

export default NetworkStatusBanner;
