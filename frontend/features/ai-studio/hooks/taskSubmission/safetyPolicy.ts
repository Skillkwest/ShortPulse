/**
 * Centralizes generation safety payload defaults so image/video model routes stay aligned.
 * Policy target: moderate restriction by default for models that expose safety controls.
 */
export type SubmissionSafetyPayload = {
  enable_safety_checker?: boolean;
  safety_tolerance?: "1" | "3" | "5";
};

type SubmissionSafetyLevel = "off" | "moderate" | "strict";

const IMAGE_DISABLE_CHECKER_MODELS = new Set<string>([
  "fal-ai/flux-2/klein/9b",
  "fal/flux-2",
  "fal/flux-2/edit",
  "fal-ai/bytedance/seedream/v4.5/text-to-image",
  "fal-ai/bytedance/seedream/v4.5/edit",
  "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  "fal-ai/bytedance/seedream/v5/lite/edit",
]);

const IMAGE_TOLERANCE_MODELS = new Set<string>(["fal/flux-2-pro", "fal/flux-2-pro/edit"]);

const VIDEO_DISABLE_CHECKER_MODELS = new Set<string>([
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
]);

const VIDEO_TOLERANCE_MODELS = new Set<string>([
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
]);

const resolveClientSubmissionSafetyLevel = (): SubmissionSafetyLevel => {
  const normalized = String(process.env.NEXT_PUBLIC_AI_STUDIO_GENERATION_SAFETY_LEVEL ?? "moderate")
    .trim()
    .toLowerCase();
  if (normalized === "off") return "off";
  if (normalized === "strict") return "strict";
  return "moderate";
};

const buildSafetyPayload = ({
  checkerDisabled,
  toleranceEnabled,
  level = resolveClientSubmissionSafetyLevel(),
}: {
  checkerDisabled: boolean;
  toleranceEnabled: boolean;
  level?: SubmissionSafetyLevel;
}): SubmissionSafetyPayload => {
  if (!checkerDisabled) return {};
  const checkerEnabled = level !== "off";
  if (!toleranceEnabled) {
    return { enable_safety_checker: checkerEnabled };
  }
  return {
    enable_safety_checker: checkerEnabled,
    safety_tolerance: level === "strict" ? "1" : level === "off" ? "5" : "3",
  };
};

export const resolveImageSubmissionSafetyPayload = (modelId: string): SubmissionSafetyPayload =>
  buildSafetyPayload({
    checkerDisabled:
      IMAGE_DISABLE_CHECKER_MODELS.has(modelId) || IMAGE_TOLERANCE_MODELS.has(modelId),
    toleranceEnabled: IMAGE_TOLERANCE_MODELS.has(modelId),
  });

export const resolveVideoSubmissionSafetyPayload = (modelId: string): SubmissionSafetyPayload =>
  buildSafetyPayload({
    checkerDisabled:
      VIDEO_DISABLE_CHECKER_MODELS.has(modelId) || VIDEO_TOLERANCE_MODELS.has(modelId),
    toleranceEnabled: VIDEO_TOLERANCE_MODELS.has(modelId),
  });
