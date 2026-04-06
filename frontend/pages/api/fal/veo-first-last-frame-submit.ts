import type { NextApiRequest, NextApiResponse } from "next";

type ValidationResult = {
  error: string;
  detail?: unknown;
} | null;

const ALLOWED_ASPECT_RATIOS = new Set(["16:9", "9:16"]);
const ALLOWED_DURATIONS = new Set(["5s", "6s", "7s", "8s", "9s"]);
const ALLOWED_RESOLUTIONS = new Set(["720p", "1080p"]);
const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isClearlyVideoSource = (value: string): boolean =>
  /^data:video\//i.test(value) || value.startsWith("blob:") || VIDEO_FILE_PATTERN.test(value);

export const validateVeoFirstLastPayload = (payload: Record<string, unknown>): ValidationResult => {
  const prompt = asTrimmedString(payload.prompt);
  if (!prompt) {
    return {
      error: "Missing required prompt for Fal Veo first-last generation.",
      detail: { field: "prompt" },
    };
  }

  const firstFrameUrl = asTrimmedString(payload.first_frame_url);
  if (!firstFrameUrl) {
    return {
      error: "Missing required first frame URL for Fal Veo first-last generation.",
      detail: { field: "first_frame_url" },
    };
  }
  if (isClearlyVideoSource(firstFrameUrl)) {
    return {
      error: "first_frame_url must be an image source.",
      detail: { field: "first_frame_url" },
    };
  }

  const lastFrameUrl = asTrimmedString(payload.last_frame_url);
  if (!lastFrameUrl) {
    return {
      error: "Missing required last frame URL for Fal Veo first-last generation.",
      detail: { field: "last_frame_url" },
    };
  }
  if (isClearlyVideoSource(lastFrameUrl)) {
    return {
      error: "last_frame_url must be an image source.",
      detail: { field: "last_frame_url" },
    };
  }

  const aspectRatio = asTrimmedString(payload.aspect_ratio);
  if (aspectRatio && !ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
    return {
      error: "Invalid aspect_ratio for Fal Veo first-last generation.",
      detail: { field: "aspect_ratio", allowed: Array.from(ALLOWED_ASPECT_RATIOS) },
    };
  }

  const duration = asTrimmedString(payload.duration);
  if (duration && !ALLOWED_DURATIONS.has(duration)) {
    return {
      error: "Invalid duration for Fal Veo first-last generation.",
      detail: { field: "duration", allowed: Array.from(ALLOWED_DURATIONS) },
    };
  }

  const resolution = asTrimmedString(payload.resolution);
  if (resolution && !ALLOWED_RESOLUTIONS.has(resolution)) {
    return {
      error: "Invalid resolution for Fal Veo first-last generation.",
      detail: { field: "resolution", allowed: Array.from(ALLOWED_RESOLUTIONS) },
    };
  }

  return null;
};

export default function falVeoFirstLastFrameSubmit(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  return res.status(410).json({
    error: "Fal Veo 3.1 first-last-frame is disabled.",
    detail: "Use Kie Veo 3.1 or another active video model instead.",
  });
}
