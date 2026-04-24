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
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";

export type AiStudioProjectWorkspaceRestoreCandidateState = {
  status: "idle" | "loading" | "ready";
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioSessionRestoreSource;
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
    snapshot: AiStudioSessionSnapshot | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !projectId) return;

    let cancelled = false;

    void getAiStudioProjectWorkspaceSnapshotViaApi({ projectId })
      .then((workspace) => {
        if (cancelled) return;
        setLoadedCandidate({
          projectId,
          snapshot: parseAiStudioSessionSnapshotForRestore(workspace?.snapshot ?? null, null),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedCandidate({
          projectId,
          snapshot: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId]);

  if (!enabled || !projectId) {
    return {
      status: "idle",
      snapshot: null,
      source: "none",
    };
  }

  if (!loadedCandidate || loadedCandidate.projectId !== projectId) {
    return {
      status: "loading",
      snapshot: null,
      source: "none",
    };
  }

  return {
    status: "ready",
    snapshot: loadedCandidate.snapshot,
    source: loadedCandidate.snapshot ? "project" : "none",
  };
};
