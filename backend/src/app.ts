import express, { Response } from "express";
import { AuthenticatedRequest, authenticateUser } from "./middleware/auth.js";
import { supabase } from "./config/supabase.js";
import agoraRouter from "./routes/agora.routes.js";
import liveRouter from "./routes/live.routes.js";
import cors from "cors";

const app = express();

// Secure origin resolution for production and preview deployments
const configuredOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests in non-production
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/+$/, "");

      // Check if origin matches configured FRONTEND_URL or official project domains
      const isAllowed =
        configuredOrigins.includes(cleanOrigin) ||
        cleanOrigin === "https://reneo.siddpatel.com" ||
        cleanOrigin.endsWith(".vercel.app") ||
        cleanOrigin.startsWith("http://localhost:") ||
        cleanOrigin.startsWith("http://127.0.0.1:");

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`[CORS Blocked] Origin: ${origin}`);
      return callback(new Error(`CORS policy: Access denied for origin ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

// Health check endpoint to verify backend is up
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/agora", agoraRouter);
app.use("/api/live", liveRouter);

app.get("/protected", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    message: "Authentication successful",
    user: req.user,
  });
});

export default app;
