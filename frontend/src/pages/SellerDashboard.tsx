import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Product } from "../types/product";
import CreateProductForm from "../components/CreateProductForm";
import EditProductModal from "../components/EditProductModal";
import StockAdjuster from "../components/StockAdjuster";
import Navbar from "../components/Navbar";
import { startLiveSession } from "../lib/liveApi";

function SellerDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingLiveId, setStartingLiveId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
    setActionSuccess("");
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

  const handleUpdateStock = async (productId: string, newStock: number) => {
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    );

    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);

    if (error) {
      console.error("Failed to update product stock:", error);
      setActionError(`Could not update stock: ${error.message}`);
      fetchProducts();
      return false;
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleProductUpdated = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setActionSuccess(`Successfully updated "${updatedProduct.name}"!`);
    setTimeout(() => setActionSuccess(""), 4000);
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${product.name}"?\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setActionError("");
    setActionSuccess("");

    try {
      const { error: deleteErr } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (deleteErr) {
        // If product is referenced in past live sessions, offer archival
        if (
          deleteErr.message.includes("violates foreign key constraint") ||
          (deleteErr as any).code === "23503"
        ) {
          const archiveConfirm = window.confirm(
            `"${product.name}" has been featured in past live broadcast records and cannot be permanently deleted.\n\nWould you like to Archive it instead so it is hidden from future live streams?`
          );
          if (archiveConfirm) {
            const { error: archiveErr } = await supabase
              .from("products")
              .update({ status: "archived" })
              .eq("id", product.id);

            if (archiveErr) throw archiveErr;

            setProducts((prev) =>
              prev.map((p) =>
                p.id === product.id ? { ...p, status: "archived" } : p
              )
            );
            setActionSuccess(`Archived "${product.name}".`);
            setTimeout(() => setActionSuccess(""), 4000);
            return;
          }
          return;
        }
        throw deleteErr;
      }

      // Optimistically remove from state
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setActionSuccess(`Removed "${product.name}".`);
      setTimeout(() => setActionSuccess(""), 4000);

      // Clean up uploaded image if in product-images storage
      if (product.image_url && product.image_url.includes("product-images")) {
        try {
          const urlParts = product.image_url.split("/product-images/");
          if (urlParts.length > 1) {
            const storagePath = decodeURIComponent(urlParts[1]);
            await supabase.storage.from("product-images").remove([storagePath]);
          }
        } catch {
          // Ignore background storage cleanup error
        }
      }
    } catch (err) {
      console.error("Failed to delete product:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to delete product."
      );
    } finally {
      setDeletingProductId(null);
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
              Welcome back, <strong>{profile?.name}</strong>. Manage your inventory, edit products, and launch live commerce broadcasts.
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
        {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

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
                    <div className="product-card-top-bar">
                      {product.status && product.status !== "active" && (
                        <span className={`status-badge-mini status-${product.status}`}>
                          {product.status}
                        </span>
                      )}
                      <div className="product-card-actions">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="btn-card-icon-action"
                          title="Edit product name, description, price, stock or image"
                          aria-label="Edit product"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          disabled={deletingProductId === product.id}
                          className="btn-card-icon-action btn-card-icon-delete"
                          title="Remove product"
                          aria-label="Remove product"
                        >
                          {deletingProductId === product.id ? "⏳" : "🗑️"}
                        </button>
                      </div>
                    </div>

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
                          {product.stock < 1 ? "Out of stock" : `${product.stock} units`}
                        </span>
                      </div>

                      {/* Interactive Stock Adjuster */}
                      <div className="product-stock-control-row">
                        <span className="stock-label">Stock:</span>
                        <StockAdjuster
                          productId={product.id}
                          currentStock={product.stock}
                          onStockChange={handleUpdateStock}
                          size="sm"
                          showQuickAdd={true}
                        />
                      </div>

                      <div className="product-card-footer-actions">
                        <button
                          onClick={() => handleGoLive(product.id)}
                          disabled={startingLiveId === product.id || product.stock < 1 || product.status === "archived"}
                          className="btn-primary btn-block btn-golive"
                        >
                          {startingLiveId === product.id
                            ? "Starting Stream..."
                            : product.status === "archived"
                              ? "Archived"
                              : product.stock < 1
                                ? "Out of Stock"
                                : "🔴 GO LIVE"}
                        </button>
                      </div>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h4>{product.name}</h4>
                        {product.status && product.status !== "active" && (
                          <span className={`status-badge-mini status-${product.status}`}>
                            {product.status}
                          </span>
                        )}
                      </div>
                      <p>{product.description || "No description"}</p>
                    </div>

                    <div className="product-list-price">
                      <span>${product.price}</span>
                    </div>

                    <div className="product-list-stock">
                      <StockAdjuster
                        productId={product.id}
                        currentStock={product.stock}
                        onStockChange={handleUpdateStock}
                        size="sm"
                        showQuickAdd={true}
                      />
                    </div>

                    <div className="product-list-action">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="btn-secondary btn-sm"
                        title="Edit product"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        className="btn-danger-outline btn-sm"
                        title="Remove product"
                      >
                        {deletingProductId === product.id ? "..." : "🗑️"}
                      </button>
                      <button
                        onClick={() => handleGoLive(product.id)}
                        disabled={startingLiveId === product.id || product.stock < 1 || product.status === "archived"}
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

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProductUpdated={handleProductUpdated}
      />
    </div>
  );
}

export default SellerDashboard;
