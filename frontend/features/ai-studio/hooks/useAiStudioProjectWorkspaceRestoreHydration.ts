/**
 * AI Studio project-workspace restore hydration orchestrator.
 * Applies one-shot hydration per project id for project-owned workspace restore.
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
 * Logs restore readiness and applies one-shot project workspace hydration.
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
  const hydrationAppliedProjectIdRef = useRef<string | null>(null);
  const bootstrapSettleTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

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
    if (bootstrapSettleTimerRef.current) {
      globalThis.clearTimeout(bootstrapSettleTimerRef.current);
      bootstrapSettleTimerRef.current = null;
    }
    const snapshot = projectWorkspaceRestoreCandidate.snapshot;
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
    hydrationAppliedProjectIdRef.current = projectId;
    bootstrapSettleTimerRef.current = globalThis.setTimeout(() => {
      if (hydrationAppliedProjectIdRef.current !== projectId) return;
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
