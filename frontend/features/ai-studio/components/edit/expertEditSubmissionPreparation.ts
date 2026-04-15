import {
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferenceInputs,
  compileExpertEditSubmissionPrompt,
} from "../../logic/expertEditPromptReferences";

export type ExpertEditSubmissionPromptOverrideOptions = {
  displayPromptOverride: string;
  submissionPromptOverride: string;
};

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
      promptOverrideOptions?: ExpertEditSubmissionPromptOverrideOptions;
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
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
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

  const referenceInputs = buildExpertEditSubmissionReferenceInputs({
    flattenedPrimaryUrl,
    flattenedMarkupReferenceUrl,
    secondarySlots: extraImageUrls,
    referencedSlotIndexes: tokenAnalysis.referencedSlotIndexes,
  });
  const linkedSecondaryReferenceInputs = tokenAnalysis.referencedSlotIndexes
    .map((slotIndex) => extraImageUrls[slotIndex]?.trim() ?? "")
    .filter((value) => value.length > 0);
  const compiledPrompt = compileExpertEditSubmissionPrompt({
    displayPrompt: promptText,
    secondarySlots: extraImageUrls,
    referenceInputs,
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
