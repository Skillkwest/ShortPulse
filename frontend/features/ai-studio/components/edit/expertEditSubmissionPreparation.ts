/**
 * Expert Edit submission-preparation helpers.
 * Centralizes prompt-token validation and reference-input planning before the edit submit path dispatches.
 */
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferencePlan,
  compileExpertEditSubmissionPrompt,
  type ExpertEditPromptTokenAnalysisOptions,
} from "../../logic/expertEditPromptReferences";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
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

const resolvePopulatedSecondarySlotIndexes = (
  extraImageUrls: [string | null, string | null, string | null]
): number[] =>
  extraImageUrls.reduce<number[]>((indexes, value, index) => {
    if ((value?.trim() ?? "").length > 0) {
      indexes.push(index);
    }
    return indexes;
  }, []);

const resolveSubmissionSecondarySlotIndexes = ({
  editSubmitIntent,
  linkedSecondarySlotIndexes,
  extraImageUrls,
}: {
  editSubmitIntent: EditSubmitIntent;
  linkedSecondarySlotIndexes: number[];
  extraImageUrls: [string | null, string | null, string | null];
}): number[] => {
  if (linkedSecondarySlotIndexes.length > 0) {
    return linkedSecondarySlotIndexes;
  }
  if (editSubmitIntent === "inpaint") {
    return linkedSecondarySlotIndexes;
  }
  return resolvePopulatedSecondarySlotIndexes(extraImageUrls);
};

const resolveExpertEditSubmissionPromptState = ({
  promptText,
  extraImageUrls,
  editSubmitIntent = "standard",
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
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
      extraImageUrls,
    }),
    tokenAnalysisOptions,
  };
};

export const validateExpertEditSubmissionPrompt = ({
  promptText,
  extraImageUrls,
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
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
  extraImageUrls: [string | null, string | null, string | null];
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

  return {
    status: "ready",
    referenceInputs,
    linkedSecondaryReferenceInputs: promptState.linkedSecondaryReferenceInputs,
    promptOverrideOptions: compiledPrompt.hasTokenReferences
      ? {
          displayPromptOverride: promptText,
          submissionPromptOverride: compiledPrompt.submissionPrompt,
        }
      : undefined,
  };
};
