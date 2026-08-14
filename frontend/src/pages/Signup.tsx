import { useState } from "react";
import { supabase } from "../lib/supabase";

type Role = "seller" | "customer";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
        },
      },
    });

    if (error) {
      setError(error.message);
      return;
    }

    console.log("Signup response:", data);

    setMessage(
      "Account created. Please check your email to confirm your account.",
    );
  }

  return (
    <div>
      <h1>Create Account</h1>

      <form onSubmit={handleSignup}>
        <div>
          <label>Name</label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            minLength={5}
          />
        </div>

        <div>
          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <div>
          <label>Role</label>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
          </select>
        </div>

        <button type="submit">Create Account</button>
      </form>

      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}

export default Signup;
