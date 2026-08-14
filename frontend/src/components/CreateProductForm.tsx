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

    if (!name || !price || !stock) {
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
      const fileExtension = image.name.split(".").pop();

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
        name,
        description,
        price: Number(price),
        stock: Number(stock),
        image_url: publicUrl,
      });

      if (productError) {
        // If product creation fails after image upload,
        // remove the uploaded image.
        await supabase.storage.from("product-images").remove([filePath]);

        throw productError;
      }

      setName("");
      setDescription("");
      setPrice("");
      setStock("");
      setImage(null);

      setSuccess("Product created successfully.");

      onProductCreated();
    } catch (error) {
      console.error("Product creation failed:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to create product.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Product</h2>

      <div>
        <label>Name</label>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div>
        <label>Description</label>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div>
        <label>Price</label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>

      <div>
        <label>Stock</label>

        <input
          type="number"
          min="0"
          value={stock}
          onChange={(event) => setStock(event.target.value)}
        />
      </div>

      <div>
        <label>Product Image</label>

        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setImage(file);
          }}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Product"}
      </button>

      {error && <p>{error}</p>}
      {success && <p>{success}</p>}
    </form>
  );
}

export default CreateProductForm;
