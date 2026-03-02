/**
 * AI Studio write-shadow persistence hook.
 * Debounces local session snapshot persistence and flushes on lifecycle exit events.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AiStudioSessionSnapshotV1 } from "../logic/sessionSnapshot";
import { saveAiStudioSessionShadow } from "../logic/sessionSnapshotStorage";

type PersistSnapshotFn = (
  sessionId: string,
  snapshot: AiStudioSessionSnapshotV1
) => Promise<void> | void;

type UseAiStudioSessionWriteShadowArgs = {
  sessionId: string | null;
  snapshot: AiStudioSessionSnapshotV1 | null;
  enabled?: boolean;
  debounceMs?: number;
  maxDirtyMs?: number;
  persistSnapshot?: PersistSnapshotFn;
};

type PendingSnapshotState = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshotV1;
  hash: string;
};

const DEFAULT_DEBOUNCE_MS = 2500;
const DEFAULT_MAX_DIRTY_MS = 15000;
const WRITE_SHADOW_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED !== "false";

/**
 * Persists `snapshot` for the active `sessionId` in debounced write-shadow mode.
 */
export const useAiStudioSessionWriteShadow = ({
  sessionId,
  snapshot,
  enabled = WRITE_SHADOW_ENABLED,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxDirtyMs = DEFAULT_MAX_DIRTY_MS,
  persistSnapshot = saveAiStudioSessionShadow,
}: UseAiStudioSessionWriteShadowArgs): void => {
  const pendingRef = useRef<PendingSnapshotState | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      globalThis.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      globalThis.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const flushPending = useCallback(() => {
    const flush = async (): Promise<void> => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      clearTimers();
      try {
        await Promise.resolve(persistSnapshot(pending.sessionId, pending.snapshot));
        lastSavedHashRef.current = pending.hash;
      } catch {
        pendingRef.current = pending;
        debounceTimerRef.current = globalThis.setTimeout(() => {
          void flush();
        }, debounceMs);
      }
    };
    return flush();
  }, [clearTimers, debounceMs, persistSnapshot]);

  const snapshotHash = useMemo(() => {
    if (!snapshot) return null;
    return JSON.stringify(snapshot);
  }, [snapshot]);

  useEffect(() => {
    if (!enabled || !sessionId || !snapshot || !snapshotHash) return;
    if (lastSavedHashRef.current === snapshotHash) return;

    const pending = pendingRef.current;
    if (pending && pending.sessionId !== sessionId) {
      void flushPending();
    }

    pendingRef.current = { sessionId, snapshot, hash: snapshotHash };
    if (debounceTimerRef.current) {
      globalThis.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = globalThis.setTimeout(() => {
      void flushPending();
    }, debounceMs);

    if (!maxTimerRef.current) {
      maxTimerRef.current = globalThis.setTimeout(() => {
        void flushPending();
      }, maxDirtyMs);
    }
  }, [debounceMs, enabled, flushPending, maxDirtyMs, sessionId, snapshot, snapshotHash]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushPending();
      }
    };
    const handlePageHide = () => {
      void flushPending();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [enabled, flushPending]);

  useEffect(
    () => () => {
      void flushPending();
      clearTimers();
    },
    [clearTimers, flushPending]
  );
};
