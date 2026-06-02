/**
 * Registry-driven client for Fal.ai submit/status interactions.
 * Proxies through Next API routes to keep provider keys server-side.
 */
import { fetchWithAuth, type ShortPulseFetchInit } from "./authenticatedFetch";
import { normalizeExplicitContentFailure } from "./explicitContentFailure";
import { readGenerationAdmissionErrorMessage } from "./generationAdmissionErrors";
import { getModelConfig } from "./model-runtime/modelRegistry";

export type FalSubmitRequest = {
  prompt: string;
  image_url?: string;
  mask_url?: string;
  reference_image_url?: string;
  image_size?: string | { width: number; height: number };
  image_urls?: string[];
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  enable_safety_checker?: boolean;
  safety_tolerance?: string | number;
  output_format?: "jpeg" | "png";
  acceleration?: "none" | "regular" | "high";
  generation_replay?: Record<string, unknown>;
  character_context?: Record<string, unknown>;
  style_context?: Record<string, unknown>;
  shortpulse_context?: Record<string, unknown>;
};

export type KieSubmitRequest = {
  prompt: string;
  image_url?: string;
  image_urls?: string[];
  input_url?: string;
  input_urls?: string[];
  video_url?: string;
  video_urls?: string[];
  aspect_ratio?: string;
  generation_type?: string;
  duration?: string | number;
  duration_seconds?: number;
  resolution?: string;
  callback_url?: string;
  seed?: number;
  generate_audio?: boolean;
  cfg_scale?: number;
  negative_prompt?: string;
  generation_replay?: Record<string, unknown>;
  character_context?: Record<string, unknown>;
  style_context?: Record<string, unknown>;
  shortpulse_context?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FalImmediateSubmitResponse = {
  request_id: string;
  generationId?: string;
};

export type FalSubmitResponse = FalImmediateSubmitResponse;

export type FalStatusResponse = {
  status?: string;
  generationId?: string;
  error?: string;
  shortpulseLifecycle?: {
    taskState?: "pending" | "running" | "success" | "fail";
    isTerminal?: boolean;
    resultUrls?: string[];
    errorMessage?: string | null;
    errorDetail?: unknown;
    providerState?: string | null;
    recoveryPending?: boolean;
    queueState?: "queued" | "dispatching" | "dispatched" | "failed" | null;
    statusLabel?: string | null;
  };
  data?: {
    images?: { url: string; content_type?: string; width?: number; height?: number }[];
    videos?: { url: string; content_type?: string }[];
    video?: { url?: string; content_type?: string };
    video_url?: string;
    videoUrl?: string;
    prompt?: string;
  };
  videos?: { url: string; content_type?: string }[];
  video?: { url?: string; content_type?: string };
  video_url?: string;
  videoUrl?: string;
};

export type FalSeedreamSubmitRequest = {
  prompt: string;
  image_size?: string | { width: number; height: number };
  num_images?: number;
  max_images?: number;
  seed?: number;
  sync_mode?: boolean;
  enable_safety_checker?: boolean;
  output_format?: "png" | "jpeg" | "webp";
};

export type FalSeedreamEditSubmitRequest = {
  prompt: string;
  image_urls: string[];
  image_size?: string | { width: number; height: number };
  num_images?: number;
  max_images?: number;
  seed?: number;
  sync_mode?: boolean;
  enable_safety_checker?: boolean;
};

export type FalNanoBananaEditSubmitRequest = {
  prompt: string;
  num_images?: number;
  aspect_ratio?: string;
  output_format?: "jpeg" | "png" | "webp";
  sync_mode?: boolean;
  image_urls: string[];
  limit_generations?: boolean;
};

export type FalNanoBananaSubmitRequest = {
  prompt: string;
  num_images?: number;
  aspect_ratio?: string;
  output_format?: "jpeg" | "png" | "webp";
  sync_mode?: boolean;
  limit_generations?: boolean;
};

export type FalNanoBananaProSubmitRequest = {
  prompt: string;
  num_images?: number;
  aspect_ratio?: string;
  output_format?: "jpeg" | "png" | "webp";
  resolution?: "1K" | "2K" | "4K";
  seed?: number;
  sync_mode?: boolean;
  limit_generations?: boolean;
  enable_web_search?: boolean;
  image_urls?: string[];
};

export type FalNanoBanana2SubmitRequest = {
  prompt: string;
  num_images?: number;
  aspect_ratio?: string;
  output_format?: "jpeg" | "png" | "webp";
  resolution?: "0.5K" | "1K" | "2K" | "4K";
  seed?: number;
  sync_mode?: boolean;
  limit_generations?: boolean;
  enable_web_search?: boolean;
  image_urls?: string[];
};

export type FalBriaBackgroundRemoveSubmitRequest = {
  image_url: string;
  sync_mode?: boolean;
};

const FAL_API_BASE = "/api/fal";
const SUBMIT_AUTH_TIMEOUT_MS = 4_000;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: ShortPulseFetchInit & { timeoutMs?: number }
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 60000);
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

const readApiErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Unexpected error";
  const data = payload as Record<string, unknown>;
  const explicitContentFailure = normalizeExplicitContentFailure({
    message:
      extractErrorTextCandidate(data.detail) ??
      extractErrorTextCandidate(data.error) ??
      extractErrorTextCandidate(data.message) ??
      extractErrorTextCandidate(data.msg),
    detail:
      extractErrorTextCandidate(data.detail) ??
      extractErrorTextCandidate(data.error) ??
      extractErrorTextCandidate(data.message) ??
      extractErrorTextCandidate(data.msg),
  });
  if (explicitContentFailure) {
    return explicitContentFailure.errorDetail;
  }
  if (typeof data.message === "string" && data.message.length > 0) return data.message;
  if (typeof data.error === "string" && data.error.length > 0) return data.error;
  if (typeof data.msg === "string" && data.msg.length > 0) return data.msg;
  const nestedData = data.data;
  if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
    const nested = nestedData as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim().length > 0) {
      return nested.message.trim();
    }
    if (typeof nested.error === "string" && nested.error.trim().length > 0) {
      return nested.error.trim();
    }
    if (typeof nested.msg === "string" && nested.msg.trim().length > 0) {
      return nested.msg.trim();
    }
    if (typeof nested.failMsg === "string" && nested.failMsg.trim().length > 0) {
      return nested.failMsg.trim();
    }
    if (typeof nested.failCode === "string" && nested.failCode.trim().length > 0) {
      return nested.failCode.trim();
    }
  }
  if (typeof data.detail === "string" && data.detail.length > 0) return data.detail;
  if (Array.isArray(data.detail)) {
    const first = data.detail[0];
    if (typeof first === "string" && first.trim().length > 0) return first.trim();
    if (first && typeof first === "object") {
      const firstRecord = first as Record<string, unknown>;
      if (typeof firstRecord.msg === "string" && firstRecord.msg.trim().length > 0) {
        return firstRecord.msg.trim();
      }
    }
  }
  if (typeof data.raw === "string" && data.raw.trim().length > 0) return data.raw.trim();
  return "Unexpected error";
};

const readRequestId = (payload: { request_id?: string; requestId?: string }): string | undefined =>
  payload.request_id || payload.requestId;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const extractErrorTextCandidate = (value: unknown, depth = 0): string | null => {
  if (depth > 3 || value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractErrorTextCandidate(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return (
    extractErrorTextCandidate(record.msg, depth + 1) ??
    extractErrorTextCandidate(record.message, depth + 1) ??
    extractErrorTextCandidate(record.error, depth + 1) ??
    extractErrorTextCandidate(record.detail, depth + 1)
  );
};

const handleJson = async <T>(response: Response) => {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        const status = response.status || 500;
        const statusText = response.statusText?.trim();
        throw new Error(statusText ? `${status} ${statusText}` : `Request failed (${status})`);
      }
    }
  }
  if (!response.ok) {
    const admissionErrorMessage = readGenerationAdmissionErrorMessage(response, data);
    if (admissionErrorMessage) {
      throw new Error(admissionErrorMessage);
    }
    const message = readApiErrorMessage(data);
    if (message && message !== "Unexpected error") {
      throw new Error(message);
    }
    const status = response.status || 500;
    const statusText = response.statusText?.trim();
    throw new Error(statusText ? `${status} ${statusText}` : `Request failed (${status})`);
  }
  return data as T;
};

const STATUS_TIMEOUT_STANDARD_MS = 75_000;

const isTimeoutLikeError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof error === "object") {
    const maybeError = error as { name?: unknown; message?: unknown };
    if (maybeError.name === "AbortError") return true;
    if (typeof maybeError.message === "string") {
      return /abort|timed out|timeout/i.test(maybeError.message);
    }
  }
  if (typeof error === "string") {
    return /abort|timed out|timeout/i.test(error);
  }
  return false;
};

const createStatusTimeoutError = (endpointLabel: string, timeoutMs: number): Error =>
  new Error(`[fal-status:${endpointLabel}] timed out after ${timeoutMs}ms`);

const resolveQueuedModelEndpoint = (
  modelId: string,
  routeKind: "submit" | "status"
): { route: string; missingRequestIdMessage: string } => {
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig?.apiRouteSlug) {
    throw new Error(`Queued generation route is not configured for ${modelId}`);
  }
  const providerLabel =
    modelConfig.provider === "kie" ? "Kie" : modelConfig.provider === "fal" ? "Fal" : "";
  const modelLabel = modelConfig.label.replace(/\s+\(Kie\)$/i, "");
  const displayLabel = providerLabel ? `${providerLabel} ${modelLabel}` : modelLabel;
  return {
    route: `${FAL_API_BASE}/${modelConfig.apiRouteSlug}-${routeKind}`,
    missingRequestIdMessage: `${displayLabel} did not return a request_id`,
  };
};

export const submitQueuedGenerationByModelId = async <TPayload>(
  modelId: string,
  payload: TPayload
): Promise<FalSubmitResponse> => {
  const config = resolveQueuedModelEndpoint(modelId, "submit");
  const response = await fetchWithTimeout(config.route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    shortpulseAuthTimeoutMs: SUBMIT_AUTH_TIMEOUT_MS,
    shortpulseRetryAuth401: false,
  });
  const data = await handleJson<Record<string, unknown>>(response);
  const requestId = readRequestId(data as { request_id?: string; requestId?: string });
  if (!requestId) {
    throw new Error(config.missingRequestIdMessage);
  }
  const generationId = asNonEmptyString((data as { generationId?: unknown }).generationId);
  return generationId ? { request_id: requestId, generationId } : { request_id: requestId };
};

const fetchQueuedGenerationStatus = async <TStatus>(
  modelId: string,
  endpointLabel: string,
  requestId: string
): Promise<TStatus> => {
  const { route } = resolveQueuedModelEndpoint(modelId, "status");
  const statusTimeoutMs = STATUS_TIMEOUT_STANDARD_MS;
  let response: Response;
  try {
    response = await fetchWithTimeout(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
      timeoutMs: statusTimeoutMs,
    });
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw createStatusTimeoutError(endpointLabel, statusTimeoutMs);
    }
    throw error;
  }
  return handleJson<TStatus>(response);
};

export const fetchQueuedGenerationStatusByModelId = (modelId: string, requestId: string) =>
  fetchQueuedGenerationStatus<FalStatusResponse>(modelId, modelId, requestId);
