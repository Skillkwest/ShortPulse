/**
 * Registry-driven client for Fal.ai submit/status interactions.
 * Proxies through Next API routes to keep provider keys server-side.
 */
import { fetchWithAuth } from "./authenticatedFetch";

export type FalSubmitRequest = {
  prompt: string;
  image_url?: string;
  mask_url?: string;
  image_size?: string | { width: number; height: number };
  image_urls?: string[];
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  enable_safety_checker?: boolean;
  safety_tolerance?: string | number;
  output_format?: "jpeg" | "png";
  acceleration?: "none" | "regular" | "high";
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
  [key: string]: unknown;
};

export type FalImmediateSubmitResponse = {
  request_id: string;
  generationId?: string;
};

export type FalQueuedSubmitResponse = {
  status: "queued";
  code: "GENERATION_QUEUED";
  sourceRef: string;
  generationId: string;
  pollAfterMs: number;
};

export type FalSubmitResponse = FalImmediateSubmitResponse | FalQueuedSubmitResponse;

export type FalQueueStatusResponse =
  | {
      status: "queued";
      generationId: string;
      sourceRef: string | null;
      retryAfterMs: number;
      shortpulseLifecycle?: {
        taskState: "pending";
        queueState: "queued";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "dispatching";
      generationId: string;
      sourceRef: string | null;
      retryAfterMs: number;
      shortpulseLifecycle?: {
        taskState: "running";
        queueState: "dispatching";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "dispatched";
      generationId: string;
      sourceRef: string | null;
      requestId: string;
      provider: string;
      modelId?: string | null;
      pollingProvider?: string | null;
      shortpulseLifecycle?: {
        taskState: "running";
        queueState: "dispatched";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "failed";
      generationId: string;
      sourceRef: string | null;
      message: string;
      shortpulseLifecycle?: {
        taskState: "fail";
        queueState: "failed";
        isTerminal: true;
        errorMessage: string;
        statusLabel?: string | null;
      };
    }
  | {
      status: "not_found";
    };

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

export type FalKlingTextSubmitRequest = {
  prompt: string;
  duration?: "5" | "10" | 5 | 10;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
  generate_audio?: boolean;
};

export type FalKlingV3TextSubmitRequest = {
  prompt: string;
  duration?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  multi_prompt?: { prompt: string; duration?: number }[] | null;
  shot_type?: "customize" | "intelligent";
  negative_prompt?: string;
  cfg_scale?: number;
  generate_audio?: boolean;
  voice_ids?: string[];
};

export type FalKlingV3ImageToVideoSubmitRequest = {
  prompt: string;
  start_image_url: string;
  end_image_url?: string;
  duration?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  resolution?: "720p" | "1080p";
  negative_prompt?: string;
  cfg_scale?: number;
  generate_audio?: boolean;
  voice_ids?: string[];
  multi_prompt?: Array<{ prompt: string; duration: number }>;
  shot_type?: "customize" | "intelligent";
  elements?: Array<{
    video_url?: string;
    frontal_image_url?: string;
    reference_image_urls?: string[];
  }>;
};

export type FalKlingStatusResponse = {
  status?: string;
  state?: string;
  error?: string;
  data?: {
    video?: { url?: string; content_type?: string };
  };
  video?: { url?: string; content_type?: string };
  request_id?: string;
};

export type FalSoraSubmitRequest = {
  prompt: string;
  resolution?: "720p" | "1080p";
  aspect_ratio?: "16:9" | "9:16";
  duration?: 4 | 8 | 12 | "4" | "8" | "12";
  delete_video?: boolean;
};

export type FalVeoSubmitRequest = {
  prompt: string;
  aspect_ratio?: "16:9" | "9:16";
  duration?: "4s" | "6s" | "8s" | string;
  negative_prompt?: string;
  resolution?: "720p" | "1080p" | "4k";
  generate_audio?: boolean;
  seed?: number;
  auto_fix?: boolean;
  enable_safety_checker?: boolean;
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | number;
};

export type FalVeoImageToVideoSubmitRequest = {
  prompt: string;
  image_url?: string;
  image_urls?: string[];
  aspect_ratio?: "16:9" | "9:16" | "auto";
  duration?: "4s" | "6s" | "8s";
  negative_prompt?: string;
  resolution?: "720p" | "1080p" | "4k";
  generate_audio?: boolean;
  seed?: number;
  auto_fix?: boolean;
  enable_safety_checker?: boolean;
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | number;
};

export type FalVeoFirstLastSubmitRequest = {
  prompt: string;
  first_frame_url: string;
  last_frame_url: string;
  aspect_ratio?: "auto" | "16:9" | "9:16";
  duration?: "4s" | "6s" | "8s";
  negative_prompt?: string;
  resolution?: "720p" | "1080p" | "4k";
  generate_audio?: boolean;
  seed?: number;
  auto_fix?: boolean;
  enable_safety_checker?: boolean;
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | number;
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

export type FalSeedanceSubmitRequest = {
  prompt: string;
  duration?: string | number;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  resolution?: "480p" | "720p" | "1080p";
  negative_prompt?: string;
  cfg_scale?: number;
  enable_safety_checker?: boolean;
  generate_audio?: boolean;
};

export type FalSeedanceI2VSubmitRequest = {
  prompt: string;
  image_url: string;
  end_image_url?: string;
  aspect_ratio?: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "9:21" | string;
  resolution?: "480p" | "720p" | "1080p";
  duration?: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | string;
  camera_fixed?: boolean;
  seed?: number;
  enable_safety_checker?: boolean;
  generate_audio?: boolean;
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
  init?: RequestInit & { timeoutMs?: number; shortpulseAuthTimeoutMs?: number }
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

const parsePositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.trunc(value));
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(1, parsed);
  }
  return null;
};

const readAdmissionRetryAfterSeconds = (response: Response, payload: unknown): number | null => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = parsePositiveInteger((payload as Record<string, unknown>).retryAfterSeconds);
    if (value !== null) return value;
  }
  const header = response.headers.get("Retry-After");
  return parsePositiveInteger(header);
};

