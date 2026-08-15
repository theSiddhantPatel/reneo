export type LiveSessionData = {
    live_id: string;
    host_id: string;
    product_id: string;
    status: "scheduled" | "live" | "ended";
    created_at: string;
    ended_at: string | null;
};