/**
 * Protected-route restore guard.
 * Revalidates browser-restored protected pages before stale React session context can paint.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildLoginPath } from "./authRedirects";
import { clearSupabaseSessionSnapshot, readSupabaseSession } from "./supabaseClient";
import {
  clearLogoutEpochWhenSessionIsFresh,
  isSessionOlderThanLogoutEpoch,
} from "./authSessionInvalidation";

type ProtectedRouteRestoreGuardOptions = {
  enabled: boolean;
  nextPath: string;
};

type ProtectedRouteRestoreGuardState = {
  checking: boolean;
};

type RestoreCheckOptions = {
  blockWhileChecking?: boolean;
};

/**
 * Forces a protected route to prove current browser auth before rendering private content.
 */
export const useProtectedRouteRestoreGuard = ({
  enabled,
  nextPath,
}: ProtectedRouteRestoreGuardOptions): ProtectedRouteRestoreGuardState => {
  const router = useRouter();
  const routerRef = useRef(router);
  const [checking, setChecking] = useState(enabled);
  const checkVersionRef = useRef(0);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const runRestoreCheck = useCallback(
    async (options: RestoreCheckOptions = {}) => {
      const blockWhileChecking = options.blockWhileChecking === true;
      if (!enabled) {
        setChecking(false);
        return;
      }

      const checkVersion = checkVersionRef.current + 1;
      checkVersionRef.current = checkVersion;
      if (blockWhileChecking) {
        setChecking(true);
      }

      const session = await readSupabaseSession({ forceRefresh: true }).catch(() => null);
      if (checkVersionRef.current !== checkVersion) return;

      if (!session || isSessionOlderThanLogoutEpoch(session)) {
        clearSupabaseSessionSnapshot();
        void routerRef.current.replace(buildLoginPath({ nextPath }));
        return;
      }

      clearLogoutEpochWhenSessionIsFresh(session);
      setChecking(false);
    },
    [enabled, nextPath]
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
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const handlePageHide = () => {
      setChecking(true);
    };
    const handlePageShow = () => {
      void runRestoreCheck({ blockWhileChecking: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runRestoreCheck({ blockWhileChecking: false });
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, runRestoreCheck]);

  return { checking: enabled ? checking : false };
};
