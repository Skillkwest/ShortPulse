/**
 * AI Studio project-workspace restore-candidate loader hook.
 * Loads the persisted project-owned workspace snapshot for the current `projectId`.
 */
import { useEffect, useState } from "react";
import { getAiStudioProjectWorkspaceSnapshotViaApi } from "../logic/projectWorkspaceApiClient";
import {
  parseAiStudioSessionSnapshotForRestore,
  type AiStudioSessionRestoreSource,
} from "../logic/sessionRestoreCandidate";
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";

export type AiStudioProjectWorkspaceRestoreCandidateState = {
  status: "idle" | "loading" | "ready" | "error";
  result: "idle" | "loading" | "found_snapshot" | "no_snapshot" | "load_failed";
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioSessionRestoreSource;
  error: string | null;
  retry: () => void;
};

/**
 * Loads the current project workspace snapshot when project restore is active.
 */
export const useAiStudioProjectWorkspaceRestoreCandidate = ({
  projectId,
  enabled = true,
}: {
  projectId: string | null;
  enabled?: boolean;
}): AiStudioProjectWorkspaceRestoreCandidateState => {
  const [loadedCandidate, setLoadedCandidate] = useState<{
    projectId: string;
    status: "ready" | "error";
    snapshot: AiStudioSessionSnapshot | null;
    error: string | null;
  } | null>(null);
  const [requestNonce, setRequestNonce] = useState(0);

  useEffect(() => {
    if (!enabled || !projectId) return;

    let cancelled = false;

    void getAiStudioProjectWorkspaceSnapshotViaApi({ projectId })
      .then((workspace) => {
        if (cancelled) return;
        setLoadedCandidate({
          projectId,
          status: "ready",
          snapshot: (() => {
            const snapshot = parseAiStudioSessionSnapshotForRestore(
              workspace?.snapshot ?? null,
              null
            );
            return snapshot ? createAiStudioProjectWorkspaceSnapshot(snapshot) : null;
          })(),
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadedCandidate({
          projectId,
          status: "error",
          snapshot: null,
          error: error instanceof Error ? error.message : "Failed to load project workspace.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, requestNonce]);

  const retry = () => {
    setRequestNonce((value) => value + 1);
  };

  if (!enabled || !projectId) {
    return {
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
      retry,
    };
  }

  if (!loadedCandidate || loadedCandidate.projectId !== projectId) {
    return {
      status: "loading",
      result: "loading",
      snapshot: null,
      source: "none",
      error: null,
      retry,
    };
  }

  if (loadedCandidate.status === "error") {
    return {
      status: "error",
      result: "load_failed",
      snapshot: null,
      source: "none",
      error: loadedCandidate.error,
      retry,
    };
  }

  return {
    status: "ready",
    result: loadedCandidate.snapshot ? "found_snapshot" : "no_snapshot",
    snapshot: loadedCandidate.snapshot,
    source: loadedCandidate.snapshot ? "project" : "none",
    error: null,
    retry,
  };
};
