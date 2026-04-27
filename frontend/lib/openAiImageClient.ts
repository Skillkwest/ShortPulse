/**
 * Authenticated client for the ShortPulse OpenAI GPT Image 2 route.
 * Keeps provider submit logic out of UI hooks while preserving server-owned credentials.
 */
import { fetchWithAuth } from "./authenticatedFetch";
import type { OpenAiImage2Quality, OpenAiImage2Size } from "./model-runtime/openAiImage2";

export type OpenAiImageSubmitRequest = {
  prompt: string;
  size: OpenAiImage2Size;
  quality: OpenAiImage2Quality;
  project_id?: string;
  generation_replay?: Record<string, unknown>;
  character_context?: Record<string, unknown>;
  style_context?: Record<string, unknown>;
  shortpulse_context?: Record<string, unknown>;
};

export type OpenAiImageSubmitResponse = {
  output: {
    provider: "openai-image";
    mode: "image";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    modelId: string;
    savedMediaIds: string[];
  };
};

/**
 * Submits one GPT Image 2 generation request through the authenticated server route.
 */
export const submitOpenAiGptImage2 = async (
  payload: OpenAiImageSubmitRequest
): Promise<OpenAiImageSubmitResponse> => {
  const response = await fetchWithAuth("/api/openai/image-generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as
    | OpenAiImageSubmitResponse
    | { error?: string; details?: string };
  if (!response.ok) {
    const message =
      ("details" in data && typeof data.details === "string" && data.details.trim()) ||
      ("error" in data && typeof data.error === "string" && data.error.trim()) ||
      "Unable to generate image.";
    throw new Error(message);
  }
  return data as OpenAiImageSubmitResponse;
};
