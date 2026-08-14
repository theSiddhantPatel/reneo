import { useAuth } from "../contexts/AuthContext";

function SellerDashboard() {
  const { profile } = useAuth();

  return (
    <div>
      <h1>Seller Dashboard</h1>

      <p>Welcome, {profile?.name}</p>

      <button>Create Product</button>
    </div>
  );
}

export default SellerDashboard;
