import { Navigate, useLocation } from "react-router-dom";
import { hasAuthSession } from "@/lib/auth-storage";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const isAuthenticated = () => hasAuthSession();

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
