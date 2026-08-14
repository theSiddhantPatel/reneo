import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { product } from "../types/product";
import CreateProductForm from "../components/CreateProductForm";

function SellerDashboard() {
  const { profile } = useAuth();

  const [products, setProducts] = useState<product[]>([]);
  const [loading, setLoading] = useState(true);

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
          </div>
        ))
      )}
    </div>
  );
}

export default SellerDashboard;
