import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { Product } from "../types/product";

type EditProductModalProps = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: (updatedProduct: Product) => void;
};

export default function EditProductModal({
  product,
  isOpen,
  onClose,
  onProductUpdated,
}: EditProductModalProps) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || "");
      setPrice(product.price.toString());
      setStock(product.stock.toString());
      setStatus(product.status || "active");
      setPreviewUrl(product.image_url || null);
      setImage(null);
      setError("");
      setSuccess("");
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in.");
      return;
    }

    if (!name.trim()) {
      setError("Product title is required.");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError("Price must be a valid non-negative number.");
      return;
    }

    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setError("Stock must be a valid non-negative integer.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let finalImageUrl = product.image_url;

      // If seller uploaded a new image, upload to Supabase storage
      if (image) {
        const fileExt = image.name.split(".").pop() || "jpg";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, image);

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      const updatedPayload = {
        name: name.trim(),
        description: description.trim(),
        price: numPrice,
        stock: numStock,
        status: status,
        image_url: finalImageUrl,
      };

      const { data, error: updateError } = await supabase
        .from("products")
        .update(updatedPayload)
        .eq("id", product.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setSuccess("Product updated successfully!");
      if (data) {
        onProductUpdated(data);
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error("Failed to update product:", err);
      setError(err instanceof Error ? err.message : "Failed to update product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog edit-product-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Edit Product</h3>
            <p className="subtitle" style={{ fontSize: "0.82rem", marginTop: 2 }}>
              Update product details, pricing, stock, and imagery.
            </p>
          </div>
          <button onClick={onClose} className="btn-close-modal" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body edit-product-modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="form-group">
              <label htmlFor="edit-name">Product Name *</label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Handmade Ceramic Mug"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-description">Description</label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe your product's key features, dimensions, or materials..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-price">Price ($) *</label>
                <input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-stock">Stock Units *</label>
                <input
                  id="edit-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="active">Active (Available for live streams)</option>
                <option value="draft">Draft (Hidden from streams)</option>
                <option value="archived">Archived (Delisted)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-image">Replace Product Image (Optional)</label>
              <div className="edit-image-preview-row">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="edit-image-thumb"
                  />
                ) : (
                  <div className="edit-image-placeholder">📦</div>
                )}
                <input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
