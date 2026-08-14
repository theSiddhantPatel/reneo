import { useAuth } from "../contexts/AuthContext";

function CustomerHome() {
  const { profile } = useAuth();

  return (
    <div>
      <h1>Customer Home</h1>

      <p>Welcome, {profile?.name}</p>

      <h2>Live Sessions</h2>
    </div>
  );
}

export default CustomerHome;
