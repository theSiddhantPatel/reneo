import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { LiveSessionData } from "../types/liveSession";
function LiveSession() {
  const { liveId } = useParams();
  const [session, setSession] = useState<LiveSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchLiveSession() {
      if (!liveId) {
        setError("Live session ID is missing.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("live_id", liveId)
        .single();

      if (error) {
        console.error("Failed to fetch live session:", error);
        setError("Live session not found.");
        setLoading(false);
        return;
      }

      setSession(data);
      setLoading(false);
    }

    fetchLiveSession();
  }, [liveId]);

  if (loading) {
    return <p>Loading live session...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!session) {
    return <p>Live session not found.</p>;
  }

  if (session.status === "ended") {
    return <p>This live session has ended.</p>;
  }

  return (
    <div>
      <h1>Live Session</h1>

      <p>Live ID: {session.live_id}</p>
      <p>Status: {session.status}</p>
      <p>Host ID: {session.host_id}</p>
      <p>Product ID: {session.product_id}</p>
    </div>
  );
}

export default LiveSession;
