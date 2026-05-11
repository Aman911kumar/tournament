import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { clearAuthTokens } from "@/lib/auth-storage";
import { closeNotificationSocket } from "@/lib/notification-socket";
import { setClerkSignOutHandler, setClerkTokenGetter } from "@/lib/clerk-session";

const ClerkSessionBridge = () => {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setClerkTokenGetter(null);
      setClerkSignOutHandler(null);
      closeNotificationSocket();
      return;
    }

    setClerkTokenGetter(() => getToken());
    setClerkSignOutHandler(async () => {
      await signOut();
      clearAuthTokens();
      closeNotificationSocket();
    });

    return () => {
      setClerkTokenGetter(null);
      setClerkSignOutHandler(null);
    };
  }, [getToken, isLoaded, isSignedIn, signOut]);

  return null;
};

export default ClerkSessionBridge;

