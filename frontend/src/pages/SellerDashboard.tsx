import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Product } from "../types/product";
import CreateProductForm from "../components/CreateProductForm";
import Navbar from "../components/Navbar";
import { startLiveSession } from "../lib/liveApi";

function SellerDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingLiveId, setStartingLiveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const handleGoLive = async (productId: string) => {
    if (!user) {
      setActionError("You must be logged in to go live.");
      return;
    }

    setActionError("");
    setStartingLiveId(productId);

    try {
      const liveSession = await startLiveSession(productId);
      navigate(`/live/${liveSession.live_id}`);
    } catch (error) {
      console.error("Failed to start live:", error);
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to start live session. Please check backend connection.",
      );
    } finally {
      setStartingLiveId(null);
    }
  };

  async function fetchProducts() {
    if (!profile) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch products:", error);
      setActionError("Could not load products. Please refresh.");
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
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Seller Dashboard</h1>
            <p className="subtitle">
              Welcome back, <strong>{profile?.name}</strong>. Manage your inventory and launch live commerce broadcasts.
            </p>
          </div>
        </div>

        {actionError && <div className="alert alert-error">{actionError}</div>}

        <div className="dashboard-grid">
          <section className="form-card card">
            <CreateProductForm onProductCreated={fetchProducts} />
          </section>

          <section className="inventory-section">
            <div className="section-header">
              <h2>Your Products ({products.length})</h2>
            </div>

            {loading ? (
              <div className="empty-state card">
                <div className="spinner"></div>
                <p>Loading inventory...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-icon">📦</div>
                <h3>No Products Created Yet</h3>
                <p>Use the form on the left to add your first product with an image and stock.</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card card">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-card-img"
                      />
                    )}
                    <div className="product-card-body">
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-desc">{product.description}</p>
                      <div className="product-meta">
                        <span className="price-tag">${product.price}</span>
                        <span className="stock-tag">{product.stock} units</span>
                      </div>
                      <button
                        onClick={() => handleGoLive(product.id)}
                        disabled={startingLiveId === product.id || product.stock < 1}
                        className="btn-primary btn-block btn-golive"
                      >
                        {startingLiveId === product.id
                          ? "Starting Stream..."
                          : product.stock < 1
                          ? "Out of Stock"
                          : "🔴 GO LIVE"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default SellerDashboard;
