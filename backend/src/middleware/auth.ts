import { Request, Response, NextFunction } from "express"
import { supabase } from "../config/supabase.js";

//import { supabase } from "../config/supabase.js"

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email?: string;
    };
    accessToken?: string;
}

export async function authenticateUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;

        // 1.check authorization header
        if (!authHeader) {
            return res.status(401).json({
                message: "Authorization header is missing",
            });
        }

        // 2. Check Bearer token format from client
        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Invalid authorization format",
            });
        }

        // 3. Extract access token
        const token = authHeader.substring(7);

        if (!token) {
            return res.status(401).json({
                message: "Access token is missing",
            });
        }

        // 4. Ask Supabase to verify the token
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        // 5. Reject invalid/expired token
        if (error || !user) {
            return res.status(401).json({
                message: "Invalid or expired session",
            });
        }

        // 6. Attach authenticated user to request
        req.user = {
            id: user.id,
            email: user.email,

        };
        //for accessing token
        req.accessToken = token;
        // 7. Continue to the protected route
        next();
    } catch (error) {
        // console.error("Authentication middleware error:", error);

        return res.status(500).json({
            message: "Authentication service failed",
        });
    }
}