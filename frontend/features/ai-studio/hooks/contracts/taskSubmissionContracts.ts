import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import type { Provider } from "../../logic/stateParsers";
import type {
  LipSyncAudioState,
  StudioMode,
  StudioOutput,
  ToolId,
  VideoReferenceMode,
  WorkflowReloadExpertEditReferences,
  WorkflowReloadVideoMediaSlot,
} from "../../types";

export type AiStudioTaskSubmitOptions = {
  modeOverride?: StudioMode;
  selectedToolOverride?: ToolId | null;
  displayPromptOverride?: string | null;
  displayedBilledCredits?: number | null;
  displayedPricingPolicyVersion?: number | null;
  displayedPricingVariantId?: string | null;
  internalMediaRefsOverride?: Array<InternalMediaRef | null>;
  characterContextOverride?: StudioOutput["characterContext"];
  styleContextOverride?: StudioOutput["styleContext"];
  outputIdOverride?: string;
  modelIdOverride?: string | null;
  aspectOverride?: string;
  imageResolutionOverride?: string;
  videoReferenceModeOverride?: VideoReferenceMode;
  videoReferenceImageUrlOverride?: string | null;
  videoDurationSecondsOverride?: number;
  videoResolutionOverride?: string;
  videoGenerateAudioOverride?: boolean;
  videoCameraFixedOverride?: boolean;
  videoAutoFixOverride?: boolean;
  motionReferenceVideoUrlOverride?: string | null;
  lipSyncAudioOverride?: LipSyncAudioState;
  lipSyncTurboModeOverride?: boolean;
  seedance2InputModeOverride?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrlsOverride?: string[];
  seedance2ReferenceVideoUrlsOverride?: string[];
  seedance2ReferenceVideoDurationsOverride?: WorkflowReloadVideoMediaSlot[];
  seedance2ReferenceAudioUrlsOverride?: string[];
  seedance2ReturnLastFrameOverride?: boolean;
  seedance2WebSearchOverride?: boolean;
  klingNegativePromptOverride?: string;
  klingCfgScaleOverride?: number;
  klingWorkflowModeOverride?: "single" | "multi" | "custom";
  klingShotTypeOverride?: "customize" | "intelligent";
  klingVoiceIdsOverride?: [string, string];
  klingMultiPromptsOverride?: { id: string; prompt: string; duration: number }[];
  klingElementsOverride?: AiStudioKlingElement[];
  inpaintOverride?: InpaintSubmissionOverride | null;
  hideOutputFromReferenceGrid?: boolean;
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
  expertEditRestoreImageInputs?: string[];
};

export type GenerationMetadata = Record<string, unknown>;

export type EnsureGenerationRecordInput = {
  outputId: string;
  provider: Provider;
  taskId?: string;
  durationSeconds?: number;
  resolution?: string | null;
  metadata?: GenerationMetadata;
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
