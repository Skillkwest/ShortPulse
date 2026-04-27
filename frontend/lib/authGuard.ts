import { useRouter } from "next/router";
import { useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useSupabaseSessionState } from "./supabaseClient";

export const PROTECTED_ROUTES = [
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
  const { initialized, session, user } = useSupabaseSessionState();
  const authRedirectPath = `/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`;

  useEffect(() => {
    if (!enabled || !initialized) return;
    if (!session) {
      router.replace(authRedirectPath);
    }
  }, [authRedirectPath, enabled, initialized, router, session]);

  return {
    session: enabled ? session : null,
    user: enabled ? user : null,
    loading: enabled ? !initialized : false,
  };
}
