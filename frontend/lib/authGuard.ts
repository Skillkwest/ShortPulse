import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ensureSupabaseClient } from "./supabaseClient";

export const PROTECTED_ROUTES = [
  "/dashboard",
  "/performance",
  "/saved-creators",
  "/media-library",
  "/ai-studio",
  "/creator-studio",
  "/character",
  "/admin",
];

type UseProtectedRouteResult = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export function useProtectedRoute(enabled: boolean): UseProtectedRouteResult {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    try {
      const supabase = ensureSupabaseClient();

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (!nextSession) {
          router.replace("/auth");
        }
        setLoading(false);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (!nextSession) {
          router.replace("/auth");
        }
      });

      return () => {
        active = false;
        authListener?.subscription.unsubscribe();
      };
    } catch (err) {
      // Supabase client missing or other unexpected error: force sign-in.
      if (active) {
        setSession(null);
        setUser(null);
        setLoading(false);
        router.replace("/auth");
      }
    }
  }, [enabled, router]);

  return { session, user, loading };
}
