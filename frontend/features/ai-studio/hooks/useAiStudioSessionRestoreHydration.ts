/**
 * AI Studio session restore hydration orchestrator.
 * Logs restore-candidate readiness and applies gated one-shot hydration per session id.
 */
import { useEffect, useRef } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { AiStudioSessionRestoreCandidateState } from "./useAiStudioSessionRestoreCandidate";
import { readAiStudioSessionPersistencePolicy } from "../logic/sessionPersistencePolicy";

const {
  restoreApplyEnabled: RESTORE_APPLY_ENABLED,
  restoreApplyAgentEnabled: RESTORE_APPLY_AGENT_ENABLED,
} = readAiStudioSessionPersistencePolicy();

type UseAiStudioSessionRestoreHydrationParams = {
  sessionId: string | null;
  sessionRestoreCandidate: AiStudioSessionRestoreCandidateState;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionHydrationPayload["canvas"]) => void;
  applyEnabled?: boolean;
  agentApplyEnabled?: boolean;
  skipApplyForSessionId?: string | null;
};

/**
 * Handles telemetry-only candidate logging and optional one-shot hydration apply.
 */
export const useAiStudioSessionRestoreHydration = ({
  sessionId,
  sessionRestoreCandidate,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionCanvasSnapshot,
  applyEnabled = RESTORE_APPLY_ENABLED,
  agentApplyEnabled = RESTORE_APPLY_AGENT_ENABLED,
  skipApplyForSessionId = null,
}: UseAiStudioSessionRestoreHydrationParams) => {
  const sessionRestoreCandidateLogKeyRef = useRef<string | null>(null);
  const sessionHydrationAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionRestoreCandidate.status !== "ready") return;

    const snapshot = sessionRestoreCandidate.snapshot;
    const source = sessionRestoreCandidate.source;
    const logKey = [
      sessionId ?? "none",
      source,
      snapshot?.updatedAt ?? "none",
      snapshot ? "present" : "empty",
    ].join("|");
    if (sessionRestoreCandidateLogKeyRef.current === logKey) return;
    sessionRestoreCandidateLogKeyRef.current = logKey;

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_session_restore_candidate_loaded",
      data: {
        session_id: sessionId,
        source,
        has_snapshot: Boolean(snapshot),
        snapshot_updated_at: snapshot?.updatedAt ?? null,
      },
    });
  }, [
    sessionId,
    sessionRestoreCandidate.snapshot,
    sessionRestoreCandidate.source,
    sessionRestoreCandidate.status,
  ]);

  useEffect(() => {
    if (!applyEnabled) return;
    if (!sessionId || sessionRestoreCandidate.status !== "ready") return;
    if (sessionHydrationAppliedRef.current === sessionId) return;
    if (skipApplyForSessionId && skipApplyForSessionId === sessionId) {
      sessionHydrationAppliedRef.current = sessionId;
      return;
    }
    if (!sessionRestoreCandidate.snapshot) return;

    const snapshot = sessionRestoreCandidate.snapshot;
    const payload = hydrateFromSessionSnapshot(snapshot);
    if (agentApplyEnabled) {
      hydrateFromSessionAgentSnapshot(payload.agent);
    }
    hydrateFromSessionCanvasSnapshot?.(payload.canvas);
    sessionHydrationAppliedRef.current = sessionId;

    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_session_hydration_applied",
      data: {
        session_id: sessionId,
        source: sessionRestoreCandidate.source,
        snapshot_updated_at: snapshot.updatedAt,
        agent_hydration_applied: agentApplyEnabled,
        canvas_hydration_applied: Boolean(hydrateFromSessionCanvasSnapshot),
      },
    });
  }, [
    hydrateFromSessionCanvasSnapshot,
    agentApplyEnabled,
    applyEnabled,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    sessionId,
    skipApplyForSessionId,
    sessionRestoreCandidate.snapshot,
    sessionRestoreCandidate.source,
    sessionRestoreCandidate.status,
  ]);
};
