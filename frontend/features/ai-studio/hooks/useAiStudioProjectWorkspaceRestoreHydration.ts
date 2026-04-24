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
}: UseAiStudioProjectWorkspaceRestoreHydrationParams) => {
  const candidateLogKeyRef = useRef<string | null>(null);
  const hydrationAppliedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectWorkspaceRestoreCandidate.status !== "ready") return;

    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
    const logKey = [
      projectId ?? "none",
      projectWorkspaceRestoreCandidate.source,
      snapshot?.updatedAt ?? "none",
      snapshot ? "present" : "empty",
    ].join("|");
    if (candidateLogKeyRef.current === logKey) return;
    candidateLogKeyRef.current = logKey;

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_project_workspace_restore_candidate_loaded",
      data: {
        project_id: projectId,
        source: projectWorkspaceRestoreCandidate.source,
        has_snapshot: Boolean(snapshot),
        snapshot_updated_at: snapshot?.updatedAt ?? null,
      },
    });
  }, [
    projectId,
    projectWorkspaceRestoreCandidate.snapshot,
    projectWorkspaceRestoreCandidate.source,
    projectWorkspaceRestoreCandidate.status,
  ]);

  useEffect(() => {
    if (!projectId || projectWorkspaceRestoreCandidate.status !== "ready") return;
    if (hydrationAppliedProjectIdRef.current === projectId) return;
    if (!projectWorkspaceRestoreCandidate.snapshot) return;

    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
    const payload = hydrateFromSessionSnapshot(snapshot);
    hydrateFromSessionAgentSnapshot(payload);
    hydrateFromSessionExpertEditSnapshot?.(payload.expertEdit);
    hydrationAppliedProjectIdRef.current = projectId;

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_project_workspace_hydration_applied",
      data: {
        project_id: projectId,
        source: projectWorkspaceRestoreCandidate.source,
        snapshot_updated_at: snapshot.updatedAt,
        expert_edit_hydration_applied: Boolean(hydrateFromSessionExpertEditSnapshot),
      },
    });
  }, [
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    hydrateFromSessionSnapshot,
    projectId,
    projectWorkspaceRestoreCandidate.snapshot,
    projectWorkspaceRestoreCandidate.source,
    projectWorkspaceRestoreCandidate.status,
  ]);
};
