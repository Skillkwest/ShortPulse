/**
 * Pulse-owned runtime state helpers.
 * Keeps Pulse session namespace, pruning, and artifact-prompt projection localized to the Pulse lane.
 */
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";

/**
 * Builds the Create agent session namespace for a Pulse preset workflow.
 */
export const resolvePulseAgentSessionNamespace = ({
  sessionId,
  presetId,
  pulseSessionInstanceId,
}: {
  sessionId: string | null;
  presetId: string;
  pulseSessionInstanceId?: string | null;
}): string =>
  `ai-studio:${sessionId ?? "none"}::pulse:${presetId}:${pulseSessionInstanceId ?? "pending"}`;

/**
 * Returns a state map with stale Pulse runtime entries removed for the active session.
 */
export const pruneInactivePulseRuntimeStates = <TRuntimeState>({
  current,
  sessionId,
  hasStoredPulseSession,
  pulseRuntimeScopeKey,
}: {
  current: Record<string, TRuntimeState>;
  sessionId: string | null;
  hasStoredPulseSession: boolean;
  pulseRuntimeScopeKey: string;
}): Record<string, TRuntimeState> => {
  const pulseSessionKeyPrefix = `${sessionId ?? "none"}::pulse:`;
  let changed = false;
  const nextEntries = Object.entries(current).filter(([key]) => {
    const isPulseEntry = key.startsWith(pulseSessionKeyPrefix);
    if (!isPulseEntry) return true;
    const shouldKeep =
      hasStoredPulseSession && key === `${sessionId ?? "none"}::${pulseRuntimeScopeKey}`;
    if (!shouldKeep) {
      changed = true;
    }
    return shouldKeep;
  });
  return changed ? Object.fromEntries(nextEntries) : current;
};

/**
 * Resolves the prompt artifact exported by an active Pulse workflow, when one exists.
 */
export const resolvePulseWorkflowArtifactPrompt = ({
  hasVisiblePulseSession,
  pulseWorkflowSession,
}: {
  hasVisiblePulseSession: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
}): string | null => {
  if (
    hasVisiblePulseSession &&
    typeof pulseWorkflowSession?.lastArtifact === "string" &&
    pulseWorkflowSession.lastArtifact.trim().length > 0
  ) {
    return pulseWorkflowSession.lastArtifact.trim();
  }
  return null;
};
