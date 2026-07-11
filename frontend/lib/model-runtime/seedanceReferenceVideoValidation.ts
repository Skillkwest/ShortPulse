/**
 * Shared Seedance reference-video duration validation for client and server admission.
 */
import { KIE_SEEDANCE_2_FAST_MODEL_ID, KIE_SEEDANCE_2_MODEL_ID } from "./providerModelIds";

export const SEEDANCE_REFERENCE_VIDEO_DURATION_LIMIT_SECONDS = 15;

export type SeedanceReferenceVideoValidationCode =
  | "SEEDANCE_REFERENCE_VIDEO_DURATION_REQUIRED"
  | "SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED";

export type SeedanceReferenceVideoValidationError = {
  code: SeedanceReferenceVideoValidationCode;
  message: string;
};

export const isSeedance2ModelId = (modelId: string | null | undefined): boolean =>
  modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;

/**
 * Validates required aggregate duration evidence for Seedance video references.
 */
export const validateSeedanceReferenceVideoDuration = ({
  modelId,
  inputVideoCount,
  inputVideoDurationSeconds,
}: {
  modelId: string;
  inputVideoCount: number | null | undefined;
  inputVideoDurationSeconds: number | null | undefined;
}): SeedanceReferenceVideoValidationError | null => {
  if (!isSeedance2ModelId(modelId)) return null;
  const normalizedCount =
    typeof inputVideoCount === "number" && Number.isFinite(inputVideoCount)
      ? Math.max(0, Math.trunc(inputVideoCount))
      : 0;
  if (normalizedCount === 0) return null;
  if (
    typeof inputVideoDurationSeconds !== "number" ||
    !Number.isFinite(inputVideoDurationSeconds) ||
    inputVideoDurationSeconds <= 0
  ) {
    return {
      code: "SEEDANCE_REFERENCE_VIDEO_DURATION_REQUIRED",
      message:
        "Seedance 2 reference-video duration is still being resolved. Try again in a moment.",
    };
  }
  if (inputVideoDurationSeconds > SEEDANCE_REFERENCE_VIDEO_DURATION_LIMIT_SECONDS) {
    return {
      code: "SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED",
      message: `Seedance 2 reference videos must total ${SEEDANCE_REFERENCE_VIDEO_DURATION_LIMIT_SECONDS} seconds or less.`,
    };
  }
  return null;
};
