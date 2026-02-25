/**
 * Centralizes generation safety payload defaults so image model routes stay aligned.
 * Policy target: use the minimum supported restriction for models that expose safety controls.
 */
export type ImageSubmissionSafetyPayload = {
  enable_safety_checker?: boolean;
  safety_tolerance?: "5";
};

export const resolveImageSubmissionSafetyPayload = (
  modelId: string
): ImageSubmissionSafetyPayload => {
  switch (modelId) {
    case "fal-ai/flux-2/klein/9b":
    case "fal/flux-2":
    case "fal/flux-2/edit":
    case "fal-ai/bytedance/seedream/v4.5/text-to-image":
    case "fal-ai/bytedance/seedream/v4.5/edit":
      return { enable_safety_checker: false };
    case "fal/flux-2-pro":
    case "fal/flux-2-pro/edit":
      return { enable_safety_checker: false, safety_tolerance: "5" };
    default:
      return {};
  }
};
