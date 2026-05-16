/**
 * Project workspace API client helpers.
 * Encapsulates authenticated reads/writes to `/api/projects/:projectId/workspace`.
 */
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
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

const INVALID_PROJECT_WORKSPACE_SNAPSHOT_PATTERN = /invalid project workspace snapshot/i;

const resolveProjectWorkspaceApiErrorMessage = (
  response: Response,
  payload: AiStudioProjectWorkspaceApiPayload | null
): string => {
  const payloadMessage =
    response.status >= 500
      ? payload?.details?.trim() || payload?.error?.trim()
      : payload?.error?.trim() || payload?.details?.trim();
  if (payloadMessage) return payloadMessage;

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  return `HTTP ${response.status}${contentType ? ` ${contentType}` : ""}`;
};

const maybeLogInvalidProjectWorkspaceSnapshotResponse = ({
  projectId,
  status,
  payload,
}: {
  projectId: string;
  status: number;
  payload: AiStudioProjectWorkspaceApiPayload | null;
}) => {
  const message = payload?.error?.trim() || payload?.details?.trim() || "";
  if (status !== 400 || !INVALID_PROJECT_WORKSPACE_SNAPSHOT_PATTERN.test(message)) {
    return;
  }

  addBreadcrumb({
    type: "network",
    level: "warn",
    message: "ai_studio_project_workspace_save_invalid_snapshot",
    data: {
      project_id: projectId,
      status,
      error: message,
    },
  });
};

export const getAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<AiStudioProjectWorkspaceApiRecord | null> => {
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "GET",
    shortpulseLogScope: "app",
    shortpulseAuthTimeoutMs: 5000,
    shortpulseRetryNetworkOnce: true,
  });

  let payload: AiStudioProjectWorkspaceApiPayload | null = null;
  try {
    payload = (await response.json()) as AiStudioProjectWorkspaceApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = resolveProjectWorkspaceApiErrorMessage(response, payload);
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
    shortpulseRetryNetworkOnce: true,
  });

  let payload: AiStudioProjectWorkspaceApiPayload | null = null;
  try {
    payload = (await response.json()) as AiStudioProjectWorkspaceApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.workspace) {
    maybeLogInvalidProjectWorkspaceSnapshotResponse({
      projectId,
      status: response.status,
      payload,
    });
    const message = resolveProjectWorkspaceApiErrorMessage(response, payload);
    throw new Error(`Failed to save project workspace snapshot: ${message}`);
  }

  return payload.workspace;
};

export const resetAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<void> => {
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "DELETE",
    shortpulseLogScope: "app",
    shortpulseRetryNetworkOnce: true,
  });

  let payload: AiStudioProjectWorkspaceApiPayload | null = null;
  try {
    payload = (await response.json()) as AiStudioProjectWorkspaceApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = resolveProjectWorkspaceApiErrorMessage(response, payload);
    throw new Error(`Failed to reset project workspace snapshot: ${message}`);
  }
};
