/**
 * AI Studio workspace autosave hook.
 * Debounces snapshot writes, enforces payload-size guardrails, and flushes on lifecycle exits.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import { AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES } from "../logic/sessionSnapshotCanvas";

type PersistSnapshotFn = (
  sessionId: string,
  snapshot: AiStudioSessionSnapshot,
  options?: { keepalive?: boolean; title?: string | null }
) => Promise<void> | void;

type PersistErrorReason = "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";

export type AiStudioSessionAutosaveError = {
  reason: PersistErrorReason;
  sessionId: string | null;
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  keepalive?: boolean;
};

type UseAiStudioSessionAutosaveArgs = {
  sessionId: string | null;
  snapshot: AiStudioSessionSnapshot | null;
  enabled: boolean;
  persistSnapshot: PersistSnapshotFn;
  debounceMs?: number;
  maxDirtyMs?: number;
  maxSnapshotBytes?: number;
  resolveSnapshotTitle?: (snapshot: AiStudioSessionSnapshot) => string | null;
  onPersistError?: (error: Error, details: AiStudioSessionAutosaveError) => void;
};

type PendingSnapshotState = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshot;
  hash: string;
  title: string | null;
  snapshotBytes: number;
};

type SnapshotPersistIdentity = Pick<PendingSnapshotState, "sessionId" | "hash" | "title">;

const DEFAULT_DEBOUNCE_MS = 2500;
const DEFAULT_MAX_DIRTY_MS = 15000;

const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
};

const stripVolatileSnapshotFields = (
  snapshot: AiStudioSessionSnapshot
): Record<string, unknown> => {
  const normalizedSnapshot = { ...snapshot } as Record<string, unknown>;
  delete normalizedSnapshot.updatedAt;

  const metaValue = normalizedSnapshot.meta;
  if (metaValue && typeof metaValue === "object" && !Array.isArray(metaValue)) {
    const normalizedMeta = { ...(metaValue as Record<string, unknown>) };
    delete normalizedMeta.generatedAt;
    delete normalizedMeta.checksum;
    if (Object.keys(normalizedMeta).length > 0) {
      normalizedSnapshot.meta = normalizedMeta;
    } else {
      delete normalizedSnapshot.meta;
    }
  }

  return normalizedSnapshot;
};

/**
 * Persists `snapshot` for the active workspace identity in debounced autosave mode.
 */
export const useAiStudioSessionAutosave = ({
  sessionId,
  snapshot,
  enabled,
  persistSnapshot,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxDirtyMs = DEFAULT_MAX_DIRTY_MS,
  maxSnapshotBytes = AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES,
  resolveSnapshotTitle = () => null,
  onPersistError,
}: UseAiStudioSessionAutosaveArgs): void => {
  const pendingRef = useRef<PendingSnapshotState | null>(null);
  const inFlightRef = useRef<SnapshotPersistIdentity | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef<string | null>(null);
  const lastSizeErrorHashRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const reportPersistError = useCallback(
    (error: Error, details: AiStudioSessionAutosaveError) => {
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
        inFlightRef.current = {
          sessionId: pending.sessionId,
          hash: pending.hash,
          title: pending.title,
        };
        try {
          await Promise.resolve(
            persistSnapshot(pending.sessionId, pending.snapshot, {
              keepalive: options?.keepalive === true,
              title: pending.title,
            })
          );
          lastSavedHashRef.current = pending.hash;
          lastSavedTitleRef.current = pending.title;
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
        } finally {
          if (
            inFlightRef.current?.sessionId === pending.sessionId &&
            inFlightRef.current?.hash === pending.hash &&
            inFlightRef.current?.title === pending.title
          ) {
            inFlightRef.current = null;
          }
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
      const semanticJson = JSON.stringify(stripVolatileSnapshotFields(snapshot));
      return {
        hash: semanticJson,
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

    if (
      lastSavedHashRef.current === serializedSnapshot.hash &&
      lastSavedTitleRef.current === serializedSnapshot.title
    ) {
      return;
    }

    const pending = pendingRef.current;
    if (
      pending &&
      pending.sessionId === sessionId &&
      pending.hash === serializedSnapshot.hash &&
      pending.title === serializedSnapshot.title
    ) {
      return;
    }
    if (pending && pending.sessionId !== sessionId) {
      void flushPending();
    }
    const inFlight = inFlightRef.current;
    if (
      inFlight &&
      inFlight.sessionId === sessionId &&
      inFlight.hash === serializedSnapshot.hash &&
      inFlight.title === serializedSnapshot.title
    ) {
      return;
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
