/**
 * AI Studio restore-candidate loader hook.
 * Loads the freshest snapshot candidate for the current `sid` without applying hydration yet.
 */
import { useEffect, useState } from "react";
import {
  loadAiStudioSessionRestoreCandidate,
  type AiStudioSessionRestoreSource,
} from "../logic/sessionRestoreCandidate";
import type { AiStudioSessionSnapshotV1 } from "../logic/sessionSnapshot";

const RESTORE_CANDIDATE_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED === "true";

export type AiStudioSessionRestoreCandidateState = {
  status: "idle" | "loading" | "ready";
  snapshot: AiStudioSessionSnapshotV1 | null;
  source: AiStudioSessionRestoreSource;
};

type LoadedRestoreCandidate = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshotV1 | null;
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
      remoteEnabled: true,
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
