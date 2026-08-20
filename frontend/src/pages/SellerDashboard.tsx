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

  // UI States: Foldable Inventory, Search, Form Accordion, View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [isInventoryFolded, setIsInventoryFolded] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");

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

  // Filtered and Folded Products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description &&
        product.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (stockFilter === "in_stock") return product.stock > 0;
    if (stockFilter === "out_of_stock") return product.stock < 1;
    return true;
  });

  // Show first 4 items when folded and user has not searched
  const displayedProducts =
    isInventoryFolded && !searchQuery && stockFilter === "all"
      ? filteredProducts.slice(0, 4)
      : filteredProducts;

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
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={`btn-sm ${isFormOpen ? "btn-secondary" : "btn-primary"}`}
          >
            {isFormOpen ? "Hide Product Form ▲" : "+ Add New Product ▼"}
          </button>
        </div>

        {actionError && <div className="alert alert-error">{actionError}</div>}

        <div className="dashboard-grid">
          {/* Collapsible Form Section */}
          {isFormOpen && (
            <section className="form-card card">
              <CreateProductForm onProductCreated={fetchProducts} />
            </section>
          )}

          {/* Product Inventory Section */}
          <section className={`inventory-section ${!isFormOpen ? "inventory-section-full" : ""}`}>
            <div className="inventory-header-bar">
              <div className="section-header-left">
                <h2>Your Products ({filteredProducts.length})</h2>
                {products.length > 4 && (
                  <button
                    onClick={() => setIsInventoryFolded(!isInventoryFolded)}
                    className="btn-fold-toggle"
                    title={isInventoryFolded ? "Expand all products" : "Fold products"}
                  >
                    {isInventoryFolded
                      ? `▼ Show All (${products.length})`
                      : "▲ Compact View (4)"}
                  </button>
                )}
              </div>

              {/* Search, Filter & View Controls */}
              <div className="inventory-controls">
                <input
                  type="text"
                  placeholder="🔍 Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="inventory-search-input"
                />

                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="inventory-filter-select"
                >
                  <option value="all">All Stock</option>
                  <option value="in_stock">In Stock ({products.filter(p => p.stock > 0).length})</option>
                  <option value="out_of_stock">Out of Stock ({products.filter(p => p.stock < 1).length})</option>
                </select>

                <div className="view-mode-toggle">
                  <button
                    className={`btn-view-mode ${viewMode === "grid" ? "active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    title="Grid View"
                  >
                    ⊞
                  </button>
                  <button
                    className={`btn-view-mode ${viewMode === "list" ? "active" : ""}`}
                    onClick={() => setViewMode("list")}
                    title="Compact List View"
                  >
                    ☰
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="empty-state card">
                <div className="spinner"></div>
                <p>Loading inventory...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-icon">📦</div>
                <h3>{searchQuery ? "No Matching Products Found" : "No Products Created Yet"}</h3>
                <p>
                  {searchQuery
                    ? "Try clearing your search or filter to see all items."
                    : "Use the form to add your first product with an image and stock."}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStockFilter("all");
                    }}
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 12 }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="products-grid">
                {displayedProducts.map((product) => (
                  <div key={product.id} className="product-card card">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-card-img"
                      />
                    ) : (
                      <div className="product-card-placeholder">📦</div>
                    )}
                    <div className="product-card-body">
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-desc">{product.description || "No description provided."}</p>
                      <div className="product-meta">
                        <span className="price-tag">${product.price}</span>
                        <span className={`stock-tag ${product.stock < 1 ? "stock-out" : product.stock < 5 ? "stock-low" : ""}`}>
                          {product.stock < 1 ? "Out of stock" : `${product.stock} in stock`}
                        </span>
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
            ) : (
              /* Compact List / Table View */
              <div className="products-list-card card">
                {displayedProducts.map((product) => (
                  <div key={product.id} className="product-list-item">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-list-thumb"
                      />
                    ) : (
                      <div className="product-list-placeholder">📦</div>
                    )}

                    <div className="product-list-details">
                      <h4>{product.name}</h4>
                      <p>{product.description || "No description"}</p>
                    </div>

                    <div className="product-list-price">
                      <span>${product.price}</span>
                    </div>

                    <div className="product-list-stock">
                      <span className={`stock-tag ${product.stock < 1 ? "stock-out" : product.stock < 5 ? "stock-low" : ""}`}>
                        {product.stock < 1 ? "Out of Stock" : `${product.stock} units`}
                      </span>
                    </div>

                    <div className="product-list-action">
                      <button
                        onClick={() => handleGoLive(product.id)}
                        disabled={startingLiveId === product.id || product.stock < 1}
                        className="btn-primary btn-sm btn-golive"
                      >
                        {startingLiveId === product.id ? "..." : "🔴 Go Live"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fold toggle at bottom if list is long */}
            {isInventoryFolded && products.length > 4 && !searchQuery && (
              <div className="fold-expand-banner">
                <p>Showing 4 of {products.length} products</p>
                <button
                  onClick={() => setIsInventoryFolded(false)}
                  className="btn-secondary btn-sm"
                >
                  View All {products.length} Products ▼
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default SellerDashboard;
