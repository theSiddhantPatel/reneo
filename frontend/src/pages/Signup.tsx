import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";
import SignInWithGoogle from "../components/SignInWithGoogle";

type Role = "seller" | "customer";
type AvatarMode = "random" | "upload" | "url";

function calculatePasswordStrength(pass: string): {
  score: number;
  label: "Too Weak" | "Weak" | "Medium" | "Strong";
  colorClass: "weak" | "medium" | "strong";
  feedback: string;
} {
  if (!pass) {
    return { score: 0, label: "Too Weak", colorClass: "weak", feedback: "Enter at least 8 characters" };
  }

  const isRepetitive = /^(.)\1+$/.test(pass);
  const isCommonTrivial = ["123456", "12345678", "password", "qwerty", "111111", "admin123"].includes(
    pass.toLowerCase(),
  );

  if (isRepetitive || isCommonTrivial) {
    return {
      score: 1,
      label: "Weak",
      colorClass: "weak",
      feedback: "Avoid simple repetitive characters or common words",
    };
  }

  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) {
    return { score: 1, label: "Weak", colorClass: "weak", feedback: "Use at least 8 characters with mixed letters & numbers" };
  }
  if (score === 2 || score === 3) {
    return { score: 2, label: "Medium", colorClass: "medium", feedback: "Good! Add symbols or uppercase for extra security" };
  }
  return { score: 4, label: "Strong", colorClass: "strong", feedback: "Great! Strong, secure password" };
}

function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file (PNG, JPG, WebP, etc.)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 240;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Could not process the selected image."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file from device."));
    reader.readAsDataURL(file);
  });
}

function Signup() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");

  // Avatar states
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("random");
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [uploadedAvatar, setUploadedAvatar] = useState("");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Compute active avatar source
  const currentAvatar = useMemo(() => {
    if (avatarMode === "upload" && uploadedAvatar) {
      return uploadedAvatar;
    }
    if (avatarMode === "url" && customAvatarUrl.trim()) {
      return customAvatarUrl.trim();
    }
    const seed = name.trim() || avatarSeed;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
  }, [avatarMode, uploadedAvatar, customAvatarUrl, name, avatarSeed]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError("");
      const processed = await processAvatarFile(file);
      setUploadedAvatar(processed);
      setAvatarMode("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image file.");
    }
  };

  const handleRandomize = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
    setAvatarMode("random");
  };

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setError("");

    // Client-side password security validation
    if (password.length < 8) {
      setError("For security, your password must be at least 8 characters long.");
      return;
    }

    if (/^(.)\1+$/.test(password) || ["111111", "123456", "password"].includes(password.toLowerCase())) {
      setError("Please choose a stronger password. Avoid repetitive digits or simple sequences.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            role,
            avatar: currentAvatar,
          },
        },
      });

      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes("already registered") ||
          signUpError.message.toLowerCase().includes("already exists") ||
          signUpError.message.toLowerCase().includes("user already exists")
        ) {
          setError("An account with this email already exists. Please log in.");
          return;
        }
        throw signUpError;
      }

      // Supabase returns an empty identities array when the user email already exists
      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setError("An account with this email already exists. Please log in.");
        return;
      }

      if (data.session && data.user) {
        // Direct profile upsert as a guarantee
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            name: name.trim(),
            role,
            avatar: currentAvatar,
          });
        } catch (profileErr) {
          console.warn("Direct profile upsert error:", profileErr);
        }
        navigate("/");
      } else {
        setMessage("Account created successfully! You can now log in.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="brand-badge">Reneo Live</div>
            <h1>Create Account</h1>
            <p>Join as a Seller or a Customer</p>
          </div>

          <form onSubmit={handleSignup} className="auth-form">
            {/* Avatar Selector Component */}
            <div className="avatar-picker-section" style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "1.5rem",
              gap: "0.75rem",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              <div
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload an image from your PC"
              >
                <img
                  src={currentAvatar}
                  alt="Avatar Preview"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || "fallback")}`;
                  }}
                  style={{
                    width: "84px",
                    height: "84px",
                    borderRadius: "50%",
                    border: "3px solid #6366f1",
                    backgroundColor: "#1e1e2e",
                    objectFit: "cover",
                    boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)",
                    display: "block"
                  }}
                />
                <div style={{
                  position: "absolute",
                  bottom: "0",
                  right: "0",
                  background: "#6366f1",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  color: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)"
                }}>
                  📷
                </div>
              </div>

              {/* Mode Toggle Buttons */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={avatarMode === "upload" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  📁 Upload from PC
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarMode(avatarMode === "url" ? "random" : "url")}
                  className={avatarMode === "url" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  🔗 Paste Link
                </button>
                <button
                  type="button"
                  onClick={handleRandomize}
                  className={avatarMode === "random" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  🎲 Randomize
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />

              {/* URL input field when "Paste Link" is active */}
              {avatarMode === "url" && (
                <div style={{ width: "100%", marginTop: "4px" }}>
                  <input
                    type="url"
                    placeholder="https://example.com/photo.png"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    style={{ width: "100%", fontSize: "0.85rem", padding: "8px 12px" }}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="e.g. Siddhant Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                minLength={5}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                placeholder="At least 8 characters (mixed letters & numbers)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />

              {/* Real-time Password Strength Indicator */}
              {password.length > 0 && (
                <div className="password-strength-container">
                  <div className="password-strength-bars">
                    <div
                      className={`password-strength-bar ${strength.score >= 1 ? `active-${strength.colorClass}` : ""
                        }`}
                    />
                    <div
                      className={`password-strength-bar ${strength.score >= 2 ? `active-${strength.colorClass}` : ""
                        }`}
                    />
                    <div
                      className={`password-strength-bar ${strength.score >= 3 ? `active-${strength.colorClass}` : ""
                        }`}
                    />
                    <div
                      className={`password-strength-bar ${strength.score >= 4 ? `active-${strength.colorClass}` : ""
                        }`}
                    />
                  </div>
                  <div className="password-strength-label">
                    <span>Password Strength:</span>
                    <span className={`password-strength-text ${strength.colorClass}`}>
                      {strength.label}
                    </span>
                  </div>
                  <p className="password-hints">{strength.feedback}</p>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="signup-role">Account Type</label>
              <select
                id="signup-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="customer">Customer (Watch streams & buy)</option>
                <option value="seller">Seller (Broadcast & create products)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {message && <div className="alert alert-success" style={{ marginTop: 16 }}>{message}</div>}
          {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

          <div className="auth-divider">
            <span>or</span>
          </div>

          <SignInWithGoogle
            role={role}
            text={`Sign up as ${role === "seller" ? "Seller" : "Customer"} with Google`}
            onError={(msg) => setError(msg)}
          />

          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
