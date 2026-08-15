import { Router, Response } from "express";
import {
    authenticateUser,
    AuthenticatedRequest,
} from "../middleware/auth.js";
import { createAuthenticatedSupabaseClient } from "../config/supabase.js";

const liveRouter = Router();

liveRouter.post(
    "/",
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const accessToken = req.accessToken!;

            const authenticatedSupabase =
                createAuthenticatedSupabaseClient(accessToken);

            const { productId } = req.body;
            console.log("productId: ", productId);
            // 1. Validate productId
            if (!productId || typeof productId !== "string") {
                return res.status(400).json({
                    message: "productId is required",
                });
            }

            // 2. Check authenticated user's profile
            const { data: profile, error: profileError } =
                await authenticatedSupabase
                    .from("profiles")
                    .select("role")
                    .eq("id", userId)
                    .single();

            if (profileError || !profile) {

                return res.status(404).json({
                    message: "User profile not found",
                });
            }
            console.log("profile: ", profile);

            // 3. Only sellers can start a live session
            if (profile.role !== "seller") {

                return res.status(403).json({
                    message: "Only sellers can start a live session",
                });
            }

            console.log("profile.role: ", profile.role);// just for verification
            // 4. Find the product
            const { data: product, error: productError } =
                await authenticatedSupabase
                    .from("products")
                    .select("id, seller_id, status")
                    .eq("id", productId)
                    .single();

            console.log("productError: ", productError);
            console.log("product: ", product);

            if (productError || !product) {

                return res.status(404).json({
                    message: "Product not found!",
                });
            }

            // 5. Verify product ownership
            if (product.seller_id !== userId) {
                return res.status(403).json({
                    message: "You do not own this product",
                });
            }

            // 6. Create live session
            const { data: liveSession, error: liveError } =
                await authenticatedSupabase
                    .from("live_sessions")
                    .insert({
                        host_id: userId,
                        product_id: product.id,
                        status: "live",
                        ended_at: null,
                    })
                    .select()
                    .single();

            if (liveError || !liveSession) {
                console.error("Live session creation error:", liveError);

                return res.status(500).json({
                    message: "Failed to create live session",
                });
            }

            // 7. Return created live session
            return res.status(201).json({
                message: "Live session started successfully",
                liveSession,
            });
        } catch (error) {
            console.error("Start live error:", error);

            return res.status(500).json({
                message: "Failed to start live session",
            });
        }
    }
);

export default liveRouter;