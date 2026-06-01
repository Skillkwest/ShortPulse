import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { refreshSupabaseSession, useSupabaseSessionState } from "./supabaseClient";
export { PROTECTED_ROUTES } from "./protectedRoutes";

type UseProtectedRouteResult = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export function useProtectedRoute(enabled: boolean): UseProtectedRouteResult {
  const router = useRouter();
  const { initialized, session, user } = useSupabaseSessionState();
  const authRedirectPath = `/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`;
  const [, bumpRecoveryVersion] = useState(0);
  const recoveryAttemptedRef = useRef(false);
  const recoveryInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !initialized) return;
    if (session) {
      recoveryAttemptedRef.current = false;
      recoveryInFlightRef.current = false;
      return;
    }
    if (!session) {
      if (recoveryInFlightRef.current) {
        return;
      }
      if (!recoveryAttemptedRef.current) {
        recoveryAttemptedRef.current = true;
        recoveryInFlightRef.current = true;
        void refreshSupabaseSession({ preserveSnapshotOnError: true }).finally(() => {
          recoveryInFlightRef.current = false;
          bumpRecoveryVersion((version) => version + 1);
        });
        return;
      }
      router.replace(authRedirectPath);
    }
  }, [authRedirectPath, enabled, initialized, router, session]);

  return {
    session: enabled ? session : null,
    user: enabled ? user : null,
    loading: enabled ? !initialized : false,
  };
}
