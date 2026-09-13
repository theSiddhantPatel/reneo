import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, getCurrentProfile, signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/profile";

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const currentProfile = await getCurrentProfile();
          setProfile(currentProfile);
        }
      } catch (error) {
        console.error("Failed to load authentication:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          let currentProfile = await getCurrentProfile();

          // Handle requested role from Google OAuth redirect (?role=seller or ?role=customer)
          // Only allow role assignment if the account was just created (within the last 60 seconds).
          // Once an account exists, its role (seller/customer) is permanent and cannot be overwritten.
          const params = new URLSearchParams(window.location.search);
          const requestedRole = params.get("role");

          const isNewUser =
            session.user.created_at &&
            Date.now() - new Date(session.user.created_at).getTime() < 60000;

          if (
            isNewUser &&
            requestedRole &&
            (requestedRole === "seller" || requestedRole === "customer") &&
            currentProfile &&
            currentProfile.role !== requestedRole
          ) {
            const { data: updatedProfile, error: updateErr } = await supabase
              .from("profiles")
              .update({ role: requestedRole })
              .eq("id", currentProfile.id)
              .select("*")
              .single();

            if (!updateErr && updatedProfile) {
              currentProfile = updatedProfile;
            }
          }

          // Always clean up role parameter from the address bar
          if (params.has("role")) {
            const url = new URL(window.location.href);
            url.searchParams.delete("role");
            window.history.replaceState({}, document.title, url.pathname + url.hash);
          }

          setProfile(currentProfile);
        } catch (error) {
          console.error("Failed to load profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
