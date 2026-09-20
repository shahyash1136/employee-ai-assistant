import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/api";

interface ProtectedRouteProps {
  // If given, the user's role must be one of these. UX only — the API still
  // enforces its own requireRole() on every call.
  roles?: UserRole[];
}

// The single place that answers "logged in?" and "allowed?" for routes;
// pages assume they're only rendered once both are true.
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/chat" replace />;
  }
  return <Outlet />;
}
