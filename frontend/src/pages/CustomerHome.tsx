import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

function CustomerHome() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }
  //   if (!profile) {
  //     alert("you have to login first");

  //     return <Navigate to={"/login"} replace />;
  //   }
  return (
    <div>
      <h1>Customer Home</h1>

      <p>Welcome, {profile?.name}</p>

      <h2>Live Sessions</h2>
    </div>
  );
}

export default CustomerHome;
