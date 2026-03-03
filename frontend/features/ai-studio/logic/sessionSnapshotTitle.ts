/**
 * AI Studio session title resolver.
 * Derives a compact human label from persisted snapshot content for session-list UX.
 */
import type { AiStudioSessionSnapshotV1 } from "./sessionSnapshot";

const MAX_TITLE_LENGTH = 120;

const normalizeTitleCandidate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, MAX_TITLE_LENGTH);
};

/**
 * Resolves a user-friendly session title from snapshot state.
 */
export const resolveAiStudioSessionSnapshotTitle = (
  snapshot: AiStudioSessionSnapshotV1
): string | null => {
  const workspace = snapshot.workspace;
  const outputs = snapshot.outputs;
  const agent = snapshot.agent;

  const candidates = [
    normalizeTitleCandidate(workspace.prompt),
    normalizeTitleCandidate(workspace.editReferenceText),
    normalizeTitleCandidate(workspace.videoReferenceText),
    normalizeTitleCandidate(agent.latestAgentPrompt),
    normalizeTitleCandidate(outputs.active?.[0]?.prompt),
  ];

  return (
    candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0) ?? null
  );
};
