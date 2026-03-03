/**
 * AI Studio session API client helpers.
 * Encapsulates authenticated save calls to `/api/ai/sessions/save`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AiStudioSessionSnapshotV1 } from "./sessionSnapshot";
import { resolveAiStudioSessionSnapshotTitle } from "./sessionSnapshotTitle";

export type AiStudioSessionSaveApiResponse = {
  userId: string;
  sessionId: string;
  title: string | null;
  schemaVersion: number;
  saveSeq: number;
  updatedAt: string;
  expiresAt: string;
};

export type AiStudioSessionGetApiResponse = AiStudioSessionSaveApiResponse & {
  snapshot: unknown;
};

export type AiStudioSessionListApiItem = {
  sessionId: string;
  title: string | null;
  schemaVersion: number;
  saveSeq: number;
  updatedAt: string;
  expiresAt: string;
};

export type AiStudioSessionListApiResponse = {
  sessions: AiStudioSessionListApiItem[];
  nextCursor: string | null;
};

/**
 * Saves one session snapshot through the authenticated AI session save route.
 */
export const saveAiStudioSessionSnapshotViaApi = async ({
  sessionId,
  snapshot,
  keepalive,
  title,
}: {
  sessionId: string;
  snapshot: AiStudioSessionSnapshotV1;
  keepalive?: boolean;
  title?: string | null;
}): Promise<AiStudioSessionSaveApiResponse> => {
  const resolvedTitle =
    typeof title !== "undefined" ? title : resolveAiStudioSessionSnapshotTitle(snapshot);
  const response = await fetchWithAuth("/api/ai/sessions/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sid: sessionId,
      schemaVersion: snapshot.schemaVersion,
      snapshot,
      title: resolvedTitle ?? null,
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

/**
 * Loads one persisted session snapshot through the authenticated AI session get route.
 * Returns `null` when the session is not found for the current user.
 */
export const getAiStudioSessionSnapshotViaApi = async ({
  sessionId,
}: {
  sessionId: string;
}): Promise<AiStudioSessionGetApiResponse | null> => {
  const response = await fetchWithAuth(`/api/ai/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    shortpulseLogScope: "app",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error ?? "Request failed")
        : "Request failed";
    throw new Error(`Failed to load AI Studio session snapshot: ${message}`);
  }

  return payload as AiStudioSessionGetApiResponse;
};

/**
 * Lists persisted sessions through the authenticated AI session list route.
 */
export const listAiStudioSessionsViaApi = async ({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<AiStudioSessionListApiResponse> => {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit)) {
    params.set("limit", String(Math.trunc(limit)));
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  const query = params.toString();
  const path = query ? `/api/ai/sessions?${query}` : "/api/ai/sessions";
  const response = await fetchWithAuth(path, {
    method: "GET",
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
    throw new Error(`Failed to list AI Studio sessions: ${message}`);
  }

  return payload as AiStudioSessionListApiResponse;
};
