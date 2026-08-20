import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

type AgoraTokenResponse = {
    token: string;
    appId: string;
    channelName: string;
    uid: number;
    role: "publisher" | "subscriber";
};

export async function getAgoraToken(
    liveId: string,
    uid: number
): Promise<AgoraTokenResponse> {
    // Get currently logged-in Supabase session
    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
        throw new Error("Failed to get authentication session");
    }

    if (!session?.access_token) {
        throw new Error("User is not authenticated");
    }

    const response = await fetch(
        `${BACKEND_URL}/api/agora/token`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                liveId,
                uid,
                //we can't send 'role' for security purpose.
            }),
        }
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to get Agora token"
        );
    }

    return data;
}
