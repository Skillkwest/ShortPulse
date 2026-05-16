import {
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferencePlan,
  compileExpertEditSubmissionPrompt,
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
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls, {
    allowSecondaryTokens: allowSecondaryReferenceTokens,
    maxSecondaryReferences: maxSecondaryReferenceTokens,
  });
  if (tokenAnalysis.hasInvalidTokens) {
    return {
      status: "invalid_tokens",
      message: tokenAnalysis.inlineError ?? "Use supported prompt references for this edit mode.",
    };
  }

  return { status: "ready" };
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
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls, {
    allowSecondaryTokens: allowSecondaryReferenceTokens,
    maxSecondaryReferences: maxSecondaryReferenceTokens,
  });
  const validation = validateExpertEditSubmissionPrompt({
    promptText,
    extraImageUrls,
    allowSecondaryReferenceTokens,
    maxSecondaryReferenceTokens,
  });
  if (validation.status === "invalid_tokens") {
    return validation;
  }

  const resolvedSecondarySlotIndexes = resolveSubmissionSecondarySlotIndexes({
    editSubmitIntent,
    linkedSecondarySlotIndexes: tokenAnalysis.referencedSlotIndexes,
    extraImageUrls,
  });
  const referencePlan = buildExpertEditSubmissionReferencePlan({
    flattenedPrimaryUrl,
    flattenedMarkupReferenceUrl,
    secondarySlots: extraImageUrls,
    referencedSlotIndexes: resolvedSecondarySlotIndexes,
  });
  const referenceInputs = referencePlan.referenceInputs;
  const linkedSecondaryReferenceInputs = tokenAnalysis.referencedSlotIndexes
    .map((slotIndex) => extraImageUrls[slotIndex]?.trim() ?? "")
    .filter((value) => value.length > 0);
  const compiledPrompt = compileExpertEditSubmissionPrompt({
    displayPrompt: promptText,
    secondarySlots: extraImageUrls,
    referenceInputs,
    secondaryFigureNumbersBySlotIndex: referencePlan.secondaryFigureNumbersBySlotIndex,
    options: {
      allowSecondaryTokens: allowSecondaryReferenceTokens,
      maxSecondaryReferences: maxSecondaryReferenceTokens,
    },
  });

  return {
    status: "ready",
    referenceInputs,
    linkedSecondaryReferenceInputs,
    promptOverrideOptions: compiledPrompt.hasTokenReferences
      ? {
          displayPromptOverride: promptText,
          submissionPromptOverride: compiledPrompt.submissionPrompt,
        }
      : undefined,
  };
};
