import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type CreateProductFormProps = {
  onProductCreated: () => void;
};

function CreateProductForm({ onProductCreated }: CreateProductFormProps) {
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!user) {
      setError("You must be logged in.");
      return;
    }

    if (!profile || profile.role !== "seller") {
      setError("You are not a seller and cannot create products.");
      return;
    }

    if (!name.trim() || !price || !stock) {
      setError("Name, price and stock are required.");
      return;
    }

    if (!image) {
      setError("Please select a product image.");
      return;
    }

    setLoading(true);

    try {
      // Create a unique file name
      const fileExtension = image.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${fileExtension}`;

      // Store image inside seller's own folder
      const filePath = `${user.id}/${fileName}`;

      // Upload image
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, image);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      // Create product
      const { error: productError } = await supabase.from("products").insert({
        seller_id: user.id,
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        image_url: publicUrl,
      });

      if (productError) {
        // If product creation fails after image upload, remove the uploaded image.
        await supabase.storage.from("product-images").remove([filePath]);
        throw productError;
      }

      setName("");
      setDescription("");
      setPrice("");
      setStock("");
      setImage(null);

      setSuccess("Product created successfully!");
      onProductCreated();
    } catch (err) {
      console.error("Product creation failed:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create product.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Add New Product</h2>
      <p className="form-subtitle">Create a product to feature in your live broadcast.</p>

      <form onSubmit={handleSubmit} className="stack-form">
        <div className="form-group">
          <label htmlFor="prod-name">Product Name *</label>
          <input
            id="prod-name"
            type="text"
            placeholder="e.g. Handmade Silk Scarf"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="prod-desc">Description</label>
          <textarea
            id="prod-desc"
            rows={3}
            placeholder="Key features, materials, sizes..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="prod-price">Price ($) *</label>
            <input
              id="prod-price"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="29.99"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="prod-stock">Stock Quantity *</label>
            <input
              id="prod-stock"
              type="number"
              min="0"
              placeholder="10"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="prod-image">Product Image *</label>
          <input
            id="prod-image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImage(file);
            }}
            required
          />
        </div>

        <button type="submit" className="btn-primary btn-block" disabled={loading}>
          {loading ? "Uploading & Creating..." : "Create Product"}
        </button>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
      </form>
    </div>
  );
}

export default CreateProductForm;
