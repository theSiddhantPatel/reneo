import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type UserRole = "seller" | "customer";

type ProtectedRouteProps = {
  allowedRole: UserRole | UserRole[];
  children: React.ReactNode;
};

function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  // AuthContext is still checking the session
  if (loading) {
    return <p>Loading...</p>;
  }

  // User is not logged in
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Check whether the user's role is allowed
  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

  if (!allowedRoles.includes(profile.role)) {
    console.log("You are not allowed");
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
