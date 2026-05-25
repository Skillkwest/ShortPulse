import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { StudioMode, StudioOutput, ToolId } from "../../types";

export type AiStudioTaskSubmitOptions = {
  modeOverride?: StudioMode;
  selectedToolOverride?: ToolId | null;
  displayPromptOverride?: string | null;
  displayedBilledCredits?: number | null;
  internalMediaRefsOverride?: Array<InternalMediaRef | null>;
  characterContextOverride?: StudioOutput["characterContext"];
  styleContextOverride?: StudioOutput["styleContext"];
  outputIdOverride?: string;
  modelIdOverride?: string | null;
  aspectOverride?: string;
  imageResolutionOverride?: string;
  inpaintOverride?: InpaintSubmissionOverride | null;
  hideOutputFromReferenceGrid?: boolean;
};

export type AiStudioImageRerollSubmitOptions = {
  modeOverride: "image";
  selectedToolOverride: ToolId | null;
  displayPromptOverride: string;
  internalMediaRefsOverride?: Array<InternalMediaRef | null>;
  characterContextOverride?: StudioOutput["characterContext"];
  modelIdOverride: string;
  aspectOverride: string;
  imageResolutionOverride: string;
  styleContextOverride?: StudioOutput["styleContext"];
};
