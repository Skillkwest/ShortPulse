/**
 * Expert Edit submission-preparation helpers.
 * Centralizes prompt-token validation and reference-input planning before the edit submit path dispatches.
 */
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferencePlan,
  compileExpertEditSubmissionPrompt,
  type ExpertEditSubmissionReferencePlan,
  type ExpertEditPromptTokenAnalysisOptions,
} from "../../logic/expertEditPromptReferences";
import { MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT } from "../../logic/expertEditReferenceSlots";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import type { WorkflowReloadExpertEditReferences } from "../../types";
import type { ExpertEditCompiledPromptOverrides } from "./expertEditSubmissionContract";

export type ValidateExpertEditSubmissionPromptResult =
  | {
      status: "invalid_tokens";
      message: string;
    }
  | {
      status: "ready";
    };

export type PrepareExpertEditSubmissionResult =
  | {
      status: "invalid_tokens";
      message: string;
    }
  | {
      status: "ready";
      referenceInputs: string[];
      linkedSecondaryReferenceInputs: string[];
      workflowReloadExpertEditReferences?: WorkflowReloadExpertEditReferences;
      promptOverrideOptions?: ExpertEditCompiledPromptOverrides;
    };

type ResolveExpertEditSubmissionPromptStateResult =
  | {
      status: "invalid_tokens";
      message: string;
    }
  | {
      status: "ready";
      linkedSecondaryReferenceInputs: string[];
      resolvedSecondarySlotIndexes: number[];
      tokenAnalysisOptions: ExpertEditPromptTokenAnalysisOptions;
    };

const resolveSubmissionSecondarySlotIndexes = ({
  editSubmitIntent,
  linkedSecondarySlotIndexes,
}: {
  editSubmitIntent: EditSubmitIntent;
  linkedSecondarySlotIndexes: number[];
}): number[] => {
  if (linkedSecondarySlotIndexes.length > 0) {
    return linkedSecondarySlotIndexes;
  }
  if (editSubmitIntent === "inpaint") return linkedSecondarySlotIndexes;
  return [];
};

const resolveExpertEditSubmissionPromptState = ({
  promptText,
  extraImageUrls,
  editSubmitIntent = "standard",
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: readonly (string | null)[];
  editSubmitIntent?: EditSubmitIntent;
  allowSecondaryReferenceTokens?: boolean;
  maxSecondaryReferenceTokens?: number;
}): ResolveExpertEditSubmissionPromptStateResult => {
  const tokenAnalysisOptions: ExpertEditPromptTokenAnalysisOptions = {
    allowSecondaryTokens: allowSecondaryReferenceTokens,
    ...(typeof maxSecondaryReferenceTokens === "number"
      ? { maxSecondaryReferences: maxSecondaryReferenceTokens }
      : {}),
  };
  const tokenAnalysis = analyzeExpertEditPromptTokens(
    promptText,
    extraImageUrls,
    tokenAnalysisOptions
  );
  if (tokenAnalysis.hasInvalidTokens) {
    return {
      status: "invalid_tokens",
      message: tokenAnalysis.inlineError ?? "Use supported prompt references for this edit mode.",
    };
  }

  return {
    status: "ready",
    linkedSecondaryReferenceInputs: tokenAnalysis.referencedSlotIndexes
      .map((slotIndex) => extraImageUrls[slotIndex]?.trim() ?? "")
      .filter((value) => value.length > 0),
    resolvedSecondarySlotIndexes: resolveSubmissionSecondarySlotIndexes({
      editSubmitIntent,
      linkedSecondarySlotIndexes: tokenAnalysis.referencedSlotIndexes,
    }),
    tokenAnalysisOptions,
  };
};

const buildWorkflowReloadExpertEditReferences = (
  referencePlan: ExpertEditSubmissionReferencePlan
): WorkflowReloadExpertEditReferences | undefined => {
  const secondarySlots = Object.entries(referencePlan.secondaryReferenceInputIndexesBySlotIndex)
    .map(([slotIndexValue, referenceInputIndex]) => {
      const slotIndex = Number.parseInt(slotIndexValue, 10);
      if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
      if (
        typeof referenceInputIndex !== "number" ||
        !Number.isInteger(referenceInputIndex) ||
        referenceInputIndex < 0
      ) {
        return null;
      }
      return {
        slotIndex,
        referenceInputIndex,
      };
    })
    .filter((item): item is { slotIndex: number; referenceInputIndex: number } => Boolean(item))
    .sort((left, right) => left.slotIndex - right.slotIndex);

  if (secondarySlots.length === 0) return undefined;
  return {
    version: 1,
    maxSecondarySlotCount: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
    primaryReferenceInputIndex: referencePlan.primaryReferenceInputIndex,
    secondarySlots,
  };
};

export const validateExpertEditSubmissionPrompt = ({
  promptText,
  extraImageUrls,
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: readonly (string | null)[];
  allowSecondaryReferenceTokens?: boolean;
  maxSecondaryReferenceTokens?: number;
}): ValidateExpertEditSubmissionPromptResult => {
  const promptState = resolveExpertEditSubmissionPromptState({
    promptText,
    extraImageUrls,
    allowSecondaryReferenceTokens,
    maxSecondaryReferenceTokens,
  });
  return promptState.status === "invalid_tokens" ? promptState : { status: "ready" };
};

export const prepareExpertEditSubmission = ({
  promptText,
  extraImageUrls,
  flattenedPrimaryUrl,
  flattenedMarkupReferenceUrl,
  editSubmitIntent = "standard",
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: readonly (string | null)[];
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
  editSubmitIntent?: EditSubmitIntent;
  allowSecondaryReferenceTokens?: boolean;
  maxSecondaryReferenceTokens?: number;
}): PrepareExpertEditSubmissionResult => {
  const promptState = resolveExpertEditSubmissionPromptState({
    promptText,
    extraImageUrls,
    editSubmitIntent,
    allowSecondaryReferenceTokens,
    maxSecondaryReferenceTokens,
  });
  if (promptState.status === "invalid_tokens") {
    return promptState;
  }

  const referencePlan = buildExpertEditSubmissionReferencePlan({
    flattenedPrimaryUrl,
    flattenedMarkupReferenceUrl,
    secondarySlots: extraImageUrls,
    referencedSlotIndexes: promptState.resolvedSecondarySlotIndexes,
  });
  const referenceInputs = referencePlan.referenceInputs;
  const compiledPrompt = compileExpertEditSubmissionPrompt({
    displayPrompt: promptText,
    secondarySlots: extraImageUrls,
    referenceInputs,
    secondaryFigureNumbersBySlotIndex: referencePlan.secondaryFigureNumbersBySlotIndex,
    options: promptState.tokenAnalysisOptions,
  });
  const workflowReloadExpertEditReferences = buildWorkflowReloadExpertEditReferences(referencePlan);

  return {
    status: "ready",
    referenceInputs,
    linkedSecondaryReferenceInputs: promptState.linkedSecondaryReferenceInputs,
    ...(workflowReloadExpertEditReferences ? { workflowReloadExpertEditReferences } : {}),
    promptOverrideOptions: compiledPrompt.hasTokenReferences
      ? {
          displayPromptOverride: promptText,
          submissionPromptOverride: compiledPrompt.submissionPrompt,
        }
      : undefined,
  };
};
