// import { useState } from "react";
// import { supabase } from "../lib/supabase";

// function Login() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");

//   async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
//     //No logic or behavior changed.
//     //  SyntheticEvent<HTMLFormElement> is just replacing the deprecated FormEvent<HTMLFormElement> type.
//     e.preventDefault();

//     setMessage("");
//     setError("");

//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//       setError(error.message);
//       return;
//     }

//     console.log("Login successful:", data);
//     console.log("User:", data.user);
//     console.log("Session:", data.session);

//     setMessage("Login successful!");
//   }

//   return (
//     <div>
//       <h1>Login</h1>

//       <form onSubmit={handleLogin}>
//         <div>
//           <label>Email</label>

//           <input
//             type="email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />
//         </div>

//         <div>
//           <label>Password</label>

//           <input
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />
//         </div>

//         <button type="submit">Login</button>
//       </form>

//       {message && <p>{message}</p>}
//       {error && <p>{error}</p>}
//     </div>
//   );
// }

// export default Login;

function Login() {
  return (
    <div>
      <h1>Login</h1>
      <p>Login page</p>
    </div>
  );
}

export default Login;
