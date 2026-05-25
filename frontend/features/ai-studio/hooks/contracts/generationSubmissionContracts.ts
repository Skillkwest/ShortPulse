import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { StudioMode, StudioOutput, ToolId } from "../../types";

export type ReferenceInputsMode = "merge" | "replace";

export type AiStudioGenerateSubmissionOverrides = {
  selectedToolOverride?: ToolId | null;
  submissionPromptOverride?: string | null;
  displayPromptOverride?: string | null;
  displayedBilledCredits?: number | null;
  referenceInputsOverride?: string[];
  internalMediaRefsOverride?: Array<InternalMediaRef | null>;
  referenceInputsMode?: ReferenceInputsMode;
  characterContextOverride?: StudioOutput["characterContext"];
  styleContextOverride?: StudioOutput["styleContext"];
  outputIdOverride?: string;
  modelIdOverride?: string | null;
  inpaintOverride?: InpaintSubmissionOverride | null;
  hideOutputFromReferenceGrid?: boolean;
  suppressStyle?: boolean;
  suppressCharacter?: boolean;
  ignoreGenerationGuardrail?: boolean;
};

export type AiStudioGenerateOutputOptions = AiStudioGenerateSubmissionOverrides & {
  modeOverride?: StudioMode;
};
