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
  repairStage?:
    | "owned_id_resolution"
    | "project_output_display_sync"
    | "project_association_backfill";
  repairMessage?: string | null;
};

export type AiStudioProjectWorkspaceApiRecord = {
  projectId: string;
  schemaVersion: number;
  snapshot?: unknown;
  createdAt: string;
  updatedAt: string;
  saveOutcome?: AiStudioProjectWorkspaceSaveOutcome;
};

export type AiStudioProjectWorkspaceApiProjectRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AiStudioProjectWorkspaceApiPayload = {
  project?: AiStudioProjectWorkspaceApiProjectRecord | null;
  workspace: AiStudioProjectWorkspaceApiRecord | null;
  saveOutcome?: AiStudioProjectWorkspaceSaveOutcome;
  error?: unknown;
  details?: unknown;
  failureStage?: unknown;
};

type ProjectWorkspaceApiResponseDetails = {
  payload: AiStudioProjectWorkspaceApiPayload | null;
  contentType: string | null;
  parseMode: "json_object" | "json_scalar" | "text" | "empty";
  scalarMessage: string;
  rawErrorExcerpt: string;
};

class ProjectWorkspaceBootstrapApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProjectWorkspaceBootstrapApiError";
    this.status = status;
  }
}

const INVALID_PROJECT_WORKSPACE_SNAPSHOT_PATTERN = /invalid project workspace snapshot/i;

const resolveProjectWorkspacePayloadMessage = ({
  payload,
  preferDetails,
}: {
  payload: Pick<AiStudioProjectWorkspaceApiPayload, "error" | "details"> | null;
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
  responseDetails: ProjectWorkspaceApiResponseDetails
): string => {
  const { payload, contentType, scalarMessage } = responseDetails;
  const payloadMessage = resolveProjectWorkspacePayloadMessage({
    payload,
    preferDetails: response.status >= 500,
  });
  if (payloadMessage) return payloadMessage;
  if (scalarMessage) return scalarMessage;

  return `HTTP ${response.status}${contentType ? ` ${contentType}` : ""}`;
};

const readProjectWorkspaceApiResponseDetails = async (
  response: Response
): Promise<ProjectWorkspaceApiResponseDetails> => {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
  const rawText = await response.text().catch(() => "");
  const normalizedRawText = rawText.trim();

  if (!normalizedRawText) {
    return {
      payload: null,
      contentType,
      parseMode: "empty",
      scalarMessage: "",
      rawErrorExcerpt: "",
    };
  }

  const shouldAttemptJsonParse =
    contentType === "application/json" ||
    contentType === "application/ld+json" ||
    normalizedRawText.startsWith("{") ||
    normalizedRawText.startsWith("[") ||
    normalizedRawText.startsWith('"');

  if (shouldAttemptJsonParse) {
    try {
      const parsed = JSON.parse(normalizedRawText) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          payload: parsed as AiStudioProjectWorkspaceApiPayload,
          contentType,
          parseMode: "json_object",
          scalarMessage: "",
          rawErrorExcerpt: "",
        };
      }
      const scalarMessage = normalizeErrorText(parsed, { fallback: "" });
      return {
        payload: null,
        contentType,
        parseMode: "json_scalar",
        scalarMessage,
        rawErrorExcerpt: scalarMessage,
      };
    } catch {
      // Fall through to plain-text handling below.
    }
  }

  return {
    payload: null,
    contentType,
    parseMode: "text",
    scalarMessage: "",
    rawErrorExcerpt: normalizeErrorText(normalizedRawText, { fallback: "" }),
  };
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
  responseDetails,
}: {
  projectId: string;
  status: number;
  responseDetails: ProjectWorkspaceApiResponseDetails;
}) => {
  const payload = responseDetails.payload;
  addBreadcrumb({
    type: "network",
    level: status >= 500 ? "error" : "warn",
    message: "ai_studio_project_workspace_save_failed",
    data: {
      project_id: projectId,
      status,
      failure_stage: resolveProjectWorkspaceFailureStage(payload),
      error:
        resolveProjectWorkspacePayloadMessage({
          payload,
          preferDetails: status >= 500,
        }) || responseDetails.scalarMessage,
      content_type: responseDetails.contentType,
      payload_parse_mode: responseDetails.parseMode,
      raw_error_excerpt: responseDetails.rawErrorExcerpt || null,
    },
  });
};

