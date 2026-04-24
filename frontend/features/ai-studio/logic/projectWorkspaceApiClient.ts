/**
 * Project workspace API client helpers.
 * Encapsulates authenticated reads/writes to `/api/projects/:projectId/workspace`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

export type AiStudioProjectWorkspaceApiRecord = {
  projectId: string;
  schemaVersion: number;
  snapshot: unknown;
  createdAt: string;
  updatedAt: string;
};

type AiStudioProjectWorkspaceApiPayload = {
  workspace: AiStudioProjectWorkspaceApiRecord | null;
  error?: string;
  details?: string;
};

export const getAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<AiStudioProjectWorkspaceApiRecord | null> => {
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "GET",
    shortpulseLogScope: "app",
  });

  let payload: AiStudioProjectWorkspaceApiPayload | null = null;
  try {
    payload = (await response.json()) as AiStudioProjectWorkspaceApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.trim() || payload?.details?.trim() || "Request failed";
    throw new Error(`Failed to load project workspace snapshot: ${message}`);
  }

  return payload?.workspace ?? null;
};

export const saveAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
  snapshot,
  keepalive,
}: {
  projectId: string;
  snapshot: AiStudioSessionSnapshot;
  keepalive?: boolean;
}): Promise<AiStudioProjectWorkspaceApiRecord> => {
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      snapshot,
    }),
    keepalive: keepalive === true,
    shortpulseLogScope: "app",
  });

  let payload: AiStudioProjectWorkspaceApiPayload | null = null;
  try {
    payload = (await response.json()) as AiStudioProjectWorkspaceApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.workspace) {
    const message = payload?.error?.trim() || payload?.details?.trim() || "Request failed";
    throw new Error(`Failed to save project workspace snapshot: ${message}`);
  }

  return payload.workspace;
};
