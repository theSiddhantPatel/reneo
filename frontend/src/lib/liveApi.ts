import { supabase } from "./supabase";
import { getBackendUrl } from "./config";

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
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/live`, {
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
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/live/${liveId}/end`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        keepalive: true,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to end live session");
    }

    return data.liveSession;
}

export function endLiveSessionBeacon(liveId: string) {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;

        const backendUrl = getBackendUrl();
        fetch(`${backendUrl}/api/live/${liveId}/end`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
            keepalive: true,
        }).catch(() => {});
    }).catch(() => {});
}
