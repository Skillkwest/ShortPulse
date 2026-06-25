/**
 * Hook-level task submission contracts.
 * Keeps the submit orchestration file focused on lifecycle flow instead of wiring types.
 */
import type { Dispatch, SetStateAction } from "react";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import type { Provider } from "../../logic/stateParsers";
import type {
  LipSyncAudioState,
  StudioMode,
  StudioOutput,
  ToolId,
  VideoReferenceMode,
} from "../../types";
import type { NotifyGenerationFailure } from "../generationFailureReporting";
import type { AiStudioSubmitPanelKey } from "../useAiStudioCreationState";
import type {
  AiStudioTaskSubmitOptions,
  EnsureGenerationRecordInput,
} from "./taskSubmissionContracts";

export type AiStudioTaskSubmissionOptions = AiStudioTaskSubmitOptions & {
  submissionOwner?: AiStudioSubmitPanelKey;
};

export type UseAiStudioTaskSubmissionParams = {
  aspect: string;
  mode: StudioMode;
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  model: string | null;
  prompt: string;
  currentCostCredits?: number | null;
  promptReferenceGenerateCostCredits?: number | null;
  selectedTool: ToolId | null;
  imageResolution: string;
  videoDurationSeconds: number;
  videoResolution: string;
  videoGenerateAudio: boolean;
  videoReferenceMode: VideoReferenceMode;
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  lipSyncAudio?: LipSyncAudioState;
  lipSyncTurboMode?: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
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
  beginPanelGeneration: (panel: AiStudioSubmitPanelKey) => void;
  endPanelGeneration: (panel: AiStudioSubmitPanelKey) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  outputs?: StudioOutput[];
  setSaved: Dispatch<SetStateAction<boolean>>;
  getDefaultDurationSeconds: (modelId: string | null) => number;
  notifyGenerationFailure: NotifyGenerationFailure;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  startPollingTask: (
    taskId: string,
    outputId: string,
    attempt?: number,
    provider?: Provider,
    startedAt?: number,
    noMediaAttempt?: number,
    pollSessionId?: number,
    options?: { initialDelayMs?: number }
  ) => void;
  ensureGenerationRecord: (input: EnsureGenerationRecordInput) => Promise<string | null>;
  isOutputAbandoned?: (outputId: string) => boolean;
  markOutputSubmissionActive?: (outputId: string) => void;
};