const maybeLogMalformedProjectWorkspaceSaveSuccess = ({
  projectId,
  responseDetails,
}: {
  projectId: string;
  responseDetails: ProjectWorkspaceApiResponseDetails;
}) => {
  const payload = responseDetails.payload;
  addBreadcrumb({
    type: "network",
    level: "error",
    message: "ai_studio_project_workspace_save_malformed_success",
    data: {
      project_id: projectId,
      status: 200,
      content_type: responseDetails.contentType,
      payload_parse_mode: responseDetails.parseMode,
      payload_keys: payload ? Object.keys(payload).sort() : [],
      has_workspace_key: payload
        ? Object.prototype.hasOwnProperty.call(payload, "workspace")
        : false,
      workspace_type: payload?.workspace === null ? "null" : typeof payload?.workspace,
    },
  });
};

const toProjectWorkspaceBootstrapProjectRecord = (
  project: AiStudioProjectWorkspaceApiProjectRecord | null | undefined
): AiStudioProjectWorkspaceApiProjectRecord | null =>
  project &&
  typeof project.id === "string" &&
  typeof project.title === "string" &&
  typeof project.createdAt === "string" &&
  typeof project.updatedAt === "string"
    ? project
    : null;

type AiStudioProjectWorkspaceBootstrapApiResult = {
  project: AiStudioProjectWorkspaceApiProjectRecord | null;
  workspace: AiStudioProjectWorkspaceApiRecord | null;
};

const projectWorkspaceBootstrapInFlightRequests = new Map<
  string,
  Promise<AiStudioProjectWorkspaceBootstrapApiResult>
>();
const PROJECT_WORKSPACE_BOOTSTRAP_RECENT_RESULT_TTL_MS = 2_000;
const projectWorkspaceBootstrapRecentResults = new Map<
  string,
  {
    expiresAt: number;
    result: AiStudioProjectWorkspaceBootstrapApiResult;
  }
>();
const projectWorkspaceBootstrapCacheVersions = new Map<string, number>();

const readProjectWorkspaceBootstrapCacheVersion = (projectId: string): number =>
  projectWorkspaceBootstrapCacheVersions.get(projectId) ?? 0;

export const invalidateAiStudioProjectWorkspaceBootstrapCache = (projectId: string) => {
  projectWorkspaceBootstrapInFlightRequests.delete(projectId);
  projectWorkspaceBootstrapRecentResults.delete(projectId);
  projectWorkspaceBootstrapCacheVersions.set(
    projectId,
    readProjectWorkspaceBootstrapCacheVersion(projectId) + 1
  );
};

export const clearAiStudioProjectWorkspaceBootstrapCacheForTests = () => {
  projectWorkspaceBootstrapInFlightRequests.clear();
  projectWorkspaceBootstrapRecentResults.clear();
  projectWorkspaceBootstrapCacheVersions.clear();
};

export const getAiStudioProjectWorkspaceBootstrapViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<AiStudioProjectWorkspaceBootstrapApiResult> => {
  const cachedRequest = projectWorkspaceBootstrapInFlightRequests.get(projectId);
  if (cachedRequest) {
    return await cachedRequest;
  }
  const cachedResult = projectWorkspaceBootstrapRecentResults.get(projectId);
  if (cachedResult) {
    if (cachedResult.expiresAt > Date.now()) {
      return cachedResult.result;
    }
    projectWorkspaceBootstrapRecentResults.delete(projectId);
  }

  const cacheVersion = readProjectWorkspaceBootstrapCacheVersion(projectId);
  const request = (async (): Promise<AiStudioProjectWorkspaceBootstrapApiResult> => {
    const response = await fetchWithAuth(
      `/api/projects/${encodeURIComponent(projectId)}/workspace`,
      {
        method: "GET",
        shortpulseLogScope: "app",
        shortpulseAuthTimeoutMs: 5000,
        shortpulseRetryNetworkOnce: true,
      }
    );
    const responseDetails = await readProjectWorkspaceApiResponseDetails(response);
    const payload = responseDetails.payload;

    if (!response.ok) {
      const message = resolveProjectWorkspaceApiErrorMessage(response, responseDetails);
      throw new ProjectWorkspaceBootstrapApiError(response.status, message);
    }

    const result = {
      project: toProjectWorkspaceBootstrapProjectRecord(payload?.project),
      workspace: payload?.workspace
        ? {
            ...payload.workspace,
            ...(payload.saveOutcome ? { saveOutcome: payload.saveOutcome } : {}),
          }
        : null,
    };
    if (readProjectWorkspaceBootstrapCacheVersion(projectId) === cacheVersion) {
      projectWorkspaceBootstrapRecentResults.set(projectId, {
        expiresAt: Date.now() + PROJECT_WORKSPACE_BOOTSTRAP_RECENT_RESULT_TTL_MS,
        result,
      });
    }
    return result;
  })();

  projectWorkspaceBootstrapInFlightRequests.set(projectId, request);
  try {
    return await request;
  } finally {
    if (projectWorkspaceBootstrapInFlightRequests.get(projectId) === request) {
      projectWorkspaceBootstrapInFlightRequests.delete(projectId);
    }
  }
};

