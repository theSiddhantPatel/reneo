import agoraToken from "agora-token"
const { RtcTokenBuilder, RtcRole } = agoraToken;

const appId = process.env.AGORA_APP_ID!;
// '!' in the last means I assure you that this value is not null;
const appCertificate = process.env.AGORA_APP_CERTIFICATE!;

if (!appId) {
    throw new Error("Agora credentials are missing");
}

if (!appCertificate) {
    throw new Error("AGORA app certificate is missing");
}

export function generateAgoraToken(
    channelName: string,
    uid: number,
    role: "publisher" | "subscriber"
) {
    const agoraRole =
        role === "publisher"
            ? RtcRole.PUBLISHER
            : RtcRole.SUBSCRIBER;

    // Token remains valid for 1 hour
    const tokenExpirationTimeInSeconds = 60 * 60;

    // RTC privileges remain valid for 1 hour
    const privilegeExpirationInSeconds = 60 * 60;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        agoraRole,
        tokenExpirationTimeInSeconds,
        privilegeExpirationInSeconds
    );

    return token;
}