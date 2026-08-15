export type Profile = {
    id: string;
    name: string;
    avatar: string | null;
    role: "seller" | "customer";
    created_at: string;
};