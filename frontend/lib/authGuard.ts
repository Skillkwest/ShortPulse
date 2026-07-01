import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useProtectedRouteSessionContext } from "./protectedRouteSessionContext";
import { refreshSupabaseSession, useSupabaseSessionState } from "./supabaseClient";
import { readPersistedSupabaseSessionHint } from "./supabaseSessionHints";
import { buildLoginPath } from "./authRedirects";
import { readAuthSessionLogoutEpoch } from "./authSessionInvalidation";
export { PROTECTED_ROUTES } from "./protectedRoutes";

type UseProtectedRouteResult = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

type UseProtectedRouteOptions = {
  missingSessionBehavior?: "redirect" | "preserve";
};

export function useProtectedRoute(
  enabled: boolean,
  options?: UseProtectedRouteOptions
): UseProtectedRouteResult {
  const missingSessionBehavior = options?.missingSessionBehavior ?? "redirect";
  const protectedRouteSession = useProtectedRouteSessionContext();
  const router = useRouter();
  const { initialized, session, user } = useSupabaseSessionState({
    enabled: !(enabled && protectedRouteSession),
  });
  const authRedirectPath = buildLoginPath({ nextPath: router.asPath || "/dashboard" });
  const [recoveryVersion, bumpRecoveryVersion] = useState(0);
  const recoveryAttemptedRef = useRef(false);
  const recoveryInFlightRef = useRef(false);

  useEffect(() => {
    if (enabled && protectedRouteSession) return;
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
      const shouldRedirectMissingSession =
        missingSessionBehavior === "redirect" || readAuthSessionLogoutEpoch() != null;
      if (!readPersistedSupabaseSessionHint()) {
        if (shouldRedirectMissingSession) {
          router.replace(authRedirectPath);
        }
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
      if (shouldRedirectMissingSession) {
        router.replace(authRedirectPath);
      }
    }
  }, [
    authRedirectPath,
    enabled,
    initialized,
    missingSessionBehavior,
    protectedRouteSession,
    recoveryVersion,
    router,
    session,
  ]);

  if (enabled && protectedRouteSession) {
    return {
      session: protectedRouteSession.session,
      user: protectedRouteSession.user,
      loading: false,
    };
  }

  return {
    session: enabled ? session : null,
    user: enabled ? user : null,
    loading: enabled ? !initialized : false,
  };
}
