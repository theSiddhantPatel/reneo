import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-logo-icon">
            <span className="brand-dot"></span>
          </span>
          <span className="brand-title">
            <strong>Reneo</strong>
            <span className="brand-accent">Live</span>
          </span>
        </Link>

        <div className="navbar-right">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === "dark" ? "Light" : "Aesthetic Dark"} Mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <>
                <span className="theme-icon">☀️</span>
                <span className="theme-label">Light</span>
              </>
            ) : (
              <>
                <span className="theme-icon">🌙</span>
                <span className="theme-label">Dark</span>
              </>
            )}
          </button>

          {user && profile && (
            <div className="navbar-user">
              <div className="user-meta-pill">
                <span className="navbar-username">{profile.name}</span>
                <span className={`role-badge role-${profile.role}`}>
                  {profile.role.toUpperCase()}
                </span>
              </div>

              <Link
                to={profile.role === "seller" ? "/seller" : "/customer"}
                className="btn-nav-link"
              >
                Dashboard
              </Link>

              <button onClick={handleSignOut} className="btn-signout">
                Sign Out
              </button>
            </div>
          )}

          {!user && (
            <div className="navbar-auth-links">
              <Link to="/login" className="btn-nav-link">
                Log In
              </Link>
              <Link to="/signup" className="btn-primary btn-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
