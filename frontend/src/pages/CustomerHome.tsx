import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";
import type { Product } from "../types/product";

interface LiveSessionWithProduct {
  live_id: string;
  host_id: string;
  product_id: string;
  status: "scheduled" | "live" | "ended";
  created_at: string;
  ended_at: string | null;
  products?: Product | null;
  host_name?: string;
}

interface CustomerCartItem {
  id: string;
  product_id: string;
  quantity: number;
  products?: Product | null;
}

function CustomerHome() {
  const { user, profile, loading } = useAuth();
  const [liveSessions, setLiveSessions] = useState<LiveSessionWithProduct[]>([]);
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartFolded, setIsCartFolded] = useState(false);

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + (item.products?.price ?? 0) * item.quantity,
        0,
      ),
    [cartItems],
  );

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return liveSessions;
    const query = searchQuery.toLowerCase();
    return liveSessions.filter(
      (s) =>
        s.products?.name.toLowerCase().includes(query) ||
        s.products?.description?.toLowerCase().includes(query) ||
        s.host_name?.toLowerCase().includes(query),
    );
  }, [liveSessions, searchQuery]);

  async function fetchLiveSessions() {
    setSessionLoading(true);
    setError("");

    try {
      // 1. Fetch live sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("status", "live")
        .order("created_at", { ascending: false });

      if (sessionsError) {
        console.error("Live sessions fetch error:", sessionsError);
        setError("Live sessions could not be loaded. Please try again.");
        setSessionLoading(false);
        return;
      }

      if (!sessions || sessions.length === 0) {
        setLiveSessions([]);
        setSessionLoading(false);
        return;
      }

      // 2. Fetch associated products and hosts
      const productIds = Array.from(new Set(sessions.map((s) => s.product_id)));
      const hostIds = Array.from(new Set(sessions.map((s) => s.host_id)));

      const [productsRes, hostsRes] = await Promise.all([
        supabase.from("products").select("*").in("id", productIds),
        supabase.from("profiles").select("id, name").in("id", hostIds),
      ]);

      const productsMap = new Map(
        (productsRes.data ?? []).map((p) => [p.id, p]),
      );
      const hostsMap = new Map(
        (hostsRes.data ?? []).map((h) => [h.id, h.name]),
      );

      const enrichedSessions: LiveSessionWithProduct[] = sessions.map((s) => ({
        ...s,
        products: productsMap.get(s.product_id) ?? null,
        host_name: hostsMap.get(s.host_id) ?? "Seller",
      }));

      setLiveSessions(enrichedSessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("An unexpected error occurred while loading streams.");
    } finally {
      setSessionLoading(false);
    }
  }

  async function fetchCart() {
    if (!user) {
      setCartLoading(false);
      return;
    }

    setCartLoading(true);
    try {
      const { data: rawItems, error: cartErr } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (cartErr) {
        console.error("Dashboard cart fetch error:", cartErr);
        setCartLoading(false);
        return;
      }

      if (!rawItems || rawItems.length === 0) {
        setCartItems([]);
        setCartLoading(false);
        return;
      }

      const productIds = rawItems.map((i) => i.product_id);
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));

      const enriched: CustomerCartItem[] = rawItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        products: prodMap.get(item.product_id) ?? null,
      }));

      setCartItems(enriched);
    } catch (err) {
      console.error("Dashboard cart load exception:", err);
    } finally {
      setCartLoading(false);
    }
  }

  async function updateCartQuantity(itemId: string, newQuantity: number) {
    if (newQuantity < 1) {
      await removeCartItem(itemId);
      return;
    }

    const currentItem = cartItems.find((i) => i.id === itemId);
    const stockLimit = currentItem?.products?.stock ?? 999;

    if (newQuantity > stockLimit) {
      setCartNotice(
        `Cannot add more. Only ${stockLimit} units available in stock.`,
      );
      setTimeout(() => setCartNotice(""), 4000);
      return;
    }

    // Optimistically update
    setCartItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: newQuantity } : i)),
    );

    const { error: updateErr } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", itemId);

    if (updateErr) {
      console.error("Cart update error:", updateErr);
      setCartNotice(`Cart update failed: ${updateErr.message}`);
      fetchCart();
    }
  }

  async function removeCartItem(itemId: string) {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));

    const { error: deleteErr } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", itemId);

    if (deleteErr) {
      console.error("Cart remove error:", deleteErr);
      setCartNotice(`Remove item failed: ${deleteErr.message}`);
      fetchCart();
    }
  }

  useEffect(() => {
    fetchLiveSessions();
    fetchCart();

    // Subscribe to live_sessions changes
    const sessionChannel = supabase
      .channel("customer-live-sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_sessions",
        },
        () => {
          fetchLiveSessions();
        },
      )
      .subscribe();

    // Subscribe to cart changes
    const cartChannel = supabase
      .channel(`customer-cart-${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchCart();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(cartChannel);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading your account...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Customer Home</h1>
            <p className="subtitle">
              Welcome, <strong>{profile?.name}</strong>. Explore live streams and manage your shopping cart.
            </p>
          </div>
          <button onClick={() => { fetchLiveSessions(); fetchCart(); }} className="btn-secondary btn-sm">
            🔄 Refresh
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {cartNotice && <div className="alert alert-warning">{cartNotice}</div>}

        <div className="dashboard-grid">
          {/* Main Left: Active Live Broadcasts */}
          <section className="streams-section">
            <div className="inventory-header-bar">
              <div className="section-header-left">
                <h2>Active Live Streams ({filteredSessions.length})</h2>
                <span className="live-count-badge">
                  ● {liveSessions.length} {liveSessions.length === 1 ? "Stream" : "Streams"} Live
                </span>
              </div>

              {/* Stream Search Bar */}
              <div className="inventory-controls">
                <input
                  type="text"
                  placeholder="🔍 Search live products, sellers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="inventory-search-input"
                />
              </div>
            </div>

            {sessionLoading ? (
              <div className="empty-state card">
                <div className="spinner"></div>
                <p>Finding live broadcasts...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-icon">📺</div>
                <h3>{searchQuery ? "No Matching Live Streams" : "No Live Streams Right Now"}</h3>
                <p>
                  {searchQuery
                    ? "Try searching for a different product or seller name."
                    : "When a seller goes live, their stream and featured product will appear here automatically."}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 12 }}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="products-grid">
                {filteredSessions.map((session) => {
                  const prod = session.products;
                  const hostName = session.host_name ?? "Verified Seller";

                  return (
                    <div key={session.live_id} className="live-card card">
                      <div className="live-card-media">
                        {prod?.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="live-card-img"
                          />
                        ) : (
                          <div className="live-card-placeholder">Reneo Live</div>
                        )}
                        <span className="badge-live-pulse">🔴 LIVE NOW</span>
                      </div>

                      <div className="live-card-body">
                        <div className="seller-tag">Hosted by {hostName}</div>
                        <h3 className="live-card-title">
                          {prod?.name ?? "Featured Product"}
                        </h3>
                        {prod?.description && (
                          <p className="live-card-desc">{prod.description}</p>
                        )}
                        <div className="live-card-meta">
                          <span className="price-tag">${prod?.price ?? "0.00"}</span>
                          <span className={`stock-tag ${prod && prod.stock < 1 ? "stock-out" : ""}`}>
                            {prod ? `${prod.stock} in stock` : ""}
                          </span>
                        </div>

                        <Link
                          to={`/live/${session.live_id}`}
                          className="btn-primary btn-block btn-join"
                        >
                          Join Live Stream →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Customer's Shopping Cart */}
          <aside className="cart-sidebar">
            <div className="panel-card card">
              <div className="panel-header">
                <h2>Your Shopping Cart</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="cart-total-badge">${cartTotal.toFixed(2)}</span>
                  {cartItems.length > 0 && (
                    <button
                      onClick={() => setIsCartFolded(!isCartFolded)}
                      className="btn-fold-toggle"
                      title={isCartFolded ? "Expand cart" : "Fold cart"}
                    >
                      {isCartFolded ? "▼ Expand" : "▲ Fold"}
                    </button>
                  )}
                </div>
              </div>

              {cartLoading ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <div className="spinner"></div>
                  <p>Loading your cart...</p>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="empty-cart-msg">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                  <p><strong>Your cart is currently empty.</strong></p>
                  <small>Join a live broadcast and click "Add to Cart" to start shopping!</small>
                </div>
              ) : isCartFolded ? (
                <div className="cart-folded-summary">
                  <p>{totalCartCount} items in cart</p>
                  <button onClick={() => setIsCartFolded(false)} className="btn-secondary btn-sm">
                    View Items ({totalCartCount})
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-items-list" style={{ maxHeight: 380 }}>
                    {cartItems.map((item) => {
                      const prod = item.products;
                      const isMaxStock = prod ? item.quantity >= prod.stock : false;

                      return (
                        <div key={item.id} className="cart-item-row">
                          {prod?.image_url && (
                            <img
                              src={prod.image_url}
                              alt={prod.name}
                              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }}
                            />
                          )}
                          <div className="cart-item-info" style={{ flex: 1 }}>
                            <strong>{prod?.name ?? "Product"}</strong>
                            <span className="cart-item-price">
                              ${prod?.price ?? 0} × {item.quantity} = $
                              {((prod?.price ?? 0) * item.quantity).toFixed(2)}
                            </span>
                            {prod && (
                              <small style={{ color: isMaxStock ? "#dc2626" : "#64748b" }}>
                                {isMaxStock
                                  ? `Max limit reached (${prod.stock} available)`
                                  : `${prod.stock} in stock`}
                              </small>
                            )}
                          </div>

                          <div className="cart-item-actions">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="btn-qty"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="cart-qty-num">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              disabled={isMaxStock}
                              className="btn-qty"
                              style={{ opacity: isMaxStock ? 0.4 : 1, cursor: isMaxStock ? "not-allowed" : "pointer" }}
                              title={isMaxStock ? "Max stock reached" : "Increase quantity"}
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeCartItem(item.id)}
                              className="btn-remove-item"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="cart-footer-summary" style={{ marginTop: 16 }}>
                    <div className="cart-subtotal-row" style={{ fontSize: "1.1rem", marginBottom: 12 }}>
                      <span>Subtotal ({totalCartCount} {totalCartCount === 1 ? "item" : "items"}):</span>
                      <strong>${cartTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default CustomerHome;