const readAdmissionScope = (payload: unknown): "shared_provider" | "per_user" | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).admissionScope;
  return value === "shared_provider" || value === "per_user" ? value : null;
};

const readGenerationAdmissionErrorMessage = (
  response: Response,
  payload: unknown
): string | null => {
  if (response.status !== 429 && response.status !== 503) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const code = typeof data.code === "string" ? data.code : "";
  if (code !== "GENERATION_ADMISSION_LIMIT" && code !== "GENERATION_ADMISSION_UNAVAILABLE") {
    return null;
  }
  const retryAfterSeconds = readAdmissionRetryAfterSeconds(response, payload);
  if (code === "GENERATION_ADMISSION_UNAVAILABLE") {
    if (retryAfterSeconds === null) {
      return "Generation admission is temporarily unavailable. Please retry shortly.";
    }
    return `Generation admission is temporarily unavailable. Please retry in ${retryAfterSeconds} seconds.`;
  }
  const admissionScope = readAdmissionScope(payload);
  if (admissionScope === "shared_provider") {
    if (retryAfterSeconds === null) {
      return "Shared generation capacity is busy right now. Please retry shortly.";
    }
    return `Shared generation capacity is busy right now. Please retry in ${retryAfterSeconds} seconds.`;
  }
  if (admissionScope === "per_user") {
    if (retryAfterSeconds === null) {
      return "You already have too many active generations. Please retry shortly.";
    }
    return `You already have too many active generations. Please retry in ${retryAfterSeconds} seconds.`;
  }
  if (retryAfterSeconds === null) {
    return "Too many active generations. Please retry shortly.";
  }
  return `Too many active generations. Please retry in ${retryAfterSeconds} seconds.`;
};

const readRequestId = (payload: { request_id?: string; requestId?: string }): string | undefined =>
  payload.request_id || payload.requestId;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readQueuedSubmitResponse = (payload: unknown): FalQueuedSubmitResponse | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const status = asNonEmptyString(data.status);
  const code = asNonEmptyString(data.code);
  if (status !== "queued" || code !== "GENERATION_QUEUED") return null;
  const sourceRef = asNonEmptyString(data.sourceRef);
  const generationId = asNonEmptyString(data.generationId);
  if (!sourceRef || !generationId) return null;
  const parsedPollAfterMs = parsePositiveInteger(data.pollAfterMs);
  return {
    status: "queued",
    code: "GENERATION_QUEUED",
    sourceRef,
    generationId,
    pollAfterMs: parsedPollAfterMs ?? 2000,
  };
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

