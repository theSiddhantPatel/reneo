import { Router, Response } from "express";
import {
    authenticateUser,
    AuthenticatedRequest,
} from "../middleware/auth.js";
import { createAuthenticatedSupabaseClient } from "../config/supabase.js";
import { generateAgoraToken } from "../utils/agora.js";

const agoraRouter = Router();

agoraRouter.post(
    "/token",
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const accessToken = req.accessToken!;

            const authenticatedSupabase =
                createAuthenticatedSupabaseClient(accessToken);
            const { liveId, uid } = req.body;

            // Validate liveId
            if (!liveId || typeof liveId !== "string") {
                return res.status(400).json({
                    message: "liveId is required",
                });
            }

            // Validate Agora UID
            if (typeof uid !== "number") {
                return res.status(400).json({
                    message: "uid must be a number",
                });
            }

            // Get authenticated user's profile
            const { data: profile, error: profileError } = await authenticatedSupabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single();
            console.log("user id", userId);
            console.log("Profile:", profile);
            console.log("Profile error:", profileError);

            if (profileError || !profile) {
                return res.status(404).json({
                    message: "User profile not found",
                });
            }

            // Get the requested live session
            const { data: live, error: liveError } = await authenticatedSupabase
                .from("live_sessions")
                .select("live_id, host_id, status")
                .eq("live_id", liveId)
                .single();

            if (liveError || !live) {
                return res.status(404).json({
                    message: "Live session not found",
                });
            }

            // Do not issue tokens for ended lives
            if (live.status === "ended") {
                return res.status(410).json({
                    message: "This live session has already ended",
                });
            }

            let role: "publisher" | "subscriber";

            if (profile.role === "seller") {
                // Seller can only publish to their own live session
                if (live.host_id !== userId) {
                    return res.status(403).json({
                        message: "You are not the host of this live session",
                    });
                }

                role = "publisher";
            } else {
                // Customer joins as audience
                role = "subscriber";
            }

            const token = generateAgoraToken(
                live.live_id,
                uid,
                role
            );

            return res.status(200).json({
                token,
                appId: process.env.AGORA_APP_ID,
                channelName: live.live_id,
                uid,
                role,
            });
        } catch (error) {
            console.error("Agora token generation failed:", error);

            return res.status(500).json({
                message: "Failed to generate Agora token",
            });
        }
    }
);

export default agoraRouter; 