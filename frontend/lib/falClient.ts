/**
 * Thin client for Fal.ai interactions (flux/dev, flux-2, flux-2-pro, flux-2-max text-to-image + Kling video).
 * Proxies through Next API routes to keep keys server-side.
 */
export type FalSubmitRequest = {
  prompt: string;
  image_url?: string;
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

export type FalSubmitResponse = { request_id: string };

export type FalStatusResponse = {
  status?: string;
  error?: string;
  data?: {
    images?: { url: string; content_type?: string; width?: number; height?: number }[];
    prompt?: string;
  };
};

export type FalKlingTextSubmitRequest = {
  prompt: string;
  duration?: "5" | "10" | 5 | 10;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
  generate_audio?: boolean;
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

export type FalSeedanceSubmitRequest = {
  prompt: string;
  duration?: string | number;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  negative_prompt?: string;
  cfg_scale?: number;
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

export type Imagen4FastSubmitRequest = {
  prompt: string;
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  num_images?: number;
  output_format?: "jpeg" | "png" | "webp";
};

const FAL_API_BASE = "/api/fal";

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 60000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const handleJson = async <T>(response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as any)?.message || (data as any)?.error || "Unexpected error";
    throw new Error(message);
  }
  return data as T;
};

export const submitFalFlux = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalFlux2 = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 2 did not return a request_id");
  }
  return { request_id: requestId };
};

export const submitFalFlux1Schnell = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux1schnell-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 1 Schnell did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalFlux1SchnellStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux1schnell-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const fetchFalFlux2Status = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalFlux2Edit = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2-edit-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 2 Edit did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalFlux2EditStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2-edit-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalFlux2Pro = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2pro-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 2 PRO did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalFlux2ProStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2pro-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalFlux2ProEdit = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2pro-edit-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 2 PRO Edit did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalFlux2ProEditStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2pro-edit-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalFlux2Max = async (payload: FalSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2max-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal FLUX 2 MAX did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalFlux2MaxStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/flux2max-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitImagen4Fast = async (payload: Imagen4FastSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/imagen4fast-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Imagen 4 Fast did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchImagen4FastStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/imagen4fast-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export type FalNanoBananaSubmitRequest = {
  prompt: string;
  num_images?: number;
  aspect_ratio?: string;
  output_format?: "jpeg" | "png" | "webp";
  sync_mode?: boolean;
  limit_generations?: boolean;
};

export const submitFalNanoBanana = async (
  payload: FalNanoBananaSubmitRequest,
): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Nano Banana did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalNanoBananaStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalNanoBananaEdit = async (
  payload: FalNanoBananaEditSubmitRequest,
): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-edit-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Nano Banana Edit did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalNanoBananaEditStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-edit-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
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

export const submitFalNanoBananaPro = async (
  payload: FalNanoBananaProSubmitRequest,
): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-pro-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Nano Banana Pro did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalNanoBananaProStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-pro-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalNanoBananaProEdit = async (
  payload: FalNanoBananaProSubmitRequest & { image_urls: string[] },
): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-pro-edit-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Nano Banana Pro Edit did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalNanoBananaProEditStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/nano-banana-pro-edit-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalKlingV25Text = async (payload: FalKlingTextSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/kling-v25-text-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Kling v2.5 text-to-video did not return a request_id");
  }
  return { request_id: requestId };
};

export const submitFalKlingV26Text = async (payload: FalKlingTextSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/kling-v26-text-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Kling v2.6 text-to-video did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalKlingStatus = async (requestId: string): Promise<FalKlingStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/kling-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalKlingStatusResponse>(response);
};

export const submitFalSoraPro = async (payload: FalSoraSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/sora-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Sora did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalSoraStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/sora-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalVeo = async (payload: FalVeoSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/veo-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Veo did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalVeoStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/veo-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalSeedream = async (payload: FalSeedreamSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/seedream-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Seedream did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalSeedreamStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/seedream-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export const submitFalSeedance = async (payload: FalSeedanceSubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/seedance-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Seedance did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalSeedanceStatus = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/seedance-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};

export type FalKlingV25SubmitRequest = {
  prompt: string;
  image_url: string;
  duration?: "5" | "10" | number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
  tail_image_url?: string;
};

const FAL_KLING_V25_SUBMIT = `${FAL_API_BASE}/kling-v25-image-to-video-submit`;
const FAL_KLING_V25_STATUS = `${FAL_API_BASE}/kling-v25-image-to-video-status`;

export const submitFalKlingV25 = async (payload: FalKlingV25SubmitRequest): Promise<FalSubmitResponse> => {
  const response = await fetchWithTimeout(FAL_KLING_V25_SUBMIT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Kling 2.5 did not return a request_id");
  }
  return { request_id: requestId };
};

export const fetchFalKlingV25Status = async (requestId: string): Promise<FalStatusResponse> => {
  const response = await fetchWithTimeout(FAL_KLING_V25_STATUS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  return handleJson<FalStatusResponse>(response);
};
