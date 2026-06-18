import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import { normalizeEditSubmitIntent, type EditSubmitIntent } from "../../logic/editSubmitIntent";
import type {
  ExpertEditCompiledPromptOverrides,
  ExpertEditRegenerateOptions,
} from "./expertEditSubmissionContract";
import type { WorkflowReloadExpertEditReferences } from "../../types";

const MAX_EXPERT_EDIT_SUBMISSION_REFERENCE_INPUTS = 11;

export type ResolveExpertEditSubmissionDispatchResult =
  | {
      status: "fallback_regenerate";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      referenceInputs: string[];
      options: ExpertEditRegenerateOptions;
    };

export const resolveExpertEditSubmissionDispatch = ({
  editSubmitIntent,
  hasSubmissionHandler,
  hasSelectedLayerMask,
  flattenedUrl,
  inpaintMaskUrl,
  flattenedDimensions,
  inpaintModelId,
  inpaintReferenceImageInput,
  referenceInputs,
  promptOverrideOptions,
  expertEditReferences,
}: {
  editSubmitIntent: EditSubmitIntent;
  hasSubmissionHandler: boolean;
  hasSelectedLayerMask: boolean;
  flattenedUrl: string | null;
  inpaintMaskUrl: string | null;
  flattenedDimensions?: { width: number; height: number } | null;
  inpaintModelId?: string | null;
  inpaintReferenceImageInput?: string | null;
  referenceInputs: string[];
  promptOverrideOptions?: ExpertEditCompiledPromptOverrides;
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
}): ResolveExpertEditSubmissionDispatchResult => {
  const normalizedEditSubmitIntent = normalizeEditSubmitIntent(editSubmitIntent);
  const isInpaintSubmitSelected = normalizedEditSubmitIntent === "inpaint";
  const isMarkupSubmitSelected = normalizedEditSubmitIntent === "markup";

  if (isInpaintSubmitSelected) {
    if (!hasSubmissionHandler) {
      return {
        status: "error",
        message: "Inpaint generate is unavailable in this session.",
      };
    }
    if (!hasSelectedLayerMask || !inpaintMaskUrl) {
      return {
        status: "error",
        message: "Mask selection is required for inpaint.",
      };
    }
    if (!flattenedUrl) {
      return {
        status: "error",
        message: "Unable to flatten layers.",
      };
    }
    return {
      status: "ready",
      referenceInputs,
      options: {
        inpaintOverride: {
          modelId: inpaintModelId ?? INPAINT_FLUX_FILL_MODEL_ID,
          baseImageInput: flattenedUrl,
          maskInput: inpaintMaskUrl,
          referenceImageInput: inpaintReferenceImageInput,
          outputFormat: "png",
          imageWidth: flattenedDimensions?.width ?? null,
          imageHeight: flattenedDimensions?.height ?? null,
        },
        referenceInputsMode: "replace",
        referenceInputsLimit: MAX_EXPERT_EDIT_SUBMISSION_REFERENCE_INPUTS,
        ...(expertEditReferences ? { expertEditReferences } : {}),
        ...(expertEditReferences?.restoreSecondarySlots
          ? {
              expertEditRestoreImageInputs: expertEditReferences.restoreSecondarySlots.map(
                (slot) => slot.sourceUrl
              ),
            }
          : {}),
        ...promptOverrideOptions,
      },
    };
  }

  if (!hasSubmissionHandler) {
    return {
      status: "fallback_regenerate",
    };
  }

  return {
    status: "ready",
    referenceInputs,
    options: {
      ...promptOverrideOptions,
      modelIdOverride:
        isMarkupSubmitSelected && isMarkupModelLockEnabled()
          ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID
          : undefined,
      referenceInputsMode: "replace",
      referenceInputsLimit: MAX_EXPERT_EDIT_SUBMISSION_REFERENCE_INPUTS,
      ...(expertEditReferences ? { expertEditReferences } : {}),
      ...(expertEditReferences?.restoreSecondarySlots
        ? {
            expertEditRestoreImageInputs: expertEditReferences.restoreSecondarySlots.map(
              (slot) => slot.sourceUrl
            ),
          }
        : {}),
    },
  };
};
