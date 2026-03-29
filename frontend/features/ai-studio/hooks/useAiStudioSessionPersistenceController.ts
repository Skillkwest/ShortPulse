/**
 * AI Studio session persistence controller.
 * Orchestrates sid identity, restore candidate loading/apply, and debounced local+remote write shadow.
 */
import { useCallback, useMemo, useState } from "react";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { persistAiStudioSessionShadow } from "../logic/sessionShadowPersistence";
import { readAiStudioSessionPersistencePolicy } from "../logic/sessionPersistencePolicy";
import { resolveAiStudioSessionSnapshotTitle } from "../logic/sessionSnapshotTitle";
import {
  useAiStudioSessionRestoreCandidate,
  type AiStudioSessionRestoreCandidateState,
} from "./useAiStudioSessionRestoreCandidate";
import { useAiStudioSessionRestoreHydration } from "./useAiStudioSessionRestoreHydration";
import {
  useAiStudioSessionWriteShadow,
  type AiStudioSessionWriteShadowError,
} from "./useAiStudioSessionWriteShadow";

type UseAiStudioSessionPersistenceControllerParams = {
  sessionId: string | null;
  buildSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
  sessionTitleOverride?: string | null;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  hydrateFromSessionCanvasSnapshot: (canvas: AiStudioSessionHydrationPayload["canvas"]) => void;
  onPersistenceWarning?: (message: string) => void;
};

export type AiStudioSessionPersistenceController = {
  sessionId: string | null;
  sessionSnapshot: AiStudioSessionSnapshot | null;
  sessionRestoreCandidate: AiStudioSessionRestoreCandidateState;
  setSkipRestoreApplyForSessionId: (sessionId: string | null) => void;
};

const formatOversizeMessage = ({
  snapshotBytes,
  maxSnapshotBytes,
}: {
  snapshotBytes?: number;
  maxSnapshotBytes: number;
}): string => {
  const currentKb = typeof snapshotBytes === "number" ? Math.ceil(snapshotBytes / 1024) : null;
  const limitKb = Math.ceil(maxSnapshotBytes / 1024);
  if (currentKb == null) {
    return `Session autosave skipped because snapshot size exceeded the ${limitKb}KB limit.`;
  }
  return `Session autosave skipped because snapshot size (${currentKb}KB) exceeded the ${limitKb}KB limit.`;
};

const resolvePersistenceWarningMessage = (
  details: AiStudioSessionWriteShadowError,
  error: Error
): string => {
  switch (details.reason) {
    case "snapshot_too_large":
      return formatOversizeMessage(details);
    case "snapshot_serialize_failed":
      return "Session autosave skipped because snapshot serialization failed.";
    case "persist_failed":
      return `Session autosave is retrying in the background: ${error.message}`;
    default:
      return "Session autosave encountered an issue and will retry.";
  }
};

/**
 * Returns session persistence wiring for the AI Studio page orchestration layer.
 */
export const useAiStudioSessionPersistenceController = ({
  sessionId,
  buildSessionSnapshot,
  sessionTitleOverride,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionCanvasSnapshot,
  onPersistenceWarning,
}: UseAiStudioSessionPersistenceControllerParams): AiStudioSessionPersistenceController => {
  const { persistenceEnabled, writeShadowEnabled, restoreShadowEnabled } =
    readAiStudioSessionPersistencePolicy();
  const [skipRestoreApplyForSessionId, setSkipRestoreApplyForSessionId] = useState<string | null>(
    null
  );

  const sessionSnapshot = useMemo(
    () =>
      persistenceEnabled && writeShadowEnabled && sessionId
        ? buildSessionSnapshot(sessionId)
        : null,
    [buildSessionSnapshot, persistenceEnabled, sessionId, writeShadowEnabled]
  );

  const sessionRestoreCandidate = useAiStudioSessionRestoreCandidate({
    sessionId,
    enabled: persistenceEnabled && restoreShadowEnabled,
  });

  useAiStudioSessionRestoreHydration({
    sessionId,
    sessionRestoreCandidate,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot,
    skipApplyForSessionId: skipRestoreApplyForSessionId,
  });

  const handlePersistError = useCallback(
    (error: Error, details: AiStudioSessionWriteShadowError) => {
      const message = resolvePersistenceWarningMessage(details, error);
      onPersistenceWarning?.(message);
    },
    [onPersistenceWarning]
  );

  useAiStudioSessionWriteShadow({
    sessionId,
    snapshot: sessionSnapshot,
    enabled: persistenceEnabled && writeShadowEnabled,
    persistSnapshot: persistAiStudioSessionShadow,
    resolveSnapshotTitle: (snapshot) =>
      sessionTitleOverride ?? resolveAiStudioSessionSnapshotTitle(snapshot),
    onPersistError: handlePersistError,
  });

  return {
    sessionId,
    sessionSnapshot,
    sessionRestoreCandidate,
    setSkipRestoreApplyForSessionId,
  };
};
