import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type PublicRouteProps = {
  children: React.ReactNode;
};

export default function PublicRoute({ children }: PublicRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading Reneo Live...</p>
      </div>
    );
  }

  // If already authenticated, redirect to their role-based home
  if (user && profile) {
    return <Navigate to={profile.role === "seller" ? "/seller" : "/customer"} replace />;
  }

  return <>{children}</>;
}
