import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ensureSupabaseClient } from "./supabaseClient";

export const PROTECTED_ROUTES = [
  "/dashboard",
  "/performance",
  "/saved-creators",
  "/media-library",
  "/profile",
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
  const authRedirectPath = `/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const runAuthCheck = async () => {
      try {
        const supabase = ensureSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (!nextSession) {
          router.replace(authRedirectPath);
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(
          (_event, listenerSession) => {
            if (!active) return;
            setSession(listenerSession);
            setUser(listenerSession?.user ?? null);
            if (!listenerSession) {
              router.replace(authRedirectPath);
            }
          }
        );
        unsubscribe = () => authListener?.subscription.unsubscribe();
      } catch {
        // Supabase client missing or other unexpected error: force sign-in.
        if (active) {
          setSession(null);
          setUser(null);
          router.replace(authRedirectPath);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void runAuthCheck();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled, router, authRedirectPath]);

  return { session, user, loading: enabled ? loading : false };
}
