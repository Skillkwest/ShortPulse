/**
 * AI Studio restore-candidate loader hook.
 * Loads the freshest snapshot candidate for the current `sid` without applying hydration yet.
 */
import { useEffect, useState } from "react";
import {
  loadAiStudioSessionRestoreCandidate,
  type AiStudioSessionRestoreSource,
} from "../logic/sessionRestoreCandidate";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import { readAiStudioSessionPersistencePolicy } from "../logic/sessionPersistencePolicy";

const {
  restoreShadowEnabled: RESTORE_CANDIDATE_ENABLED,
  restoreRemoteEnabled: RESTORE_REMOTE_ENABLED,
} = readAiStudioSessionPersistencePolicy();

export type AiStudioSessionRestoreCandidateState = {
  status: "idle" | "loading" | "ready";
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioSessionRestoreSource;
};

type LoadedRestoreCandidate = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioSessionRestoreSource;
};

/**
 * Loads a restore candidate for `sessionId` when restore-candidate shadow mode is enabled.
 */
export const useAiStudioSessionRestoreCandidate = ({
  sessionId,
  enabled = RESTORE_CANDIDATE_ENABLED,
}: {
  sessionId: string | null;
  enabled?: boolean;
}): AiStudioSessionRestoreCandidateState => {
  const [loadedCandidate, setLoadedCandidate] = useState<LoadedRestoreCandidate | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    let cancelled = false;

    void loadAiStudioSessionRestoreCandidate({
      sessionId,
      remoteEnabled: RESTORE_REMOTE_ENABLED,
    }).then((candidate) => {
      if (cancelled) return;
      setLoadedCandidate({
        sessionId,
        snapshot: candidate.snapshot,
        source: candidate.source,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, sessionId]);

  if (!enabled || !sessionId) {
    return {
      status: "idle",
      snapshot: null,
      source: "none",
    };
  }

  if (!loadedCandidate || loadedCandidate.sessionId !== sessionId) {
    return {
      status: "loading",
      snapshot: null,
      source: "none",
    };
  }

  return {
    status: "ready",
    snapshot: loadedCandidate.snapshot,
    source: loadedCandidate.source,
  };
};
