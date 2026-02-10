/**
 * Thin client for Kie.ai interactions.
 * Routes requests through Next API handlers to keep API keys server-side and normalize responses.
 */
import { fetchWithAuth } from "./authenticatedFetch";

export type KeiCreateTaskRequest = {
  model: string;
  input: {
    prompt: string;
    image_input?: string[];
    aspect_ratio?: string;
    resolution?: string;
    output_format?: string;
    [key: string]: unknown;
  };
};

export type KeiCreateTaskResponse = { taskId: string };

export type KeiGpt4oCreateRequest = {
  prompt?: string;
  filesUrl?: string[];
  size: string;
  maskUrl?: string;
  callBackUrl?: string;
  isEnhance?: boolean;
  uploadCn?: boolean;
  enableFallback?: boolean;
  fallbackModel?: "GPT_IMAGE_1" | "FLUX_MAX";
};

export type KeiTaskState = "pending" | "running" | "success" | "fail";

export type KeiTaskStatus = {
  state: KeiTaskState | string;
  resultJson?: string | Record<string, unknown> | null;
  failCode?: string | null;
  failMsg?: string | null;
  resultUrls?: string[];
  raw?: unknown;
};

const KEI_API_BASE = "/api/kei";
const KEI_STATUS_PATH = `${KEI_API_BASE}/status`;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);
  try {
    return await fetchWithAuth(input, {
      ...init,
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readApiErrorMessage = (value: unknown): string => {
  const payload = toRecord(value);
  if (typeof payload.message === "string" && payload.message.length > 0) return payload.message;
  if (typeof payload.error === "string" && payload.error.length > 0) return payload.error;
  return "Unexpected error";
};

const readStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return items.length ? items : undefined;
};

const handleJson = async <T>(response: Response) => {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error("Unexpected error");
    }
    return {} as T;
  }
  if (!response.ok) {
    throw new Error(readApiErrorMessage(data));
  }
  return data as T;
};

/**
 * Create a new Kie.ai task via the Next API route.
 */
export const createKeiTask = async (
  payload: KeiCreateTaskRequest
): Promise<KeiCreateTaskResponse> => {
  const response = await fetchWithTimeout(`${KEI_API_BASE}/create-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ data?: { taskId?: string }; taskId?: string }>(response);
  const taskId = data?.data?.taskId || data?.taskId;
  if (!taskId) {
    throw new Error("Kie.ai did not return a taskId");
  }
  return { taskId };
};

/**
 * Fetch the current status/result for a Kie.ai task.
 */
export const fetchKeiTaskStatus = async (taskId: string): Promise<KeiTaskStatus> => {
  const response = await fetchWithTimeout(KEI_STATUS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const data = await handleJson<{
    data?: KeiTaskStatus & { resultUrls?: string[]; info?: { result_urls?: string[] } };
    state?: KeiTaskState | string;
  }>(response);
  const status = data?.data ?? data;
  const statusRecord = toRecord(status);
  const infoUrls = readStringArray(toRecord(statusRecord.info).result_urls);
  const resultUrls = readStringArray(statusRecord.resultUrls) ?? infoUrls;
  const stateCandidate = statusRecord.state ?? toRecord(data).state;
  const resultJson =
    typeof statusRecord.resultJson === "string"
      ? statusRecord.resultJson
      : statusRecord.resultJson && typeof statusRecord.resultJson === "object"
        ? (statusRecord.resultJson as Record<string, unknown>)
        : null;
  return {
    state: typeof stateCandidate === "string" ? stateCandidate : "pending",
    resultJson,
    failCode: typeof statusRecord.failCode === "string" ? statusRecord.failCode : null,
    failMsg: typeof statusRecord.failMsg === "string" ? statusRecord.failMsg : null,
    resultUrls,
    raw: status,
  };
};

/**
 * Create a new GPT-4o image generation task.
 */
export const createKeiGpt4oTask = async (
  payload: KeiGpt4oCreateRequest
): Promise<KeiCreateTaskResponse> => {
  const response = await fetchWithTimeout(`${KEI_API_BASE}/gpt4o-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ data?: { taskId?: string }; taskId?: string }>(response);
  const taskId = data?.data?.taskId || data?.taskId;
  if (!taskId) {
    throw new Error("Kie.ai 4o image did not return a taskId");
  }
  return { taskId };
};
