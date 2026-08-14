import { createContext, useContext, useEffect, useState } from "react";

import type { User } from "@supabase/supabase-js";

import { getCurrentUser, getCurrentProfile, signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
type Profile = {
  id: string;
  name: string;
  avatar: string | null;
  role: "seller" | "customer";
  created_at: string;
};

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const currentProfile = await getCurrentProfile();
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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
