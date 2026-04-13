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
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
}): ValidateExpertEditSubmissionPromptResult => {
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls);
  if (tokenAnalysis.hasInvalidTokens) {
    return {
      status: "invalid_tokens",
      message:
        tokenAnalysis.inlineError ?? "Use @main, @img1, @img2, or @img3 with populated references.",
    };
  }

  return { status: "ready" };
};

export const prepareExpertEditSubmission = ({
  promptText,
  extraImageUrls,
  flattenedPrimaryUrl,
  flattenedMarkupReferenceUrl,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
}): PrepareExpertEditSubmissionResult => {
  const tokenAnalysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls);
  const validation = validateExpertEditSubmissionPrompt({
    promptText,
    extraImageUrls,
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
