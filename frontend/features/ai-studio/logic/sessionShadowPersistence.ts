/**
 * AI Studio write-shadow persistence transport.
 * Persists local shadow first, then optionally mirrors to the server shadow API.
 */
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";
import { saveAiStudioSessionShadow } from "./sessionSnapshotStorage";
import { saveAiStudioSessionSnapshotViaApi } from "./sessionApiClient";

/**
 * Persists one write-shadow snapshot locally and optionally mirrors it to server shadow API.
 * Local persistence remains authoritative; remote failures are fail-soft.
 */
export const persistAiStudioSessionShadow = async (
  sessionId: string,
  snapshot: AiStudioSessionSnapshot,
  options?: { keepalive?: boolean; title?: string | null; mirrorRemote?: boolean }
): Promise<void> => {
  await saveAiStudioSessionShadow(sessionId, snapshot);
  if (options?.mirrorRemote !== true) return;
  try {
    await saveAiStudioSessionSnapshotViaApi({
      sessionId,
      snapshot,
      keepalive: options?.keepalive === true,
      title: options?.title,
    });
  } catch {
    // Local IndexedDB shadow remains authoritative for this rollout.
  }
};
