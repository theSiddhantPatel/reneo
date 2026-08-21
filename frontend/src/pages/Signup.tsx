import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";

type Role = "seller" | "customer";

function calculatePasswordStrength(pass: string): {
  score: number;
  label: "Too Weak" | "Weak" | "Medium" | "Strong";
  colorClass: "weak" | "medium" | "strong";
  feedback: string;
} {
  if (!pass) {
    return { score: 0, label: "Too Weak", colorClass: "weak", feedback: "Enter at least 8 characters" };
  }

  // Trivial repetitive/sequential pattern check (e.g. 111111, 123456, aaaaaa, password)
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

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

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

      if (data.session) {
        // Auto-login successful
        navigate("/");
      } else {
        setMessage(
          "Account created successfully! You can now log in.",
        );
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
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="e.g. Amara Okafor"
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
                      className={`password-strength-bar ${
                        strength.score >= 1 ? `active-${strength.colorClass}` : ""
                      }`}
                    />
                    <div
                      className={`password-strength-bar ${
                        strength.score >= 2 ? `active-${strength.colorClass}` : ""
                      }`}
                    />
                    <div
                      className={`password-strength-bar ${
                        strength.score >= 3 ? `active-${strength.colorClass}` : ""
                      }`}
                    />
                    <div
                      className={`password-strength-bar ${
                        strength.score >= 4 ? `active-${strength.colorClass}` : ""
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

          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
