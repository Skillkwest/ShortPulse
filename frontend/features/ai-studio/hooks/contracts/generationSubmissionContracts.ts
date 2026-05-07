import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { StudioMode, StudioOutput, ToolId } from "../../types";

export type ReferenceInputsMode = "merge" | "replace";

export type AiStudioGenerateSubmissionOverrides = {
  selectedToolOverride?: ToolId | null;
  submissionPromptOverride?: string | null;
  displayPromptOverride?: string | null;
  referenceInputsOverride?: string[];
  referenceInputsMode?: ReferenceInputsMode;
  characterContextOverride?: StudioOutput["characterContext"];
  styleContextOverride?: StudioOutput["styleContext"];
  outputIdOverride?: string;
  modelIdOverride?: string | null;
  inpaintOverride?: InpaintSubmissionOverride | null;
  hideOutputFromReferenceGrid?: boolean;
  suppressStyle?: boolean;
};

export type AiStudioGenerateOutputOptions = AiStudioGenerateSubmissionOverrides & {
  modeOverride?: StudioMode;
};
