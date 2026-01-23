/**
 * Thin client for Kie.ai interactions.
 * Routes requests through Next API handlers to keep API keys server-side and normalize responses.
 */
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

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const handleJson = async <T>(response: Response) => {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error("Unexpected error");
    }
    return {} as T;
  }
  if (!response.ok) {
    const message = (data as any)?.message || (data as any)?.error || "Unexpected error";
    throw new Error(message);
  }
  return data as T;
};

/**
 * Create a new Kie.ai task via the Next API route.
 */
export const createKeiTask = async (payload: KeiCreateTaskRequest): Promise<KeiCreateTaskResponse> => {
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
  const status = data?.data || data;
  const infoUrls = (status as any)?.info?.result_urls;
  return {
    state: (status as any)?.state ?? (data as any)?.state ?? "pending",
    resultJson: (status as any)?.resultJson ?? null,
    failCode: (status as any)?.failCode ?? null,
    failMsg: (status as any)?.failMsg ?? null,
    resultUrls: (status as any)?.resultUrls || (Array.isArray(infoUrls) ? infoUrls : undefined),
    raw: status,
  };
};

/**
 * Create a new GPT-4o image generation task.
 */
export const createKeiGpt4oTask = async (payload: KeiGpt4oCreateRequest): Promise<KeiCreateTaskResponse> => {
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
