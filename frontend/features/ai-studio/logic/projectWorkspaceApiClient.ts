/**
 * Project workspace API client helpers.
 * Encapsulates authenticated reads/writes to `/api/projects/:projectId/workspace`.
 */
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { normalizeErrorText } from "../../../lib/errorText";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

export type AiStudioProjectWorkspaceSaveOutcome = {
  status: "saved" | "saved_with_repair_pending";
  repairStage?: "project_association_backfill";
  repairMessage?: string | null;
};

export type AiStudioProjectWorkspaceApiRecord = {
  projectId: string;
  schemaVersion: number;
  snapshot: unknown;
  createdAt: string;
  updatedAt: string;
  saveOutcome?: AiStudioProjectWorkspaceSaveOutcome;
};

type AiStudioProjectWorkspaceApiPayload = {
  workspace: AiStudioProjectWorkspaceApiRecord | null;
  saveOutcome?: AiStudioProjectWorkspaceSaveOutcome;
  error?: unknown;
  details?: unknown;
  failureStage?: unknown;
};

const INVALID_PROJECT_WORKSPACE_SNAPSHOT_PATTERN = /invalid project workspace snapshot/i;

const resolveProjectWorkspacePayloadMessage = ({
  payload,
  preferDetails,
}: {
  payload: AiStudioProjectWorkspaceApiPayload | null;
  preferDetails?: boolean;
}): string => {
  const primary = preferDetails ? payload?.details : payload?.error;
  const secondary = preferDetails ? payload?.error : payload?.details;
  return (
    normalizeErrorText(primary, { fallback: "" }) || normalizeErrorText(secondary, { fallback: "" })
  );
};

const resolveProjectWorkspaceApiErrorMessage = (
  response: Response,
  payload: AiStudioProjectWorkspaceApiPayload | null
): string => {
  const payloadMessage = resolveProjectWorkspacePayloadMessage({
    payload,
    preferDetails: response.status >= 500,
  });
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
  const message = resolveProjectWorkspacePayloadMessage({ payload });
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

const maybeLogProjectWorkspaceSaveOutcome = ({
  projectId,
  saveOutcome,
}: {
  projectId: string;
  saveOutcome?: AiStudioProjectWorkspaceSaveOutcome;
}) => {
  if (saveOutcome?.status !== "saved_with_repair_pending") return;

  addBreadcrumb({
    type: "network",
    level: "warn",
    message: "ai_studio_project_workspace_save_repair_pending",
    data: {
      project_id: projectId,
      save_status: saveOutcome.status,
      repair_stage: saveOutcome.repairStage ?? null,
      repair_message: saveOutcome.repairMessage ?? null,
    },
  });
};

const resolveProjectWorkspaceFailureStage = (
  payload: AiStudioProjectWorkspaceApiPayload | null
): string | null => {
  const raw = payload?.failureStage;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

const maybeLogProjectWorkspaceSaveFailure = ({
  projectId,
  status,
  payload,
}: {
  projectId: string;
  status: number;
  payload: AiStudioProjectWorkspaceApiPayload | null;
}) => {
  addBreadcrumb({
    type: "network",
    level: status >= 500 ? "error" : "warn",
    message: "ai_studio_project_workspace_save_failed",
    data: {
      project_id: projectId,
      status,
      failure_stage: resolveProjectWorkspaceFailureStage(payload),
      error: resolveProjectWorkspacePayloadMessage({
        payload,
        preferDetails: status >= 500,
      }),
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

  return payload?.workspace
    ? {
        ...payload.workspace,
        ...(payload.saveOutcome ? { saveOutcome: payload.saveOutcome } : {}),
      }
    : null;
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
    maybeLogProjectWorkspaceSaveFailure({
      projectId,
      status: response.status,
      payload,
    });
    maybeLogInvalidProjectWorkspaceSnapshotResponse({
      projectId,
      status: response.status,
      payload,
    });
    const message = resolveProjectWorkspaceApiErrorMessage(response, payload);
    throw new Error(`Failed to save project workspace snapshot: ${message}`);
  }

  maybeLogProjectWorkspaceSaveOutcome({
    projectId,
    saveOutcome: payload.saveOutcome,
  });

  return {
    ...payload.workspace,
    ...(payload.saveOutcome ? { saveOutcome: payload.saveOutcome } : {}),
  };
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
