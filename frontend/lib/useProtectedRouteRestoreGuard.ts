/**
 * Protected-route restore guard.
 * Revalidates browser-restored protected pages before stale React session context can paint.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { buildLoginPath } from "./authRedirects";
import {
  clearSupabaseSessionSnapshot,
  isSupabaseAbortError,
  readSupabaseSession,
} from "./supabaseClient";
import {
  clearLogoutEpochWhenSessionIsFresh,
  isSessionOlderThanLogoutEpoch,
} from "./authSessionInvalidation";

type ProtectedRouteRestoreGuardOptions = {
  enabled: boolean;
  nextPath: string;
  missingSessionBehavior?: "redirect" | "clear";
  revalidateOnTabReturn?: boolean;
};

type ProtectedRouteRestoreGuardState = {
  checking: boolean;
};

type RestoreCheckOptions = {
  blockWhileChecking?: boolean;
};

const isTransientVisibleSessionCheckFailure = (error: unknown): boolean =>
  isAuthRetryableFetchError(error) || isSupabaseAbortError(error);

/**
 * Forces a protected route to prove current browser auth before rendering private content.
 */
export const useProtectedRouteRestoreGuard = ({
  enabled,
  nextPath,
  missingSessionBehavior = "redirect",
  revalidateOnTabReturn = true,
}: ProtectedRouteRestoreGuardOptions): ProtectedRouteRestoreGuardState => {
  const router = useRouter();
  const routerRef = useRef(router);
  const [checking, setChecking] = useState(enabled);
  const checkingRef = useRef(enabled);
  const checkVersionRef = useRef(0);

  const setCheckingState = useCallback((nextChecking: boolean) => {
    checkingRef.current = nextChecking;
    setChecking(nextChecking);
  }, []);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const runRestoreCheck = useCallback(
    async (options: RestoreCheckOptions = {}) => {
      const blockWhileChecking = options.blockWhileChecking === true;
      if (!enabled) {
        setCheckingState(false);
        return;
      }

      const checkVersion = checkVersionRef.current + 1;
      checkVersionRef.current = checkVersion;
      if (blockWhileChecking) {
        setCheckingState(true);
      }

      let sessionCheckError: unknown = null;
      const session = await (
        blockWhileChecking ? readSupabaseSession({ forceRefresh: true }) : readSupabaseSession()
      ).catch((error: unknown) => {
        sessionCheckError = error;
        return null;
      });
      if (checkVersionRef.current !== checkVersion) return;

      if (
        sessionCheckError &&
        !blockWhileChecking &&
        isTransientVisibleSessionCheckFailure(sessionCheckError)
      ) {
        setCheckingState(false);
        return;
      }

      if (!session || isSessionOlderThanLogoutEpoch(session)) {
        clearSupabaseSessionSnapshot();
        if (missingSessionBehavior === "clear") {
          setCheckingState(false);
          return;
        }
        void routerRef.current.replace(buildLoginPath({ nextPath }));
        return;
      }

      clearLogoutEpochWhenSessionIsFresh(session);
      setCheckingState(false);
    },
    [enabled, missingSessionBehavior, nextPath, setCheckingState]
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void runRestoreCheck({ blockWhileChecking: true });
    });
    return () => {
      cancelled = true;
    };
  }, [runRestoreCheck]);

  useEffect(() => {
    if (
      !enabled ||
      !revalidateOnTabReturn ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void runRestoreCheck({ blockWhileChecking: true });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runRestoreCheck({ blockWhileChecking: checkingRef.current });
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, revalidateOnTabReturn, runRestoreCheck, setCheckingState]);

  return { checking: enabled ? checking : false };
};
