/**
 * AI Studio session restore-candidate resolver.
 * Chooses the freshest valid snapshot across local shadow storage and optional remote session API.
 */
import type { AiStudioSessionSnapshotV1 } from "./sessionSnapshot";
import { getAiStudioSessionSnapshotViaApi } from "./sessionApiClient";
import { loadAiStudioSessionShadow } from "./sessionSnapshotStorage";

export type AiStudioSessionRestoreSource = "none" | "local" | "remote";

export type AiStudioSessionRestoreCandidate = {
  snapshot: AiStudioSessionSnapshotV1 | null;
  source: AiStudioSessionRestoreSource;
  localSnapshot: AiStudioSessionSnapshotV1 | null;
  remoteSnapshot: AiStudioSessionSnapshotV1 | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asTimestamp = (value: unknown): number => {
  if (typeof value !== "string") return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

/**
 * Validates minimal session-snapshot shape and ownership for restore.
 */
export const parseAiStudioSessionSnapshotV1 = (
  value: unknown,
  expectedSessionId: string
): AiStudioSessionSnapshotV1 | null => {
  const record = asRecord(value);
  if (!record) return null;
  if (record.schemaVersion !== 1) return null;
  if (record.sessionId !== expectedSessionId) return null;
  if (typeof record.updatedAt !== "string") return null;
  if (!asRecord(record.workspace)) return null;
  if (!asRecord(record.outputs)) return null;
  if (!asRecord(record.agent)) return null;
  return record as AiStudioSessionSnapshotV1;
};

/**
 * Picks the freshest snapshot; ties prefer remote.
 */
export const selectAiStudioSessionRestoreSnapshot = ({
  localSnapshot,
  remoteSnapshot,
}: {
  localSnapshot: AiStudioSessionSnapshotV1 | null;
  remoteSnapshot: AiStudioSessionSnapshotV1 | null;
}): AiStudioSessionRestoreCandidate => {
  if (!localSnapshot && !remoteSnapshot) {
    return {
      snapshot: null,
      source: "none",
      localSnapshot,
      remoteSnapshot,
    };
  }

  if (!localSnapshot) {
    return {
      snapshot: remoteSnapshot,
      source: remoteSnapshot ? "remote" : "none",
      localSnapshot,
      remoteSnapshot,
    };
  }

  if (!remoteSnapshot) {
    return {
      snapshot: localSnapshot,
      source: "local",
      localSnapshot,
      remoteSnapshot,
    };
  }

  const localUpdatedAt = asTimestamp(localSnapshot.updatedAt);
  const remoteUpdatedAt = asTimestamp(remoteSnapshot.updatedAt);
  if (remoteUpdatedAt >= localUpdatedAt) {
    return {
      snapshot: remoteSnapshot,
      source: "remote",
      localSnapshot,
      remoteSnapshot,
    };
  }

  return {
    snapshot: localSnapshot,
    source: "local",
    localSnapshot,
    remoteSnapshot,
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
  let localSnapshot: AiStudioSessionSnapshotV1 | null = null;
  let remoteSnapshot: AiStudioSessionSnapshotV1 | null = null;

  try {
    const local = await loadAiStudioSessionShadow(sessionId);
    localSnapshot = parseAiStudioSessionSnapshotV1(local, sessionId);
  } catch {
    localSnapshot = null;
  }

  if (remoteEnabled) {
    try {
      const remote = await getAiStudioSessionSnapshotViaApi({ sessionId });
      remoteSnapshot = parseAiStudioSessionSnapshotV1(remote?.snapshot ?? null, sessionId);
    } catch {
      remoteSnapshot = null;
    }
  }

  return selectAiStudioSessionRestoreSnapshot({
    localSnapshot,
    remoteSnapshot,
  });
};
