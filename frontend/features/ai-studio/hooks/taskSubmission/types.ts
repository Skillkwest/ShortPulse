/**
 * Shared types for AI Studio task submission handlers.
 */
import type { FalSubmitResponse } from "../../../../lib/falClient";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import { getModelConfig } from "../../logic/pricing";
import { Provider } from "../../logic/stateParsers";
import { StudioOutput } from "../../types";

export type SubmissionModelConfig = ReturnType<typeof getModelConfig>;

export type SubmissionPatch = Partial<StudioOutput>;

export type BaseSubmissionArgs = {
  id: string;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedDurationSeconds: number;
  requestedResolution?: string;
  requestedAudio: boolean;
  preparedImageInputs: string[];
  modelConfig: SubmissionModelConfig;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  generationReplay?: Record<string, unknown> | null;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  shortpulseContext?: Record<string, unknown>;
  startPollingWithGeneration: (
    taskId: string | undefined,
    provider: Provider,
    patch?: SubmissionPatch,
    submitResponse?: FalSubmitResponse
  ) => void;
};

export type VideoSubmissionArgs = BaseSubmissionArgs & {
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoAutoFix: boolean;
  videoCameraFixed: boolean;
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
};

export type ImageSubmissionArgs = BaseSubmissionArgs & {
  falReferencePayload: { image_url: string; image_urls: string[] } | Record<string, never>;
  inpaintOverride?: InpaintSubmissionOverride | null;
};

export type SubmissionHandlerRoute = "video" | "image" | "default";
