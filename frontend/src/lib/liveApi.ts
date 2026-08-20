import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

async function getAccessToken() {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
    }

    return session.access_token;
}

export async function startLiveSession(productId: string) {
    const accessToken = await getAccessToken();

    const response = await fetch(`${BACKEND_URL}/api/live`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ productId }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to start live session");
    }

    return data.liveSession;
}

export async function endLiveSession(liveId: string) {
    const accessToken = await getAccessToken();

    const response = await fetch(`${BACKEND_URL}/api/live/${liveId}/end`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to end live session");
    }

    return data.liveSession;
}
