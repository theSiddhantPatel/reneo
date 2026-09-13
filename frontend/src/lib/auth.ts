import { supabase } from "./supabase";

export async function signInWithGoogle(role?: "customer" | "seller") {
    const redirectUrl = role
        ? `${window.location.origin}/?role=${role}`
        : `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: redirectUrl,
            queryParams: {
                access_type: "offline",
                prompt: "consent",
            },
        },
    });

    if (error) throw error;
    return data;
}


export async function getCurrentUser() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        return null;
    }

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    return user;
}


export async function getCurrentProfile() {
    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data: existingProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    let data = existingProfile;

    // If profile row doesn't exist yet (e.g. initial Google OAuth trigger delay), fallback create it
    if (!data) {
        const meta = user.user_metadata || {};
        const fallbackName =
            meta.full_name || meta.name || user.email?.split("@")[0] || "User";
        const fallbackAvatar = meta.avatar_url || meta.picture || meta.avatar || null;

        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const urlRole = params?.get("role");
        const fallbackRole =
            urlRole === "seller" || urlRole === "customer"
                ? urlRole
                : meta.role === "seller" || meta.role === "customer"
                ? meta.role
                : "customer";

        const { data: createdProfile, error: upsertErr } = await supabase
            .from("profiles")
            .upsert({
                id: user.id,
                name: fallbackName,
                avatar: fallbackAvatar,
                role: fallbackRole,
            })
            .select("*")
            .single();

        if (!upsertErr && createdProfile) {
            data = createdProfile;
        }
    }

    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}
