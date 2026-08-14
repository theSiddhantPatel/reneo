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
  if (!user || !profile) {
    return (
      <div>
        console.log("you have to login first");
        <p>You have to login first</p>
        <p>Redirecting to login page...</p>
        <Navigate to="/login" replace />;
      </div>
    );
  }

  // Profile hasn't been loaded
  if (!profile) {
    return (
      <div>
        <p>Unable to load your profile</p>
        <p>Please login again</p>
        <p>Loading profile...</p>;
      </div>
    );
  }

  // User has the wrong role
  if (profile.role !== allowedRole) {
    console.log("You are not allowed");
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
