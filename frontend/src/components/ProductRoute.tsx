import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type ProtectedRouteProps = {
  allowedRole: "seller" | "customer";
  children: React.ReactNode;
};

function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  // AuthContext is still checking the session
  if (loading) {
    return <p>Loading...</p>;
  }

  // User is not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Profile hasn't been loaded
  if (!profile) {
    return <p>Loading profile...</p>;
  }

  // User has the wrong role
  if (profile.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
