/**
 * AI Studio project-workspace restore hydration orchestrator.
 * Applies one-shot hydration per project id for project-owned workspace restore.
 */
import { useEffect, useRef } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { AiStudioProjectWorkspaceRestoreCandidateState } from "./useAiStudioProjectWorkspaceRestoreCandidate";

type UseAiStudioProjectWorkspaceRestoreHydrationParams = {
  projectId: string | null;
  projectWorkspaceRestoreCandidate: AiStudioProjectWorkspaceRestoreCandidateState;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  applyEmptyProjectState?: () => void;
  onProjectBootstrapSettled?: (projectId: string) => void;
};

/**
 * Logs restore readiness and applies one-shot project workspace hydration.
 */
export const useAiStudioProjectWorkspaceRestoreHydration = ({
  projectId,
  projectWorkspaceRestoreCandidate,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  onProjectBootstrapSettled,
}: UseAiStudioProjectWorkspaceRestoreHydrationParams) => {
  const candidateLogKeyRef = useRef<string | null>(null);
  const hydrationAppliedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      projectWorkspaceRestoreCandidate.status !== "ready" &&
      projectWorkspaceRestoreCandidate.status !== "error"
    ) {
      return;
    }

    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
    const logKey = [
      projectId ?? "none",
      projectWorkspaceRestoreCandidate.result,
      snapshot?.updatedAt ?? "none",
      projectWorkspaceRestoreCandidate.status === "error"
        ? "error"
        : snapshot
          ? "present"
          : "empty",
    ].join("|");
    if (candidateLogKeyRef.current === logKey) return;
    candidateLogKeyRef.current = logKey;

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_project_workspace_restore_candidate_loaded",
      data: {
        project_id: projectId,
        result: projectWorkspaceRestoreCandidate.result,
        source: projectWorkspaceRestoreCandidate.source,
        has_snapshot: Boolean(snapshot),
        snapshot_updated_at: snapshot?.updatedAt ?? null,
        error: projectWorkspaceRestoreCandidate.error,
      },
    });
  }, [
    projectWorkspaceRestoreCandidate.error,
    projectWorkspaceRestoreCandidate.result,
    projectId,
    projectWorkspaceRestoreCandidate.snapshot,
    projectWorkspaceRestoreCandidate.source,
    projectWorkspaceRestoreCandidate.status,
  ]);

  useEffect(() => {
    if (!projectId || projectWorkspaceRestoreCandidate.status !== "ready") return;
    if (hydrationAppliedProjectIdRef.current === projectId) return;
    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
    if (snapshot) {
      const payload = hydrateFromSessionSnapshot(snapshot);
      hydrateFromSessionAgentSnapshot(payload);
      hydrateFromSessionExpertEditSnapshot?.(payload.expertEdit);
    } else {
      applyEmptyProjectState?.();
    }
    hydrationAppliedProjectIdRef.current = projectId;
    onProjectBootstrapSettled?.(projectId);

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: snapshot
        ? "ai_studio_project_workspace_hydration_applied"
        : "ai_studio_project_workspace_empty_state_applied",
      data: {
        project_id: projectId,
        source: projectWorkspaceRestoreCandidate.source,
        snapshot_updated_at: snapshot?.updatedAt ?? null,
        empty_project_applied: !snapshot,
        expert_edit_hydration_applied: Boolean(hydrateFromSessionExpertEditSnapshot),
      },
    });
  }, [
    applyEmptyProjectState,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    hydrateFromSessionSnapshot,
    onProjectBootstrapSettled,
    projectId,
    projectWorkspaceRestoreCandidate.snapshot,
    projectWorkspaceRestoreCandidate.source,
    projectWorkspaceRestoreCandidate.status,
  ]);
};
