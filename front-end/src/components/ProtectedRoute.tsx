import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { hasAuthSession } from "@/lib/auth-storage";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const isAuthenticated = () => hasAuthSession();

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const hasLegacySession = hasAuthSession();

  if (!isLoaded && !hasLegacySession) {
    return (
      <div className="arena-shell min-h-screen px-4 pt-8">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="h-6 w-36 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!isSignedIn && !hasLegacySession) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
