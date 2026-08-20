import AgoraRTC from "agora-rtc-sdk-ng";
AgoraRTC.disableLogUpload();

export const agoraClient =
    AgoraRTC.createClient({
        mode: "live",// for live broadcasting
        codec: "vp8",
    });

export async function joinAgoraChannel(
    appId: string,
    channelName: string,
    token: string,
    uid: number
) {
    try {
        console.log(
            "Agora connection state:",
            agoraClient.connectionState
        );

        if (
            agoraClient.connectionState === "CONNECTED" ||
            agoraClient.connectionState === "CONNECTING"
        ) {
            console.log(
                "Agora client is already connecting or connected"
            );
            return;
        }

        await agoraClient.join(
            appId,
            channelName,
            token,
            uid
        );

        console.log("Successfully joined Agora channel");
    } catch (error) {
        console.error("Failed to join Agora channel:", error);
        throw error;
    }
}