const submitEndpointRegistry = {
  flux: {
    route: `${FAL_API_BASE}/submit`,
    missingRequestIdMessage: "Fal did not return a request_id",
  },
  flux2: {
    route: `${FAL_API_BASE}/flux2-submit`,
    missingRequestIdMessage: "Fal FLUX 2 did not return a request_id",
  },
  flux2Edit: {
    route: `${FAL_API_BASE}/flux2-edit-submit`,
    missingRequestIdMessage: "Fal FLUX 2 Edit did not return a request_id",
  },
  flux2Pro: {
    route: `${FAL_API_BASE}/flux2pro-submit`,
    missingRequestIdMessage: "Fal FLUX 2 PRO did not return a request_id",
  },
  flux2ProEdit: {
    route: `${FAL_API_BASE}/flux2pro-edit-submit`,
    missingRequestIdMessage: "Fal FLUX 2 PRO Edit did not return a request_id",
  },
  flux2Klein: {
    route: `${FAL_API_BASE}/flux2klein-submit`,
    missingRequestIdMessage: "Fal FLUX 2 Klein did not return a request_id",
  },
  fluxProFill: {
    route: `${FAL_API_BASE}/flux-pro-fill-submit`,
    missingRequestIdMessage: "Fal FLUX Pro Fill did not return a request_id",
  },
  briaBackgroundRemove: {
    route: `${FAL_API_BASE}/bria-background-remove-submit`,
    missingRequestIdMessage: "Fal Bria background remove did not return a request_id",
  },
  nanoBanana: {
    route: `${FAL_API_BASE}/nano-banana-submit`,
    missingRequestIdMessage: "Fal Nano Banana did not return a request_id",
  },
  nanoBananaEdit: {
    route: `${FAL_API_BASE}/nano-banana-edit-submit`,
    missingRequestIdMessage: "Fal Nano Banana Edit did not return a request_id",
  },
  nanoBanana2: {
    route: `${FAL_API_BASE}/nano-banana-2-submit`,
    missingRequestIdMessage: "Fal Nano Banana 2 did not return a request_id",
  },
  nanoBanana2Edit: {
    route: `${FAL_API_BASE}/nano-banana-2-edit-submit`,
    missingRequestIdMessage: "Fal Nano Banana 2 Edit did not return a request_id",
  },
  nanoBananaPro: {
    route: `${FAL_API_BASE}/nano-banana-pro-submit`,
    missingRequestIdMessage: "Fal Nano Banana Pro did not return a request_id",
  },
  nanoBananaProEdit: {
    route: `${FAL_API_BASE}/nano-banana-pro-edit-submit`,
    missingRequestIdMessage: "Fal Nano Banana Pro Edit did not return a request_id",
  },
  klingV3Text: {
    route: `${FAL_API_BASE}/kling-v3-text-submit`,
    missingRequestIdMessage: "Fal Kling v3 text-to-video did not return a request_id",
  },
  sora: {
    route: `${FAL_API_BASE}/sora-submit`,
    missingRequestIdMessage: "Fal Sora did not return a request_id",
  },
  veo: {
    route: `${FAL_API_BASE}/veo-submit`,
    missingRequestIdMessage: "Fal Veo did not return a request_id",
  },
  veoImageToVideo: {
    route: `${FAL_API_BASE}/veo-image-to-video-submit`,
    missingRequestIdMessage: "Fal Veo image-to-video did not return a request_id",
  },
  veoFirstLast: {
    route: `${FAL_API_BASE}/veo-first-last-frame-submit`,
    missingRequestIdMessage: "Fal Veo first/last frame did not return a request_id",
  },
  seedream: {
    route: `${FAL_API_BASE}/seedream-submit`,
    missingRequestIdMessage: "Fal Seedream did not return a request_id",
  },
  seedreamEdit: {
    route: `${FAL_API_BASE}/seedream-edit-submit`,
    missingRequestIdMessage: "Fal Seedream Edit did not return a request_id",
  },
  seedreamV5Lite: {
    route: `${FAL_API_BASE}/seedream-v5-lite-submit`,
    missingRequestIdMessage: "Fal Seedream 5 Lite did not return a request_id",
  },
  seedreamV5LiteEdit: {
    route: `${FAL_API_BASE}/seedream-v5-lite-edit-submit`,
    missingRequestIdMessage: "Fal Seedream 5 Lite Edit did not return a request_id",
  },
  seedance: {
    route: `${FAL_API_BASE}/seedance-submit`,
    missingRequestIdMessage: "Fal Seedance did not return a request_id",
  },
  seedanceI2V: {
    route: `${FAL_API_BASE}/seedance-i2v-submit`,
    missingRequestIdMessage: "Fal Seedance I2V did not return a request_id",
  },
  klingV3ImageToVideo: {
    route: `${FAL_API_BASE}/kling-v3-image-to-video-submit`,
    missingRequestIdMessage: "Fal Kling 3.0 image-to-video did not return a request_id",
  },
  kieVeoImageToVideo: {
    route: `${FAL_API_BASE}/kie-veo-submit`,
    missingRequestIdMessage: "Kie Veo 3.1 Fast I2V did not return a request_id",
  },
  kieKlingImageToVideo: {
    route: `${FAL_API_BASE}/kie-kling-submit`,
    missingRequestIdMessage: "Kie Kling 3.0 did not return a request_id",
  },
} as const;

