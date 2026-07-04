/**
 * Pure parsing and normalization helpers for project workspace state persistence.
 */
import { createAiStudioProjectWorkspaceSnapshot } from "../ai-studio-session/projectWorkspaceSnapshot";
import { PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES } from "../ai-studio-session/projectWorkspaceLimits";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ProjectWorkspaceSnapshotInput = Parameters<typeof createAiStudioProjectWorkspaceSnapshot>[0];

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const measureProjectWorkspaceSnapshotBytes = (value: unknown): number | null => {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
};

export const parseProjectWorkspaceSnapshotPayload = (
  value: unknown
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshotBytes = measureProjectWorkspaceSnapshotBytes(value);
  if (snapshotBytes == null) return null;
  if (snapshotBytes <= PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES) {
    return value as Record<string, unknown>;
  }

  const normalizedProjectSnapshot = createAiStudioProjectWorkspaceSnapshot(
    value as ProjectWorkspaceSnapshotInput
  );
  const normalizedBytes = measureProjectWorkspaceSnapshotBytes(normalizedProjectSnapshot);
  if (normalizedBytes == null || normalizedBytes > PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES) {
    return null;
  }
  return normalizedProjectSnapshot;
};

export const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeIsoTimestamp = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

export const normalizeUuid = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

export const normalizeUuidList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => normalizeUuid(entry))
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    : [];

export const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => normalizeOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const safeStringifyError = (error: unknown): string | null => {
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : null;
  } catch {
    return null;
  }
};

export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const record = asRecord(error);
  const parts = [
    normalizeOptionalString(record.message),
    normalizeOptionalString(record.details),
    normalizeOptionalString(record.hint),
    normalizeOptionalString(record.code),
  ].filter((entry): entry is string => Boolean(entry));
  if (parts.length > 0) return parts.join(" ");
  return safeStringifyError(error) ?? fallback;
};

export const compareIsoTimestamps = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
  if (leftTime === rightTime) return 0;
  return leftTime > rightTime ? 1 : -1;
};
