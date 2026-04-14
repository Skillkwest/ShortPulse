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
      promptOverrideOptions?: ExpertEditSubmissionPromptOverrideOptions;
    };

export const validateExpertEditSubmissionPrompt = ({
  promptText,
  extraImageUrls,
  allowSecondaryReferenceTokens = true,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  allowSecondaryReferenceTokens?: boolean;
}): ValidateExpertEditSubmissionPromptResult => {
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls, {
    allowSecondaryTokens: allowSecondaryReferenceTokens,
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
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
  allowSecondaryReferenceTokens?: boolean;
}): PrepareExpertEditSubmissionResult => {
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls, {
    allowSecondaryTokens: allowSecondaryReferenceTokens,
  });
  const validation = validateExpertEditSubmissionPrompt({
    promptText,
    extraImageUrls,
    allowSecondaryReferenceTokens,
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
  const compiledPrompt = compileExpertEditSubmissionPrompt({
    displayPrompt: promptText,
    secondarySlots: extraImageUrls,
    referenceInputs,
    options: {
      allowSecondaryTokens: allowSecondaryReferenceTokens,
    },
  });

  return {
    status: "ready",
    referenceInputs,
    promptOverrideOptions: compiledPrompt.hasTokenReferences
      ? {
          displayPromptOverride: promptText,
          submissionPromptOverride: compiledPrompt.submissionPrompt,
        }
      : undefined,
  };
};
