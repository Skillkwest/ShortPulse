import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type {
  StudioMode,
  StudioOutput,
  ToolId,
  WorkflowReloadExpertEditReferences,
} from "../../types";

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
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
  expertEditRestoreImageInputs?: string[];
};

type AiStudioImageRerollForwardedOptions = Pick<
  AiStudioTaskSubmitOptions,
  | "selectedToolOverride"
  | "displayPromptOverride"
  | "internalMediaRefsOverride"
  | "characterContextOverride"
  | "styleContextOverride"
  | "modelIdOverride"
  | "aspectOverride"
  | "imageResolutionOverride"
>;

export type AiStudioImageRerollSubmitOptions = Omit<
  AiStudioImageRerollForwardedOptions,
  "displayPromptOverride" | "modelIdOverride" | "aspectOverride" | "imageResolutionOverride"
> & {
  modeOverride: "image";
  displayPromptOverride: string;
  modelIdOverride: string;
  aspectOverride: string;
  imageResolutionOverride: string;
};
