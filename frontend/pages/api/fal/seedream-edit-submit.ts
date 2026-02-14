/**
 * Seedream edit submit proxy with payload validation.
 * Enforces prompt + 1..10 image references before charging/submitting upstream.
 */
import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_SEEDREAM_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit";
const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isClearlyVideoSource = (value: string): boolean =>
  /^data:video\//i.test(value) || value.startsWith("blob:") || VIDEO_FILE_PATTERN.test(value);

const readImageUrls = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

export const validateSeedreamEditPayload = (payload: Record<string, unknown>) => {
  const prompt = asTrimmedString(payload.prompt);
  if (!prompt) {
    return {
      error: "Missing required prompt for Seedream edit generation.",
      detail: { field: "prompt" },
    };
  }

  const imageUrls = readImageUrls(payload.image_urls);
  if (!imageUrls.length) {
    return {
      error: "Seedream edit requires at least one reference image URL.",
      detail: { field: "image_urls", min: 1, max: 10 },
    };
  }
  if (imageUrls.length > 10) {
    return {
      error: "Seedream edit accepts at most 10 reference image URLs.",
      detail: { field: "image_urls", min: 1, max: 10 },
    };
  }

  const videoLikeImageUrl = imageUrls.find((url) => isClearlyVideoSource(url));
  if (videoLikeImageUrl) {
    return {
      error: "image_urls must only contain image sources.",
      detail: { field: "image_urls" },
    };
  }

  return null;
};

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  submitUrl: FAL_SEEDREAM_EDIT_SUBMIT_URL,
  routeLabel: "Fal Seedream edit",
  timeoutMs: 60000,
  validatePayload: validateSeedreamEditPayload,
});
