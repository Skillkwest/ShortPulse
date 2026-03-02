/**
 * AI Studio session restore hydration orchestrator.
 * Logs restore-candidate readiness and applies gated one-shot hydration per session id.
 */
import { useEffect, useRef } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { AiStudioSessionSnapshotV1 } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { AiStudioSessionRestoreCandidateState } from "./useAiStudioSessionRestoreCandidate";

const RESTORE_APPLY_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED === "true";
const RESTORE_APPLY_AGENT_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED !== "false";

type UseAiStudioSessionRestoreHydrationParams = {
  sessionId: string | null;
  sessionRestoreCandidate: AiStudioSessionRestoreCandidateState;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshotV1
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  applyEnabled?: boolean;
  agentApplyEnabled?: boolean;
};

/**
 * Handles telemetry-only candidate logging and optional one-shot hydration apply.
 */
export const useAiStudioSessionRestoreHydration = ({
  sessionId,
  sessionRestoreCandidate,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  applyEnabled = RESTORE_APPLY_ENABLED,
  agentApplyEnabled = RESTORE_APPLY_AGENT_ENABLED,
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
    if (!sessionRestoreCandidate.snapshot) return;

    const snapshot = sessionRestoreCandidate.snapshot;
    const payload = hydrateFromSessionSnapshot(snapshot);
    if (agentApplyEnabled) {
      hydrateFromSessionAgentSnapshot(payload.agent);
    }
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
      },
    });
  }, [
    agentApplyEnabled,
    applyEnabled,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    sessionId,
    sessionRestoreCandidate.snapshot,
    sessionRestoreCandidate.source,
    sessionRestoreCandidate.status,
  ]);
};
