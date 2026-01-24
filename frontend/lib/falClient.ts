/**
 * Thin client for Fal.ai interactions (flux/dev text-to-image + Kling video).
 * Proxies through Next API routes to keep keys server-side.
 */
export type FalSubmitRequest = {
  prompt: string;
  image_size?: string | { width: number; height: number };
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  enable_safety_checker?: boolean;
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

export type FalKlingSubmitRequest = {
  prompt: string;
  image_url: string;
  duration?: "5" | "10" | 5 | 10;
  negative_prompt?: string;
  cfg_scale?: number;
};

export type FalKlingSubmitResponse = { request_id: string };

export type FalKlingTextSubmitRequest = {
  prompt: string;
  duration?: "5" | "10" | 5 | 10;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
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

const FAL_API_BASE = "/api/fal";

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

export const submitFalKling = async (payload: FalKlingSubmitRequest): Promise<FalKlingSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/kling-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Kling did not return a request_id");
  }
  return { request_id: requestId };
};

export const submitFalKlingText = async (payload: FalKlingTextSubmitRequest): Promise<FalKlingSubmitResponse> => {
  const response = await fetchWithTimeout(`${FAL_API_BASE}/kling-text-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ request_id?: string; requestId?: string }>(response);
  const requestId = data.request_id || (data as any).requestId;
  if (!requestId) {
    throw new Error("Fal Kling text-to-video did not return a request_id");
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
