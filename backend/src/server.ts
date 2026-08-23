import "dotenv/config";
import app from "./app.js";
import { supabase } from "./config/supabase.js";

const PORT = Number(process.env.PORT ?? 4000);

// 20-minute maximum duration limit (in milliseconds)
const MAX_LIVE_DURATION_MS = 20 * 60 * 1000;

// Background sweeper: automatically terminates any live session running for > 20 minutes to save resources
setInterval(async () => {
    try {
        const cutoffIso = new Date(Date.now() - MAX_LIVE_DURATION_MS).toISOString();
        const { data: expiredSessions, error } = await supabase
            .from("live_sessions")
            .update({
                status: "ended",
                ended_at: new Date().toISOString(),
            })
            .eq("status", "live")
            .lt("created_at", cutoffIso)
            .select("live_id");

        if (expiredSessions && expiredSessions.length > 0) {
            console.log(`[Sweeper] Auto-ended ${expiredSessions.length} live session(s) exceeding 20 minutes.`);
        }
    } catch (err) {
        // Background sweeper resilient catch
    }
}, 60 * 1000); // Runs every 60 seconds

app.listen(PORT, () => {
    console.log("supabase backend client configured", !!supabase);
    console.log(`server is running on http://localhost:${PORT}`);
});
