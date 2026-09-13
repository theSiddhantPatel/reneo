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
            //console.log("productId: ", productId);
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
            //console.log("profile: ", profile);

            // 3. Only sellers can start a live session
            if (profile.role !== "seller") {

                return res.status(403).json({
                    message: "Only sellers can start a live session",
                });
            }

            //console.log("profile.role: ", profile.role);// just for verification
            // 4. Find the product
            const { data: product, error: productError } =
                await authenticatedSupabase
                    .from("products")
                    .select("id, seller_id, status")
                    .eq("id", productId)
                    .single();

            //console.log("productError: ", productError);
            //console.log("product: ", product);

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
                //console.error("Live session creation error:", liveError);

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
            //console.error("Start live error:", error);

            return res.status(500).json({
                message: "Failed to start live session",
            });
        }
    }
);

liveRouter.patch(
    "/:liveId/end",
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const accessToken = req.accessToken!;
            const { liveId } = req.params;

            const authenticatedSupabase =
                createAuthenticatedSupabaseClient(accessToken);

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

            if (live.host_id !== userId) {
                return res.status(403).json({
                    message: "Only the host can end this live session",
                });
            }

            if (live.status === "ended") {
                return res.status(200).json({
                    message: "Live session already ended",
                    liveSession: live,
                });
            }

            const { data: endedLive, error: updateError } =
                await authenticatedSupabase
                    .from("live_sessions")
                    .update({
                        status: "ended",
                        ended_at: new Date().toISOString(),
                    })
                    .eq("live_id", liveId)
                    .eq("host_id", userId)
                    .select()
                    .single();

            if (updateError || !endedLive) {
                return res.status(500).json({
                    message: "Failed to end live session",
                });
            }

            return res.status(200).json({
                message: "Live session ended successfully",
                liveSession: endedLive,
            });
        } catch (error) {
            return res.status(500).json({
                message: "Failed to end live session",
            });
        }
    }
);

// Delete product permanently with authenticated cascade cleanup
liveRouter.delete(
    "/product/:productId",
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const accessToken = req.accessToken!;
            const { productId } = req.params;

            const authenticatedSupabase = createAuthenticatedSupabaseClient(accessToken);

            // 1. Verify product exists and belongs to requesting seller
            const { data: product, error: findError } = await authenticatedSupabase
                .from("products")
                .select("id, seller_id, image_url, name")
                .eq("id", productId)
                .single();

            if (findError || !product) {
                return res.status(404).json({ message: "Product not found" });
            }

            if (product.seller_id !== userId) {
                return res.status(403).json({ message: "You do not own this product" });
            }

            // 2. Clean up live messages and sessions for this product created by the seller
            const { data: sessions } = await authenticatedSupabase
                .from("live_sessions")
                .select("live_id")
                .eq("product_id", productId)
                .eq("host_id", userId);

            if (sessions && sessions.length > 0) {
                const sessionIds = sessions.map((s) => s.live_id);
                await authenticatedSupabase.from("live_messages").delete().in("live_id", sessionIds);
                await authenticatedSupabase.from("live_sessions").delete().eq("product_id", productId).eq("host_id", userId);
            }

            // 3. Delete product permanently from database
            let { error: deleteError } = await authenticatedSupabase
                .from("products")
                .delete()
                .eq("id", productId)
                .eq("seller_id", userId);

            // If foreign key constraint still blocks hard delete, mark as archived
            if (deleteError) {
                console.warn("Hard delete constrained by foreign keys, archiving product:", deleteError.message);
                const { error: archiveError } = await authenticatedSupabase
                    .from("products")
                    .update({ status: "archived" })
                    .eq("id", productId)
                    .eq("seller_id", userId);

                if (archiveError) {
                    throw archiveError;
                }
            }

            // 4. Clean up storage image if present
            if (product.image_url && product.image_url.includes("product-images")) {
                try {
                    const urlParts = product.image_url.split("/product-images/");
                    if (urlParts.length > 1) {
                        const storagePath = decodeURIComponent(urlParts[1]);
                        await authenticatedSupabase.storage.from("product-images").remove([storagePath]);
                    }
                } catch {
                    // Ignore storage deletion error
                }
            }

            return res.status(200).json({
                message: `Product "${product.name}" deleted successfully`,
                productId,
            });
        } catch (error) {
            console.error("Delete product error:", error);
            return res.status(500).json({
                message: error instanceof Error ? error.message : "Failed to delete product",
            });
        }
    }
);

export default liveRouter;