type StatusEndpointConfig = {
  route: string;
  statusTimeoutMs: number;
  fallbackGetOn405?: boolean;
};

const STATUS_TIMEOUT_STANDARD_MS = 75_000;
const STATUS_TIMEOUT_VEO_MS = 105_000;

const statusEndpointRegistry = {
  flux: { route: `${FAL_API_BASE}/status`, statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS },
  flux2: { route: `${FAL_API_BASE}/flux2-status`, statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS },
  flux2Edit: {
    route: `${FAL_API_BASE}/flux2-edit-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  flux2Pro: {
    route: `${FAL_API_BASE}/flux2pro-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  flux2ProEdit: {
    route: `${FAL_API_BASE}/flux2pro-edit-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  flux2Klein: {
    route: `${FAL_API_BASE}/flux2klein-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  fluxProFill: {
    route: `${FAL_API_BASE}/flux-pro-fill-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  briaBackgroundRemove: {
    route: `${FAL_API_BASE}/bria-background-remove-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBanana: {
    route: `${FAL_API_BASE}/nano-banana-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBananaEdit: {
    route: `${FAL_API_BASE}/nano-banana-edit-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBanana2: {
    route: `${FAL_API_BASE}/nano-banana-2-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBanana2Edit: {
    route: `${FAL_API_BASE}/nano-banana-2-edit-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBananaPro: {
    route: `${FAL_API_BASE}/nano-banana-pro-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  nanoBananaProEdit: {
    route: `${FAL_API_BASE}/nano-banana-pro-edit-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  kling: { route: `${FAL_API_BASE}/kling-status`, statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS },
  sora: { route: `${FAL_API_BASE}/sora-status`, statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS },
  veo: { route: `${FAL_API_BASE}/veo-status`, statusTimeoutMs: STATUS_TIMEOUT_VEO_MS },
  veoImageToVideo: {
    route: `${FAL_API_BASE}/veo-image-to-video-status`,
    statusTimeoutMs: STATUS_TIMEOUT_VEO_MS,
    fallbackGetOn405: true,
  },
  seedream: {
    route: `${FAL_API_BASE}/seedream-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  seedance: {
    route: `${FAL_API_BASE}/seedance-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  seedanceI2V: {
    route: `${FAL_API_BASE}/seedance-i2v-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  klingV3ImageToVideo: {
    route: `${FAL_API_BASE}/kling-v3-image-to-video-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  kieVeoImageToVideo: {
    route: `${FAL_API_BASE}/kie-veo-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
  kieKlingImageToVideo: {
    route: `${FAL_API_BASE}/kie-kling-status`,
    statusTimeoutMs: STATUS_TIMEOUT_STANDARD_MS,
  },
} as const satisfies Record<string, StatusEndpointConfig>;

type SubmitEndpointKey = keyof typeof submitEndpointRegistry;
type StatusEndpointKey = keyof typeof statusEndpointRegistry;

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

const createStatusTimeoutError = (endpoint: StatusEndpointKey, timeoutMs: number): Error =>
  new Error(`[fal-status:${endpoint}] timed out after ${timeoutMs}ms`);

const submitFalEndpoint = async <TPayload>(
  endpoint: SubmitEndpointKey,
  payload: TPayload
): Promise<FalSubmitResponse> => {
  const config = submitEndpointRegistry[endpoint];
  const response = await fetchWithTimeout(config.route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    shortpulseAuthTimeoutMs: SUBMIT_AUTH_TIMEOUT_MS,
  });
  const data = await handleJson<Record<string, unknown>>(response);
  const queued = readQueuedSubmitResponse(data);
  if (queued) {
    return queued;
  }
  const requestId = readRequestId(data as { request_id?: string; requestId?: string });
  if (!requestId) {
    throw new Error(config.missingRequestIdMessage);
  }
  const generationId = asNonEmptyString((data as { generationId?: unknown }).generationId);
  return generationId ? { request_id: requestId, generationId } : { request_id: requestId };
};

export const fetchFalQueueStatus = async ({
  sourceRef,
  generationId,
}: {
  sourceRef?: string | null;
  generationId?: string | null;
}): Promise<FalQueueStatusResponse> => {
  const params = new URLSearchParams();
  if (typeof sourceRef === "string" && sourceRef.trim().length > 0) {
    params.set("sourceRef", sourceRef.trim());
  }
  if (typeof generationId === "string" && generationId.trim().length > 0) {
    params.set("generationId", generationId.trim());
  }
  if (!params.size) {
    throw new Error("Queue status request requires sourceRef or generationId.");
  }
  const response = await fetchWithTimeout(`${FAL_API_BASE}/queue-status?${params.toString()}`, {
    method: "GET",
  });
  return handleJson<FalQueueStatusResponse>(response);
};

const fetchFalStatusEndpoint = async <TStatus>(
  endpoint: StatusEndpointKey,
  requestId: string
): Promise<TStatus> => {
  const config = statusEndpointRegistry[endpoint];
  const { statusTimeoutMs } = config;
  let response: Response;
  try {
    response = await fetchWithTimeout(config.route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
      timeoutMs: statusTimeoutMs,
    });
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw createStatusTimeoutError(endpoint, statusTimeoutMs);
    }
    throw error;
  }
  const fallbackGetOn405 = "fallbackGetOn405" in config && config.fallbackGetOn405 === true;
  if (response.status === 405 && fallbackGetOn405) {
    let fallback: Response;
    try {
      fallback = await fetchWithTimeout(
        `${config.route}?requestId=${encodeURIComponent(requestId)}`,
        {
          method: "GET",
          timeoutMs: statusTimeoutMs,
        }
      );
    } catch (error) {
      if (isTimeoutLikeError(error)) {
        throw createStatusTimeoutError(endpoint, statusTimeoutMs);
      }
      throw error;
    }
    return handleJson<TStatus>(fallback);
  }
  return handleJson<TStatus>(response);
};

export const submitFalFlux = (payload: FalSubmitRequest) => submitFalEndpoint("flux", payload);
export const fetchFalStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux", requestId);

export const submitFalFlux2 = (payload: FalSubmitRequest) => submitFalEndpoint("flux2", payload);
export const fetchFalFlux2Status = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux2", requestId);

export const submitFalFlux2Edit = (payload: FalSubmitRequest) =>
  submitFalEndpoint("flux2Edit", payload);
export const fetchFalFlux2EditStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux2Edit", requestId);

export const submitFalFlux2Pro = (payload: FalSubmitRequest) =>
  submitFalEndpoint("flux2Pro", payload);
export const fetchFalFlux2ProStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux2Pro", requestId);

export const submitFalFlux2ProEdit = (payload: FalSubmitRequest) =>
  submitFalEndpoint("flux2ProEdit", payload);
export const fetchFalFlux2ProEditStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux2ProEdit", requestId);

export const submitFalFlux2Klein = (payload: FalSubmitRequest) =>
  submitFalEndpoint("flux2Klein", payload);
export const fetchFalFlux2KleinStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("flux2Klein", requestId);

export const submitFalFluxProFill = (payload: FalSubmitRequest) =>
  submitFalEndpoint("fluxProFill", payload);
export const fetchFalFluxProFillStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("fluxProFill", requestId);

export const submitFalBriaBackgroundRemove = (payload: FalBriaBackgroundRemoveSubmitRequest) =>
  submitFalEndpoint("briaBackgroundRemove", payload);
export const fetchFalBriaBackgroundRemoveStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("briaBackgroundRemove", requestId);

export const submitFalNanoBanana = (payload: FalNanoBananaSubmitRequest) =>
  submitFalEndpoint("nanoBanana", payload);
export const fetchFalNanoBananaStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBanana", requestId);

export const submitFalNanoBananaEdit = (payload: FalNanoBananaEditSubmitRequest) =>
  submitFalEndpoint("nanoBananaEdit", payload);
export const fetchFalNanoBananaEditStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBananaEdit", requestId);

export const submitFalNanoBanana2 = (payload: FalNanoBanana2SubmitRequest) =>
  submitFalEndpoint("nanoBanana2", payload);
export const fetchFalNanoBanana2Status = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBanana2", requestId);

export const submitFalNanoBanana2Edit = (
  payload: FalNanoBanana2SubmitRequest & { image_urls: string[] }
) => submitFalEndpoint("nanoBanana2Edit", payload);
export const fetchFalNanoBanana2EditStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBanana2Edit", requestId);

export const submitFalNanoBananaPro = (payload: FalNanoBananaProSubmitRequest) =>
  submitFalEndpoint("nanoBananaPro", payload);
export const fetchFalNanoBananaProStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBananaPro", requestId);

export const submitFalNanoBananaProEdit = (
  payload: FalNanoBananaProSubmitRequest & { image_urls: string[] }
) => submitFalEndpoint("nanoBananaProEdit", payload);
export const fetchFalNanoBananaProEditStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("nanoBananaProEdit", requestId);

export const submitFalKlingV3Text = (payload: FalKlingV3TextSubmitRequest) =>
  submitFalEndpoint("klingV3Text", payload);
export const fetchFalKlingStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalKlingStatusResponse>("kling", requestId);

export const submitFalSoraPro = (payload: FalSoraSubmitRequest) =>
  submitFalEndpoint("sora", payload);
export const fetchFalSoraStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("sora", requestId);

export const submitFalVeo = (payload: FalVeoSubmitRequest) => submitFalEndpoint("veo", payload);
export const submitFalVeoImageToVideo = (payload: FalVeoImageToVideoSubmitRequest) =>
  submitFalEndpoint("veoImageToVideo", payload);
export const submitFalVeoFirstLast = (payload: FalVeoFirstLastSubmitRequest) =>
  submitFalEndpoint("veoFirstLast", payload);
export const fetchFalVeoStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("veo", requestId);
export const fetchFalVeoImageToVideoStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("veoImageToVideo", requestId);

export const submitFalSeedream = (payload: FalSeedreamSubmitRequest) =>
  submitFalEndpoint("seedream", payload);
export const submitFalSeedreamEdit = (payload: FalSeedreamEditSubmitRequest) =>
  submitFalEndpoint("seedreamEdit", payload);
export const submitFalSeedreamV5Lite = (payload: FalSeedreamSubmitRequest) =>
  submitFalEndpoint("seedreamV5Lite", payload);
export const submitFalSeedreamV5LiteEdit = (payload: FalSeedreamEditSubmitRequest) =>
  submitFalEndpoint("seedreamV5LiteEdit", payload);
export const fetchFalSeedreamStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("seedream", requestId);

export const submitFalSeedance = (payload: FalSeedanceSubmitRequest) =>
  submitFalEndpoint("seedance", payload);
export const fetchFalSeedanceStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("seedance", requestId);

export const submitFalSeedanceI2V = (payload: FalSeedanceI2VSubmitRequest) =>
  submitFalEndpoint("seedanceI2V", payload);
export const fetchFalSeedanceI2VStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("seedanceI2V", requestId);

export const submitFalKlingV3ImageToVideo = (payload: FalKlingV3ImageToVideoSubmitRequest) =>
  submitFalEndpoint("klingV3ImageToVideo", payload);
export const fetchFalKlingV3ImageToVideoStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("klingV3ImageToVideo", requestId);

export const submitKieVeoImageToVideo = (payload: KieSubmitRequest) =>
  submitFalEndpoint("kieVeoImageToVideo", payload);
export const fetchKieVeoImageToVideoStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("kieVeoImageToVideo", requestId);

export const submitKieKlingImageToVideo = (payload: KieSubmitRequest) =>
  submitFalEndpoint("kieKlingImageToVideo", payload);
export const fetchKieKlingImageToVideoStatus = (requestId: string) =>
  fetchFalStatusEndpoint<FalStatusResponse>("kieKlingImageToVideo", requestId);
