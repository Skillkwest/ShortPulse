import type { StudioMode } from "../../types";
import type { AiStudioTaskSubmitOptions } from "./taskSubmissionContracts";

export type ReferenceInputsMode = "merge" | "replace";

type AiStudioForwardedGenerateSubmitOptions = Pick<
  AiStudioTaskSubmitOptions,
  | "selectedToolOverride"
  | "displayPromptOverride"
  | "displayedBilledCredits"
  | "internalMediaRefsOverride"
  | "characterContextOverride"
  | "styleContextOverride"
  | "outputIdOverride"
  | "modelIdOverride"
  | "inpaintOverride"
  | "hideOutputFromReferenceGrid"
>;

export type AiStudioGenerateSubmissionOverrides = AiStudioForwardedGenerateSubmitOptions & {
  submissionPromptOverride?: string | null;
  referenceInputsOverride?: string[];
  referenceInputsMode?: ReferenceInputsMode;
  suppressStyle?: boolean;
  suppressCharacter?: boolean;
  ignoreGenerationGuardrail?: boolean;
};

export type AiStudioGenerateOutputOptions = AiStudioGenerateSubmissionOverrides & {
  modeOverride?: StudioMode;
};
