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
  enabled: enabledProp,
}: {
  sessionId: string | null;
  enabled?: boolean;
}): AiStudioSessionRestoreCandidateState => {
  const { restoreShadowEnabled, restoreRemoteEnabled } = readAiStudioSessionPersistencePolicy();
  const enabled = enabledProp ?? restoreShadowEnabled;
  const [loadedCandidate, setLoadedCandidate] = useState<LoadedRestoreCandidate | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    let cancelled = false;

    void loadAiStudioSessionRestoreCandidate({
      sessionId,
      remoteEnabled: restoreRemoteEnabled,
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
  }, [enabled, restoreRemoteEnabled, sessionId]);

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
