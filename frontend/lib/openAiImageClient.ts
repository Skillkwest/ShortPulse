/**
 * Historical types for the retired direct OpenAI GPT Image 2 client.
 * Active GPT Image 2 image generation uses the queued Kie routes.
 */
import type { InternalMediaRef } from "./media/internalMediaRefs";
import type {
  OpenAiImage2InputFidelity,
  OpenAiImage2Quality,
  OpenAiImage2Size,
} from "./model-runtime/openAiImage2";

type OpenAiImageSharedRequest = {
  prompt: string;
  size: OpenAiImage2Size;
  quality: OpenAiImage2Quality;
  project_id?: string;
  generation_replay?: Record<string, unknown>;
  character_context?: Record<string, unknown>;
  style_context?: Record<string, unknown>;
  shortpulse_context?: Record<string, unknown>;
  shortpulse_internal_media_refs?: Array<InternalMediaRef | null>;
  shortpulse_internal_edit_media_refs?: {
    base_image?: InternalMediaRef | null;
    mask_image?: InternalMediaRef | null;
    reference_image?: InternalMediaRef | null;
  };
};

export type OpenAiImageSubmitRequest = OpenAiImageSharedRequest;

export type OpenAiImageSource = {
  image_url: string;
};

export type OpenAiImageEditRequest = OpenAiImageSharedRequest & {
  images: OpenAiImageSource[];
  input_fidelity?: OpenAiImage2InputFidelity;
  mask?: OpenAiImageSource;
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
    saveState: "saved" | "idle" | "blocked_storage";
    saveError: string | null;
  };
};

const RETIRED_OPENAI_GPT_IMAGE_2_ROUTE_MESSAGE =
  "Direct OpenAI GPT Image 2 routes are retired. Use the queued Kie GPT Image 2 routes.";

/**
 * Retired direct OpenAI GPT Image 2 generation client.
 */
export const submitOpenAiGptImage2 = async (
  _payload: OpenAiImageSubmitRequest
): Promise<OpenAiImageSubmitResponse> => {
  void _payload;
  throw new Error(RETIRED_OPENAI_GPT_IMAGE_2_ROUTE_MESSAGE);
};

/**
 * Retired direct OpenAI GPT Image 2 edit client.
 */
export const submitOpenAiGptImage2Edit = async (
  _payload: OpenAiImageEditRequest
): Promise<OpenAiImageSubmitResponse> => {
  void _payload;
  throw new Error(RETIRED_OPENAI_GPT_IMAGE_2_ROUTE_MESSAGE);
};
