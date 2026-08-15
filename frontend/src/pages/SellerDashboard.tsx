import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Product } from "../types/product";
import CreateProductForm from "../components/CreateProductForm";

function SellerDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const handleGoLive = async (productId: string) => {
    if (!user) {
      alert("You must be logged in to go live.");
      return;
    }

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        host_id: user.id,
        product_id: productId,
        status: "live",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to start live:", error);
      alert("Failed to start live session.");
      return;
    }

    console.log("Live session created:", data);
    navigate(`/live/${data.live_id}`);
  };

  async function fetchProducts() {
    if (!profile) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", profile.id);

    if (error) {
      console.error("Failed to fetch products:", error);
      setLoading(false);
      return;
    }

    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, [profile]);

  return (
    <div>
      <h1>Seller Dashboard</h1>

      <p>Welcome, {profile?.name}</p>

      <CreateProductForm onProductCreated={fetchProducts} />

      <h2>My Products</h2>

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        products.map((product) => (
          <div key={product.id}>
            {product.image_url && (
              <img src={product.image_url} alt={product.name} width={300}></img>
            )}

            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p>Price: ${product.price}</p>
            <p>Stock: {product.stock}</p>
            <button onClick={() => handleGoLive(product.id)}>Go Live</button>
          </div>
        ))
      )}
    </div>
  );
}

const {
  data: { session },
} = await supabase.auth.getSession();

console.log(session?.access_token);

export default SellerDashboard;
