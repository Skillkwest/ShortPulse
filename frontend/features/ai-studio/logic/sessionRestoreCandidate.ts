/**
 * AI Studio session restore-candidate resolver.
 * Chooses the freshest valid snapshot across local shadow storage and optional remote session API.
 */
import { parseAiStudioSessionSnapshotShape } from "../../../lib/ai-studio-session/sessionSnapshotShape";
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";
import { getAiStudioSessionSnapshotViaApi } from "./sessionApiClient";
import { loadAiStudioSessionShadow } from "./sessionSnapshotStorage";

export type AiStudioSessionRestoreSource = "none" | "local" | "remote" | "project";

export type AiStudioSessionRestoreCandidate = {
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioSessionRestoreSource;
};

const asTimestamp = (value: unknown): number => {
  if (typeof value !== "string") return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

/**
 * Validates minimal session-snapshot shape and ownership for restore.
 * Supports schema versions 1 and 2 for backward-compatible hydration.
 */
export const parseAiStudioSessionSnapshotForRestore = (
  value: unknown,
  expectedSessionId: string | null
): AiStudioSessionSnapshot | null => {
  const record = parseAiStudioSessionSnapshotShape(value, { expectedSessionId });
  return record as AiStudioSessionSnapshot | null;
};

/**
 * Backward-compatible parser alias kept for existing tests/callers.
 */
export const parseAiStudioSessionSnapshotV1 = parseAiStudioSessionSnapshotForRestore;

/**
 * Picks the freshest snapshot; ties prefer remote.
 */
export const selectAiStudioSessionRestoreSnapshot = ({
  localSnapshot,
  remoteSnapshot,
}: {
  localSnapshot: AiStudioSessionSnapshot | null;
  remoteSnapshot: AiStudioSessionSnapshot | null;
}): AiStudioSessionRestoreCandidate => {
  if (!localSnapshot && !remoteSnapshot) {
    return {
      snapshot: null,
      source: "none",
    };
  }

  if (!localSnapshot) {
    return {
      snapshot: remoteSnapshot,
      source: remoteSnapshot ? "remote" : "none",
    };
  }

  if (!remoteSnapshot) {
    return {
      snapshot: localSnapshot,
      source: "local",
    };
  }

  const localUpdatedAt = asTimestamp(localSnapshot.updatedAt);
  const remoteUpdatedAt = asTimestamp(remoteSnapshot.updatedAt);
  if (remoteUpdatedAt >= localUpdatedAt) {
    return {
      snapshot: remoteSnapshot,
      source: "remote",
    };
  }

  return {
    snapshot: localSnapshot,
    source: "local",
  };
};

/**
 * Loads local shadow snapshot and optionally remote snapshot, then returns the freshest candidate.
 */
export const loadAiStudioSessionRestoreCandidate = async ({
  sessionId,
  remoteEnabled,
}: {
  sessionId: string;
  remoteEnabled?: boolean;
}): Promise<AiStudioSessionRestoreCandidate> => {
  let localSnapshot: AiStudioSessionSnapshot | null = null;
  let remoteSnapshot: AiStudioSessionSnapshot | null = null;

  try {
    const local = await loadAiStudioSessionShadow(sessionId);
    localSnapshot = parseAiStudioSessionSnapshotForRestore(local, sessionId);
  } catch {
    localSnapshot = null;
  }

  if (remoteEnabled) {
    try {
      const remote = await getAiStudioSessionSnapshotViaApi({ sessionId });
      remoteSnapshot = parseAiStudioSessionSnapshotForRestore(remote?.snapshot ?? null, sessionId);
    } catch {
      remoteSnapshot = null;
    }
  }

  return selectAiStudioSessionRestoreSnapshot({
    localSnapshot,
    remoteSnapshot,
  });
};
