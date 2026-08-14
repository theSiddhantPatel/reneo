import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SellerDashboard from "./pages/SellerDashboard";
import CustomerHome from "./pages/CustomerHome";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/seller" element={<SellerDashboard />} />
        <Route path="/customer" element={<CustomerHome />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
