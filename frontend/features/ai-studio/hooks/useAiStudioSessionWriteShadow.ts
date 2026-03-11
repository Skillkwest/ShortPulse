/**
 * AI Studio write-shadow persistence hook.
 * Debounces session snapshot writes, enforces payload-size guardrails, and flushes on lifecycle exits.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import { resolveAiStudioSessionSnapshotTitle } from "../logic/sessionSnapshotTitle";
import { AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES } from "../logic/sessionSnapshotCanvas";
import { saveAiStudioSessionShadow } from "../logic/sessionSnapshotStorage";

type PersistSnapshotFn = (
  sessionId: string,
  snapshot: AiStudioSessionSnapshot,
  options?: { keepalive?: boolean; title?: string | null }
) => Promise<void> | void;

type PersistErrorReason = "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";

export type AiStudioSessionWriteShadowError = {
  reason: PersistErrorReason;
  sessionId: string | null;
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  keepalive?: boolean;
};

type UseAiStudioSessionWriteShadowArgs = {
  sessionId: string | null;
  snapshot: AiStudioSessionSnapshot | null;
  enabled?: boolean;
  debounceMs?: number;
  maxDirtyMs?: number;
  maxSnapshotBytes?: number;
  persistSnapshot?: PersistSnapshotFn;
  resolveSnapshotTitle?: (snapshot: AiStudioSessionSnapshot) => string | null;
  onPersistError?: (error: Error, details: AiStudioSessionWriteShadowError) => void;
};

type PendingSnapshotState = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshot;
  hash: string;
  title: string | null;
  snapshotBytes: number;
};

const DEFAULT_DEBOUNCE_MS = 2500;
const DEFAULT_MAX_DIRTY_MS = 15000;
const WRITE_SHADOW_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED !== "false";

const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
};

/**
 * Persists `snapshot` for the active `sessionId` in debounced write-shadow mode.
 */
export const useAiStudioSessionWriteShadow = ({
  sessionId,
  snapshot,
  enabled = WRITE_SHADOW_ENABLED,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxDirtyMs = DEFAULT_MAX_DIRTY_MS,
  maxSnapshotBytes = AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES,
  persistSnapshot = saveAiStudioSessionShadow,
  resolveSnapshotTitle = resolveAiStudioSessionSnapshotTitle,
  onPersistError,
}: UseAiStudioSessionWriteShadowArgs): void => {
  const pendingRef = useRef<PendingSnapshotState | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const lastSizeErrorHashRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const reportPersistError = useCallback(
    (error: Error, details: AiStudioSessionWriteShadowError) => {
      onPersistError?.(error, details);
    },
    [onPersistError]
  );

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

  const flushPending = useCallback(
    (options?: { keepalive?: boolean }) => {
      const flush = async (): Promise<void> => {
        const pending = pendingRef.current;
        if (!pending) return;
        pendingRef.current = null;
        clearTimers();
        try {
          await Promise.resolve(
            persistSnapshot(pending.sessionId, pending.snapshot, {
              keepalive: options?.keepalive === true,
              title: pending.title,
            })
          );
          lastSavedHashRef.current = pending.hash;
        } catch (error) {
          pendingRef.current = pending;
          reportPersistError(
            error instanceof Error ? error : new Error("Session snapshot persistence failed."),
            {
              reason: "persist_failed",
              sessionId: pending.sessionId,
              snapshotBytes: pending.snapshotBytes,
              maxSnapshotBytes: maxSnapshotBytes,
              keepalive: options?.keepalive === true,
            }
          );
          debounceTimerRef.current = globalThis.setTimeout(() => {
            void flush();
          }, debounceMs);
        }
      };
      return flush();
    },
    [clearTimers, debounceMs, maxSnapshotBytes, persistSnapshot, reportPersistError]
  );

  const serializedSnapshot = useMemo(() => {
    if (!snapshot) return null;
    try {
      const json = JSON.stringify(snapshot);
      return {
        hash: json,
        bytes: utf8ByteLength(json),
        title: resolveSnapshotTitle(snapshot),
      };
    } catch {
      return {
        hash: null,
        bytes: Number.POSITIVE_INFINITY,
        title: resolveSnapshotTitle(snapshot),
      };
    }
  }, [resolveSnapshotTitle, snapshot]);

  useEffect(() => {
    if (!enabled || !sessionId || !snapshot || !serializedSnapshot) return;

    if (!serializedSnapshot.hash) {
      reportPersistError(new Error("Session snapshot could not be serialized."), {
        reason: "snapshot_serialize_failed",
        sessionId,
        maxSnapshotBytes,
      });
      return;
    }

    if (serializedSnapshot.bytes > maxSnapshotBytes) {
      if (lastSizeErrorHashRef.current !== serializedSnapshot.hash) {
        lastSizeErrorHashRef.current = serializedSnapshot.hash;
        reportPersistError(new Error("Session snapshot exceeds maximum size."), {
          reason: "snapshot_too_large",
          sessionId,
          snapshotBytes: serializedSnapshot.bytes,
          maxSnapshotBytes,
        });
      }
      return;
    }

    if (lastSavedHashRef.current === serializedSnapshot.hash) return;

    const pending = pendingRef.current;
    if (pending && pending.sessionId !== sessionId) {
      void flushPending();
    }

    pendingRef.current = {
      sessionId,
      snapshot,
      hash: serializedSnapshot.hash,
      title: serializedSnapshot.title,
      snapshotBytes: serializedSnapshot.bytes,
    };

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
  }, [
    debounceMs,
    enabled,
    flushPending,
    maxDirtyMs,
    maxSnapshotBytes,
    reportPersistError,
    serializedSnapshot,
    sessionId,
    snapshot,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushPending({ keepalive: true });
      }
    };
    const handlePageHide = () => {
      void flushPending({ keepalive: true });
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
