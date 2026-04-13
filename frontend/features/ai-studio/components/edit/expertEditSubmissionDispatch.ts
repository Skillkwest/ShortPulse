import {
  INPAINT_FLUX_FILL_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import type { ExpertEditPanelViewProps } from "./expertEditPanelViewContract";
import type { ExpertEditSubmissionPromptOverrideOptions } from "./expertEditSubmissionPreparation";

type RegenerateWithReferenceInputsHandler = NonNullable<
  ExpertEditPanelViewProps["onRegenerateWithReferenceInputs"]
>;

export type ExpertEditSubmitDispatchOptions = NonNullable<
  Parameters<RegenerateWithReferenceInputsHandler>[1]
>;

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
      options: ExpertEditSubmitDispatchOptions;
    };

export const resolveExpertEditSubmissionDispatch = ({
  editSubmitIntent,
  hasSubmissionHandler,
  hasSelectedLayerMask,
  flattenedUrl,
  inpaintMaskUrl,
  referenceInputs,
  promptOverrideOptions,
}: {
  editSubmitIntent: EditSubmitIntent;
  hasSubmissionHandler: boolean;
  hasSelectedLayerMask: boolean;
  flattenedUrl: string | null;
  inpaintMaskUrl: string | null;
  referenceInputs: string[];
  promptOverrideOptions?: ExpertEditSubmissionPromptOverrideOptions;
}): ResolveExpertEditSubmissionDispatchResult => {
  const isInpaintSubmitSelected = editSubmitIntent === "inpaint";
  const isMarkupSubmitSelected = editSubmitIntent === "markup";

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
          modelId: INPAINT_FLUX_FILL_MODEL_ID,
          baseImageInput: flattenedUrl,
          maskInput: inpaintMaskUrl,
          outputFormat: "png",
        },
        referenceInputsMode: "replace",
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
    },
  };
};
