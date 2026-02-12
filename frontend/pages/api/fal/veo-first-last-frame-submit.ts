import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_VEO_FIRST_LAST_SUBMIT_URL =
  "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video";
const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;
const ALLOWED_ASPECTS = new Set(["auto", "16:9", "9:16"]);
const ALLOWED_DURATIONS = new Set(["4s", "6s", "8s"]);
const ALLOWED_RESOLUTIONS = new Set(["720p", "1080p", "4k"]);

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isClearlyVideoSource = (value: string): boolean =>
  /^data:video\//i.test(value) || value.startsWith("blob:") || VIDEO_FILE_PATTERN.test(value);

export const validateVeoFirstLastPayload = (payload: Record<string, unknown>) => {
  const prompt = asTrimmedString(payload.prompt);
  if (!prompt) {
    return {
      error: "Missing required prompt for Veo first/last frame generation.",
      detail: { field: "prompt" },
    };
  }

  const firstFrameUrl = asTrimmedString(payload.first_frame_url);
  if (!firstFrameUrl) {
    return {
      error: "Missing required first_frame_url for Veo first/last frame generation.",
      detail: { field: "first_frame_url" },
    };
  }
  if (isClearlyVideoSource(firstFrameUrl)) {
    return {
      error: "first_frame_url must reference an image, not a video source.",
      detail: { field: "first_frame_url" },
    };
  }

  const lastFrameUrl = asTrimmedString(payload.last_frame_url);
  if (!lastFrameUrl) {
    return {
      error: "Missing required last_frame_url for Veo first/last frame generation.",
      detail: { field: "last_frame_url" },
    };
  }
  if (isClearlyVideoSource(lastFrameUrl)) {
    return {
      error: "last_frame_url must reference an image, not a video source.",
      detail: { field: "last_frame_url" },
    };
  }

  const aspectRatio = asTrimmedString(payload.aspect_ratio);
  if (aspectRatio && !ALLOWED_ASPECTS.has(aspectRatio)) {
    return {
      error: "Invalid aspect_ratio for Veo first/last frame generation.",
      detail: { field: "aspect_ratio", allowed: Array.from(ALLOWED_ASPECTS) },
    };
  }

  const duration = asTrimmedString(payload.duration);
  if (duration && !ALLOWED_DURATIONS.has(duration)) {
    return {
      error: "Invalid duration for Veo first/last frame generation.",
      detail: { field: "duration", allowed: Array.from(ALLOWED_DURATIONS) },
    };
  }

  const resolution = asTrimmedString(payload.resolution);
  if (resolution && !ALLOWED_RESOLUTIONS.has(resolution.toLowerCase())) {
    return {
      error: "Invalid resolution for Veo first/last frame generation.",
      detail: { field: "resolution", allowed: Array.from(ALLOWED_RESOLUTIONS) },
    };
  }

  if (payload.generate_audio !== undefined && typeof payload.generate_audio !== "boolean") {
    return {
      error: "generate_audio must be a boolean when provided.",
      detail: { field: "generate_audio" },
    };
  }

  return null;
};

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1/first-last-frame-to-video",
  submitUrl: FAL_VEO_FIRST_LAST_SUBMIT_URL,
  routeLabel: "Fal Veo first/last frame",
  validatePayload: validateVeoFirstLastPayload,
});
