import agoraToken from "agora-token";
const { RtcTokenBuilder, RtcRole } = agoraToken;

const appId = process.env.AGORA_APP_ID!;
const appCertificate = process.env.AGORA_APP_CERTIFICATE!;

if (!appId) {
    throw new Error("Agora credentials are missing");
}

if (!appCertificate) {
    throw new Error("AGORA app certificate is missing");
}

// Global 20-minute maximum live stream duration limit to save resources
export const MAX_LIVE_DURATION_SECONDS = 20 * 60; // 1200 seconds

export function generateAgoraToken(
    channelName: string,
    uid: number,
    role: "publisher" | "subscriber",
    expiresInSeconds: number = MAX_LIVE_DURATION_SECONDS
) {
    const agoraRole =
        role === "publisher"
            ? RtcRole.PUBLISHER
            : RtcRole.SUBSCRIBER;

    // Strict token lifespan capped to remaining session time (min 10s, max 1200s)
    const validDurationSeconds = Math.max(10, Math.min(expiresInSeconds, MAX_LIVE_DURATION_SECONDS));

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        agoraRole,
        validDurationSeconds,
        validDurationSeconds
    );

    return token;
}