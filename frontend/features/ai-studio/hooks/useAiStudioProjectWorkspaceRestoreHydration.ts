/**
 * AI Studio project-workspace restore hydration orchestrator.
 * Applies project workspace hydration once per resolved snapshot identity for restore safety.
 */
import { useEffect, useRef } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { AiStudioProjectWorkspaceRestoreCandidateState } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";

type UseAiStudioProjectWorkspaceRestoreHydrationParams = {
  projectId: string | null;
  projectWorkspaceRestoreCandidate: AiStudioProjectWorkspaceRestoreCandidateState;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  onProjectBootstrapSettled?: (projectId: string) => void;
  onProjectBootstrapFailed?: (projectId: string, error: Error) => void;
};

/**
 * Logs restore readiness and applies project workspace hydration for the latest restore candidate.
 */
export const useAiStudioProjectWorkspaceRestoreHydration = ({
  projectId,
  projectWorkspaceRestoreCandidate,
  hydrateFromSessionSnapshot,
  hydrateFromSessionCanvasSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  onProjectBootstrapSettled,
  onProjectBootstrapFailed,
}: UseAiStudioProjectWorkspaceRestoreHydrationParams) => {
  const candidateLogKeyRef = useRef<string | null>(null);
  const hydrationAppliedKeyRef = useRef<string | null>(null);
  const bootstrapSettleTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => {
    if (projectId) return;
    hydrationAppliedKeyRef.current = null;
  }, [projectId]);

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
    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
    const hydrationKey = [
      projectId,
      projectWorkspaceRestoreCandidate.result,
      snapshot?.updatedAt ?? "none",
      snapshot ? "snapshot" : "empty",
    ].join("|");
    if (hydrationAppliedKeyRef.current === hydrationKey) return;
    if (bootstrapSettleTimerRef.current) {
      globalThis.clearTimeout(bootstrapSettleTimerRef.current);
      bootstrapSettleTimerRef.current = null;
    }
    try {
      if (snapshot) {
        resetProjectAgentConversation?.();
        const payload = hydrateFromSessionSnapshot(snapshot);
        hydrateFromSessionCanvasSnapshot?.(payload.canvas);
        hydrateFromSessionExpertEditSnapshot?.(payload.expertEdit);
      } else {
        applyEmptyProjectState?.();
      }
    } catch (error) {
      onProjectBootstrapFailed?.(
        projectId,
        error instanceof Error ? error : new Error("Failed to apply project workspace.")
      );
      return;
    }
    hydrationAppliedKeyRef.current = hydrationKey;
    bootstrapSettleTimerRef.current = globalThis.setTimeout(() => {
      if (hydrationAppliedKeyRef.current !== hydrationKey) return;
      onProjectBootstrapSettled?.(projectId);
      bootstrapSettleTimerRef.current = null;
    }, 0);

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
        agent_conversation_reset: Boolean(resetProjectAgentConversation && snapshot),
        canvas_hydration_applied: Boolean(hydrateFromSessionCanvasSnapshot),
        expert_edit_hydration_applied: Boolean(hydrateFromSessionExpertEditSnapshot),
      },
    });
  }, [
    applyEmptyProjectState,
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    hydrateFromSessionSnapshot,
    onProjectBootstrapFailed,
    onProjectBootstrapSettled,
    projectId,
    projectWorkspaceRestoreCandidate.snapshot,
    projectWorkspaceRestoreCandidate.source,
    projectWorkspaceRestoreCandidate.status,
    resetProjectAgentConversation,
  ]);

  useEffect(
    () => () => {
      if (bootstrapSettleTimerRef.current) {
        globalThis.clearTimeout(bootstrapSettleTimerRef.current);
      }
    },
    []
  );
};
