import { Router, Response } from "express";
import {
    authenticateUser,
    AuthenticatedRequest,
} from "../middleware/auth.js";
import { createAuthenticatedSupabaseClient } from "../config/supabase.js";
import { generateAgoraToken, MAX_LIVE_DURATION_SECONDS } from "../utils/agora.js";

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

            if (profileError || !profile) {
                return res.status(404).json({
                    message: "User profile not found",
                });
            }

            // Get the requested live session with created_at timestamp
            const { data: live, error: liveError } = await authenticatedSupabase
                .from("live_sessions")
                .select("live_id, host_id, status, created_at")
                .eq("live_id", liveId)
                .single();

            if (liveError || !live) {
                return res.status(404).json({
                    message: "Live session not found",
                });
            }

            // Calculate elapsed time from stream start
            const streamStartTime = new Date(live.created_at).getTime();
            const elapsedSeconds = Math.floor((Date.now() - streamStartTime) / 1000);
            const remainingSeconds = MAX_LIVE_DURATION_SECONDS - elapsedSeconds;

            // Enforce 20-minute maximum duration limit
            if (live.status === "ended" || remainingSeconds <= 0) {
                if (live.status !== "ended") {
                    // Auto-end the live session in database if 20 mins passed
                    await authenticatedSupabase
                        .from("live_sessions")
                        .update({
                            status: "ended",
                            ended_at: new Date().toISOString(),
                        })
                        .eq("live_id", liveId);
                }

                return res.status(410).json({
                    message: "This live session has exceeded the 20-minute maximum duration limit and is now ended.",
                    sessionEnded: true,
                });
            }

            let role: "publisher" | "subscriber";

            // Seller can only publish to their own live session
            if (profile.role === "seller") {
                if (live.host_id !== userId) {
                    return res.status(403).json({
                        message: "You are not the host of this live session",
                    });
                }

                role = "publisher";
            } else if (profile.role === "customer") {
                role = "subscriber";
            } else {
                return res.status(403).json({
                    message: "Invalid user role",
                });
            }

            // Generate cryptographic Agora token with lifespan capped to remaining time
            const token = generateAgoraToken(
                live.live_id,
                uid,
                role,
                remainingSeconds
            );

            return res.status(200).json({
                token,
                appId: process.env.AGORA_APP_ID,
                channelName: live.live_id,
                uid,
                role,
                maxDurationSeconds: MAX_LIVE_DURATION_SECONDS,
                remainingSeconds,
            });
        } catch (error) {
            return res.status(500).json({
                message: "Failed to generate Agora token",
            });
        }
    }
);

export default agoraRouter;