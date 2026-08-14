import { supabase } from "./supabase";

export async function getCurrentUser() {
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

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}