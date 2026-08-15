import express, { Response } from "express";
import { AuthenticatedRequest, authenticateUser } from "./middleware/auth.js";
import { supabase } from "./config/supabase.js"
import agoraRouter from "./routes/agora.routes.js";
import liveRouter from "./routes/live.routes.js";
//import { generateAgoraToken } from "./utils/agora.js";


const app = express();

app.use(express.json());

// app.get("/hi", (req, res) => {
//   res.json({
//     message: "backend is working"
//   })

//   console.log("Agora App ID loaded:", !!process.env.AGORA_APP_ID);
//   console.log(
//     "Agora App Certificate loaded:",
//     !!process.env.AGORA_APP_CERTIFICATE
//   );
//   //res.json({ message: "hi from backend!" });
// });

app.use("/api/agora", agoraRouter);


app.use("/api/live", liveRouter);

// app.get("/test-agora-token", (req, res) => {
//   try {
//     const token = generateAgoraToken("reneo-test-channel",
//       12345, "publisher"
//     )
//     return res.json({
//       "message": "Agora token generated successfully",
//       "token": token,
//     })
//   } catch (err) {
//     console.error("token generation error ", err);

//     return res.json({
//       message: "token generation problem"
//     })
//   }
// })

//authorize agora-token so that only a seller can generate it

app.get("/protected", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  return res.json({

    message: "Authentication successful",
    user: req.user,
  });
});


export default app;