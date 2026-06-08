/**
 * Pending output bootstrap helpers for generation submission.
 * Keeps placeholder creation and replay snapshot attachment out of the main submit hook.
 */
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import {
  buildGenerationReplayConfigV1,
  buildGenerationReplayConfigV2,
} from "../../logic/generationReplay";
import { buildWorkflowReloadConfigV1 } from "../../logic/workflowReload";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputSubmissionMode,
  ToolId,
  WorkflowReloadConfig,
  WorkflowReloadPanelKind,
} from "../../types";

type BuildPendingSubmissionOutputParams = {
  id: string;
  outputMode: StudioMode;
  prompt: string;
  aspect: string;
  modelLabel: string;
  modelId: string;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  submissionTraceId: string;
  sourceRef: string;
  submissionMode: StudioOutputSubmissionMode;
  hiddenInReferenceGrid?: boolean;
};

type BuildSubmissionReplaySnapshotParams = {
  mode: StudioMode;
  submitTool: ToolId | null;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  referenceInputs: string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
};

type BuildSubmissionWorkflowReloadSnapshotParams = {
  outputMode: StudioMode;
  originTool: ToolId | null;
  panelKind: WorkflowReloadPanelKind;
  projectId?: string | null;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  referenceInputs: string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  durationSeconds: number | null;
  resolution?: string | null;
  generateAudio?: boolean | null;
  cameraFixed?: boolean | null;
  autoFix?: boolean | null;
  motionReferenceVideoUrl?: string | null;
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingNegativePrompt?: string | null;
  klingCfgScale?: number | null;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingShotType?: "customize" | "intelligent";
  klingVoiceIds?: [string, string];
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  klingElements?: Array<Record<string, unknown>>;
};

export const buildPendingSubmissionOutput = ({
  id,
  outputMode,
  prompt,
  aspect,
  modelLabel,
  modelId,
  characterContext,
  styleContext,
  submissionTraceId,
  sourceRef,
  submissionMode,
  hiddenInReferenceGrid,
}: BuildPendingSubmissionOutputParams): StudioOutput => ({
  mode: outputMode,
  id,
  prompt,
  aspect,
  model: modelLabel,
  createdAt: new Date().toISOString(),
  modelId,
  status: "ready",
  taskState: "pending",
  timestamp: "Submitting...",
  errorMessage: null,
  errorMessageShort: null,
  errorDetail: null,
  mediaSource: "generated",
  previewTier: outputMode === "video" ? "preview_loop" : "full",
  archivedAt: null,
  archiveReason: null,
  saveState: "idle",
  saveError: null,
  characterContext,
  submissionTraceId,
  sourceRef,
  submissionMode,
  ...(styleContext ? { styleContext } : {}),
  ...(hiddenInReferenceGrid ? { hiddenInReferenceGrid: true } : {}),
});

export const resolveSubmissionModeForModelId = (
  modelId: string | null | undefined
): StudioOutputSubmissionMode =>
  modelId === OPENAI_GPT_IMAGE_2_MODEL_ID ? "direct-request" : "provider-task";

export const reconcilePendingSubmissionOutput = (
  prev: StudioOutput[],
  nextOutput: StudioOutput
): StudioOutput[] => {
  const existingIndex = prev.findIndex((item) => item.id === nextOutput.id);
  if (existingIndex === -1) return [nextOutput, ...prev];
  return prev.map((item) => (item.id === nextOutput.id ? { ...item, ...nextOutput } : item));
};

export const buildSubmissionReplaySnapshot = ({
  mode,
  submitTool,
  modelId,
  displayPrompt,
  submissionPrompt,
  aspect,
  imageResolution,
  referenceInputs,
  internalMediaRefs = [],
  characterContext,
  styleContext,
}: BuildSubmissionReplaySnapshotParams) => {
  const hasUsableInternalMediaRefs = internalMediaRefs.some((ref) => Boolean(ref));
  if (!hasUsableInternalMediaRefs) {
    return buildGenerationReplayConfigV1({
      mode,
      submitTool,
      modelId,
      displayPrompt,
      submissionPrompt,
      aspect,
      imageResolution,
      referenceInputs,
      characterContext,
      styleContext,
    });
  }
  return buildGenerationReplayConfigV2({
    mode,
    submitTool,
    modelId,
    displayPrompt,
    submissionPrompt,
    aspect,
    imageResolution,
    referenceInputs,
    internalMediaRefs,
    characterContext,
    styleContext,
  });
};

export const buildSubmissionWorkflowReloadSnapshot = ({
  outputMode,
  originTool,
  panelKind,
  projectId,
  modelId,
  displayPrompt,
  submissionPrompt,
  aspect,
  imageResolution,
  referenceInputs,
  internalMediaRefs = [],
  characterContext,
  styleContext,
  videoReferenceMode,
  durationSeconds,
  resolution = null,
  generateAudio = null,
  cameraFixed = null,
  autoFix = null,
  motionReferenceVideoUrl = null,
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  seedance2ReturnLastFrame = false,
  seedance2WebSearch = false,
  klingNegativePrompt = null,
  klingCfgScale = null,
  klingWorkflowMode,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts = [],
  klingElements = [],
}: BuildSubmissionWorkflowReloadSnapshotParams): WorkflowReloadConfig | null => {
  if (outputMode === "image") {
    const submitTool =
      originTool === "create" || originTool === "image" || originTool === "edit"
        ? originTool
        : null;
    if (!submitTool) return null;
    return buildWorkflowReloadConfigV1({
      originTool,
      panelKind,
      outputMode,
      projectId,
      prompt: {
        display: displayPrompt,
        submission: submissionPrompt,
      },
      model: {
        id: modelId,
      },
      payload: {
        kind: "image",
        submitTool,
        aspect,
        imageResolution,
        referenceInputs,
        internalMediaRefs,
        characterContext,
        styleContext,
      },
    });
  }
  if (outputMode !== "video") return null;
  return buildWorkflowReloadConfigV1({
    originTool,
    panelKind,
    outputMode,
    projectId,
    prompt: {
      display: displayPrompt,
      submission: submissionPrompt,
    },
    model: {
      id: modelId,
    },
    payload: {
      kind: "video",
      aspect,
      videoReferenceMode,
      durationSeconds,
      resolution,
      generateAudio,
      cameraFixed,
      autoFix,
      referenceInputs,
      internalMediaRefs,
      motionReferenceVideoUrl,
      seedance2InputMode,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingNegativePrompt,
      klingCfgScale,
      klingWorkflowMode,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
    },
  });
};

export const attachGenerationReplayToOutput = ({
  id,
  generationReplay,
  updateOutputById,
}: {
  id: string;
  generationReplay: GenerationReplayConfig;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}) => {
  updateOutputById(id, (item) => ({
    ...item,
    generationReplay,
  }));
};

export const attachWorkflowReloadToOutput = ({
  id,
  workflowReload,
  updateOutputById,
}: {
  id: string;
  workflowReload: WorkflowReloadConfig;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}) => {
  updateOutputById(id, (item) => ({
    ...item,
    workflowReload,
  }));
};
