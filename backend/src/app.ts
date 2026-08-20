import express, { Response } from "express";
import { AuthenticatedRequest, authenticateUser } from "./middleware/auth.js";
import { supabase } from "./config/supabase.js";
import agoraRouter from "./routes/agora.routes.js";
import liveRouter from "./routes/live.routes.js";
import cors from "cors";

const app = express();
const allowedOrigin = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.use("/api/agora", agoraRouter);
app.use("/api/live", liveRouter);

app.get("/protected", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    message: "Authentication successful",
    user: req.user,
  });
});

export default app;
