/**
 * Shared types for AI Studio task submission handlers.
 */
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
  startPollingWithGeneration: (taskId: string, provider: Provider, patch?: SubmissionPatch) => void;
};

export type VideoSubmissionArgs = BaseSubmissionArgs & {
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoAutoFix: boolean;
  videoCameraFixed: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: {
    id: string;
    frontalImageUrl: string;
    referenceImageUrls: string;
    videoUrl: string;
  }[];
};

export type ImageSubmissionArgs = BaseSubmissionArgs & {
  falReferencePayload: { image_url: string; image_urls: string[] } | Record<string, never>;
};

export type SubmissionHandlerRoute = "video" | "image" | "default";
