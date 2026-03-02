/**
 * AI Studio session API client helpers.
 * Encapsulates authenticated save calls to `/api/ai/sessions/save`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AiStudioSessionSnapshotV1 } from "./sessionSnapshot";

export type AiStudioSessionSaveApiResponse = {
  userId: string;
  sessionId: string;
  title: string | null;
  schemaVersion: number;
  saveSeq: number;
  updatedAt: string;
  expiresAt: string;
};

/**
 * Saves one session snapshot through the authenticated AI session save route.
 */
export const saveAiStudioSessionSnapshotViaApi = async ({
  sessionId,
  snapshot,
  keepalive,
}: {
  sessionId: string;
  snapshot: AiStudioSessionSnapshotV1;
  keepalive?: boolean;
}): Promise<AiStudioSessionSaveApiResponse> => {
  const response = await fetchWithAuth("/api/ai/sessions/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sid: sessionId,
      schemaVersion: snapshot.schemaVersion,
      snapshot,
    }),
    keepalive: keepalive === true,
    shortpulseLogScope: "app",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error ?? "Request failed")
        : "Request failed";
    throw new Error(`Failed to save AI Studio session snapshot: ${message}`);
  }

  return payload as AiStudioSessionSaveApiResponse;
};