export const getAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<AiStudioProjectWorkspaceApiRecord | null> => {
  try {
    const result = await getAiStudioProjectWorkspaceBootstrapViaApi({ projectId });
    return result.workspace;
  } catch (error) {
    if (error instanceof ProjectWorkspaceBootstrapApiError) {
      throw new Error(`Failed to load project workspace snapshot: ${error.message}`);
    }
    throw error;
  }
};

export const getAiStudioProjectIdentityViaApi = async ({
  projectId,
}: {
  projectId: string;
}): Promise<AiStudioProjectWorkspaceApiProjectRecord | null> => {
  try {
    const result = await getAiStudioProjectWorkspaceBootstrapViaApi({ projectId });
    return result.project;
  } catch (error) {
    if (error instanceof ProjectWorkspaceBootstrapApiError) {
      if (error.status === 401) {
        throw new Error("Session expired. Retry project load.");
      }
      if (error.status === 400) {
        throw new Error("Invalid project link.");
      }
      if (error.status === 404) {
        throw new Error("Project not found.");
      }
      throw new Error(error.message || "Failed to load project.");
    }
    if (error instanceof Error && error.message.trim()) {
      throw error;
    }
    throw new Error("Failed to load project.");
  }
};

export const saveAiStudioProjectWorkspaceSnapshotViaApi = async ({
  projectId,
  snapshot,
  keepalive,
  serializedSnapshotJson,
}: {
  projectId: string;
  snapshot: AiStudioSessionSnapshot;
  keepalive?: boolean;
  serializedSnapshotJson?: string;
}): Promise<AiStudioProjectWorkspaceApiRecord> => {
  invalidateAiStudioProjectWorkspaceBootstrapCache(projectId);
  const requestBody =
    serializedSnapshotJson && serializedSnapshotJson.trim().length > 0
      ? `{"schemaVersion":${snapshot.schemaVersion},"snapshot":${serializedSnapshotJson}}`
      : JSON.stringify({
          schemaVersion: snapshot.schemaVersion,
          snapshot,
        });
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: requestBody,
    keepalive: keepalive === true,
    shortpulseLogScope: "app",
    shortpulseRetryNetworkOnce: true,
  });
  const responseDetails = await readProjectWorkspaceApiResponseDetails(response);
  const payload = responseDetails.payload;

  if (!response.ok || !payload?.workspace) {
    if (response.ok) {
      maybeLogMalformedProjectWorkspaceSaveSuccess({
        projectId,
        responseDetails,
      });
    }
    maybeLogProjectWorkspaceSaveFailure({
      projectId,
      status: response.status,
      responseDetails,
    });
    maybeLogInvalidProjectWorkspaceSnapshotResponse({
      projectId,
      status: response.status,
      payload,
    });
    const message = response.ok
      ? "Malformed project workspace save response: missing workspace"
      : resolveProjectWorkspaceApiErrorMessage(response, responseDetails);
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
  invalidateAiStudioProjectWorkspaceBootstrapCache(projectId);
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    method: "DELETE",
    shortpulseLogScope: "app",
    shortpulseRetryNetworkOnce: true,
  });
  const responseDetails = await readProjectWorkspaceApiResponseDetails(response);

  if (!response.ok) {
    const message = resolveProjectWorkspaceApiErrorMessage(response, responseDetails);
    throw new Error(`Failed to reset project workspace snapshot: ${message}`);
  }
};
