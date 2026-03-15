/**
 * AI Studio write-shadow persistence transport.
 * Persists local shadow first, then mirrors to server when remote shadow is enabled.
 */
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";
import { saveAiStudioSessionShadow } from "./sessionSnapshotStorage";
import { saveAiStudioSessionSnapshotViaApi } from "./sessionApiClient";
import { readAiStudioSessionPersistencePolicy } from "./sessionPersistencePolicy";

/**
 * Persists one write-shadow snapshot locally and optionally mirrors it to server shadow API.
 * Local persistence remains authoritative for this phase; remote failures are fail-soft.
 */
export const persistAiStudioSessionShadow = async (
  sessionId: string,
  snapshot: AiStudioSessionSnapshot,
  options?: { keepalive?: boolean; title?: string | null }
): Promise<void> => {
  const { remoteShadowEnabled } = readAiStudioSessionPersistencePolicy();
  await saveAiStudioSessionShadow(sessionId, snapshot);
  if (!remoteShadowEnabled) return;
  await saveAiStudioSessionSnapshotViaApi({
    sessionId,
    snapshot,
    keepalive: options?.keepalive === true,
    title: options?.title,
  });
};
