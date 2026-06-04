/**
 * AI Studio workspace autosave hook.
 * Debounces snapshot writes, enforces payload-size guardrails, and flushes on lifecycle exits.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import { AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES } from "../logic/sessionSnapshotCanvas";
import {
  prepareAiStudioSessionAutosaveSnapshot,
  type PreparedAiStudioSessionAutosaveSnapshot,
} from "../logic/sessionAutosaveSerialization";

type PersistSnapshotFn = (
  sessionId: string,
  snapshot: AiStudioSessionSnapshot,
  options?: { keepalive?: boolean; title?: string | null; snapshotHash?: string | null }
) => Promise<void> | void;

type PersistErrorReason = "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";

export type AiStudioSessionAutosaveError = {
  reason: PersistErrorReason;
  sessionId: string | null;
  snapshotHash?: string | null;
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  keepalive?: boolean;
  attempt?: number;
  maxAttempts?: number;
  willRetry?: boolean;
  remainingRetries?: number;
};

type UseAiStudioSessionAutosaveArgs = {
  sessionId: string | null;
  snapshot: AiStudioSessionSnapshot | null;
  enabled: boolean;
  persistSnapshot: PersistSnapshotFn;
  debounceMs?: number;
  maxDirtyMs?: number;
  maxSnapshotBytes?: number;
  maxKeepaliveSnapshotBytes?: number;
  maxPersistRetries?: number;
  resolveSnapshotTitle?: (snapshot: AiStudioSessionSnapshot) => string | null;
  preparedSnapshot?: PreparedAiStudioSessionAutosaveSnapshot | null;
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
const DEFAULT_MAX_PERSIST_RETRIES = 1;

const hasMatchingPersistIdentity = (
  value: SnapshotPersistIdentity | PendingSnapshotState | null,
  expected: SnapshotPersistIdentity
): boolean =>
  Boolean(
    value &&
    value.sessionId === expected.sessionId &&
    value.hash === expected.hash &&
    value.title === expected.title
  );

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
  maxKeepaliveSnapshotBytes = Number.POSITIVE_INFINITY,
  maxPersistRetries = DEFAULT_MAX_PERSIST_RETRIES,
  resolveSnapshotTitle = () => null,
  preparedSnapshot = null,
  onPersistError,
}: UseAiStudioSessionAutosaveArgs): void => {
  const pendingRef = useRef<PendingSnapshotState | null>(null);
  const inFlightRef = useRef<SnapshotPersistIdentity | null>(null);
  const lastSavedRef = useRef<SnapshotPersistIdentity | null>(null);
  const lastPersistFailureRef = useRef<(SnapshotPersistIdentity & { count: number }) | null>(null);
  const lastSizeErrorRef = useRef<Pick<SnapshotPersistIdentity, "sessionId" | "hash"> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const keepaliveSnapshotBytesLimit = Number.isFinite(maxKeepaliveSnapshotBytes)
    ? Math.max(0, Math.trunc(maxKeepaliveSnapshotBytes))
    : Number.POSITIVE_INFINITY;

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
        if (inFlightRef.current) return;
        const pending = pendingRef.current;
        if (!pending) return;
        pendingRef.current = null;
        clearTimers();
        const pendingIdentity = {
          sessionId: pending.sessionId,
          hash: pending.hash,
          title: pending.title,
        };
        inFlightRef.current = pendingIdentity;
        const shouldUseKeepalive =
          options?.keepalive === true && pending.snapshotBytes <= keepaliveSnapshotBytesLimit;
        try {
          await Promise.resolve(
            persistSnapshot(pending.sessionId, pending.snapshot, {
              keepalive: shouldUseKeepalive,
              title: pending.title,
              snapshotHash: pending.hash,
            })
          );
          lastPersistFailureRef.current = null;
          lastSavedRef.current = pendingIdentity;
        } catch (error) {
          const previousPersistFailure = lastPersistFailureRef.current;
          const previousFailureCount =
            previousPersistFailure &&
            hasMatchingPersistIdentity(previousPersistFailure, pendingIdentity)
              ? previousPersistFailure.count
              : 0;
          const nextFailureCount = previousFailureCount + 1;
          const supersedingPendingQueued =
            pendingRef.current !== null &&
            !hasMatchingPersistIdentity(pendingRef.current, pendingIdentity);
          const shouldRetrySameSnapshot =
            nextFailureCount <= maxPersistRetries && !supersedingPendingQueued;
          const willRetry = shouldRetrySameSnapshot || supersedingPendingQueued;
          lastPersistFailureRef.current = {
            ...pendingIdentity,
            count: nextFailureCount,
          };
          if (shouldRetrySameSnapshot) {
            pendingRef.current = pending;
          }
          reportPersistError(
            error instanceof Error ? error : new Error("Session snapshot persistence failed."),
            {
              reason: "persist_failed",
              sessionId: pending.sessionId,
              snapshotHash: pending.hash,
              snapshotBytes: pending.snapshotBytes,
              maxSnapshotBytes: maxSnapshotBytes,
              keepalive: shouldUseKeepalive,
              attempt: nextFailureCount,
              maxAttempts: maxPersistRetries + 1,
              willRetry,
              remainingRetries: shouldRetrySameSnapshot
                ? maxPersistRetries - nextFailureCount + 1
                : 0,
            }
          );
          if (shouldRetrySameSnapshot) {
            debounceTimerRef.current = globalThis.setTimeout(() => {
              void flush();
            }, debounceMs);
          }
        } finally {
          if (hasMatchingPersistIdentity(inFlightRef.current, pendingIdentity)) {
            inFlightRef.current = null;
          }
          if (
            pendingRef.current !== null &&
            !hasMatchingPersistIdentity(pendingRef.current, pendingIdentity)
          ) {
            void flush();
          }
        }
      };
      return flush();
    },
    [
      clearTimers,
      debounceMs,
      keepaliveSnapshotBytesLimit,
      maxPersistRetries,
      maxSnapshotBytes,
      persistSnapshot,
      reportPersistError,
    ]
  );

  const serializedSnapshot = useMemo(() => {
    if (!snapshot) return null;
    if (preparedSnapshot) {
      return preparedSnapshot;
    }
    return prepareAiStudioSessionAutosaveSnapshot(snapshot, {
      title: resolveSnapshotTitle(snapshot),
    });
  }, [preparedSnapshot, resolveSnapshotTitle, snapshot]);

  useEffect(() => {
    if (!enabled || !sessionId || !snapshot || !serializedSnapshot) return;

    if (
      lastPersistFailureRef.current &&
      (lastPersistFailureRef.current.sessionId !== sessionId ||
        lastPersistFailureRef.current.hash !== serializedSnapshot.hash ||
        lastPersistFailureRef.current.title !== serializedSnapshot.title)
    ) {
      lastPersistFailureRef.current = null;
    }

    if (
      lastPersistFailureRef.current?.sessionId === sessionId &&
      lastPersistFailureRef.current?.hash === serializedSnapshot.hash &&
      lastPersistFailureRef.current?.title === serializedSnapshot.title &&
      lastPersistFailureRef.current.count > maxPersistRetries
    ) {
      return;
    }

    if (!serializedSnapshot.hash) {
      reportPersistError(new Error("Session snapshot could not be serialized."), {
        reason: "snapshot_serialize_failed",
        sessionId,
        snapshotHash: null,
        maxSnapshotBytes,
      });
      return;
    }

    if (serializedSnapshot.bytes > maxSnapshotBytes) {
      if (
        lastSizeErrorRef.current?.sessionId !== sessionId ||
        lastSizeErrorRef.current?.hash !== serializedSnapshot.hash
      ) {
        lastSizeErrorRef.current = {
          sessionId,
          hash: serializedSnapshot.hash,
        };
        reportPersistError(new Error("Session snapshot exceeds maximum size."), {
          reason: "snapshot_too_large",
          sessionId,
          snapshotHash: serializedSnapshot.hash,
          snapshotBytes: serializedSnapshot.bytes,
          maxSnapshotBytes,
        });
      }
      return;
    }

    if (
      lastSavedRef.current?.sessionId === sessionId &&
      lastSavedRef.current?.hash === serializedSnapshot.hash &&
      lastSavedRef.current?.title === serializedSnapshot.title
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

    if (inFlight) {
      return;
    }

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
    maxPersistRetries,
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
