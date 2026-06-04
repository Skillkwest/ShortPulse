/**
 * Minimal AI Studio session snapshot shape validation shared by project restore/save paths.
 * Keeps server-side project workspace writes aligned with client-side restore expectations.
 */

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES = 900_000;

/**
 * Validates the top-level persisted session payload boundary used by restore/save paths.
 */
export const parseAiStudioSessionSnapshot = (value: unknown): Record<string, unknown> | null => {
  const record = asRecord(value);
  if (!record) return null;
  try {
    const snapshotBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (snapshotBytes > AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES) return null;
    return record;
  } catch {
    return null;
  }
};

/**
 * Validates the minimal durable session snapshot envelope required for restore.
 */
export const parseAiStudioSessionSnapshotShape = (
  value: unknown,
  options?: { expectedSessionId?: string | null }
): Record<string, unknown> | null => {
  const record = asRecord(value);
  if (!record) return null;

  const schemaVersion = record.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) return null;

  const expectedSessionId = options?.expectedSessionId ?? null;
  if (expectedSessionId && record.sessionId !== expectedSessionId) return null;

  if (typeof record.updatedAt !== "string") return null;
  if (!asRecord(record.workspace)) return null;
  if (!asRecord(record.outputs)) return null;
  if (!asRecord(record.agent)) return null;

  if (schemaVersion === 2) {
    const canvasValue = record.canvas;
    if (canvasValue != null && !asRecord(canvasValue)) return null;

    const metaValue = record.meta;
    if (metaValue != null && !asRecord(metaValue)) return null;
  }

  return record;
};
