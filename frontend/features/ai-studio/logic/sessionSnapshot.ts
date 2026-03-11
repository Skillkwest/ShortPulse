/**
 * AI Studio session snapshot schema + serializer.
 * Builds durable write-shadow payloads while excluding transient/local-only fields.
 */
import type { AgentMessage, AgentMessageRole } from "../../../prefabs/agent/types";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputCharacterContext,
  StudioOutputStyleContext,
  StudioOutputMediaSource,
  StudioOutputPreviewTier,
  ToolId,
} from "../types";

export type AiStudioSessionSnapshotSchemaVersion = 1;

export type AiStudioSessionOutputV1 = {
  id: string;
  prompt: string;
  mode: StudioMode;
  aspect: string;
  model: string;
  modelId?: string;
  provider?: string;
  generationId?: string;
  promptId?: string;
  savedMediaIds?: string[];
  saveState?: "idle" | "saving" | "saved" | "failed";
  saveError?: string | null;
  status: "ready" | "saved";
  timestamp: string;
  taskId?: string;
  taskState?: "pending" | "running" | "success" | "fail";
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  resultUrls?: string[];
  previewUrl?: string;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewTier?: StudioOutputPreviewTier;
  mediaSource?: StudioOutputMediaSource;
  previewText?: string;
  pinned?: boolean;
  hiddenInReferenceGrid?: boolean;
  archivedAt?: string | null;
  archiveReason?: "soft_limit" | "manual" | "cleanup" | null;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  generationReplay?: GenerationReplayConfig;
};

export type AiStudioSessionAgentMessageV1 = {
  id: string | null;
  role: AgentMessageRole;
  content: string;
};

export type AiStudioSessionSnapshotV1 = {
  schemaVersion: AiStudioSessionSnapshotSchemaVersion;
  sessionId: string;
  updatedAt: string;
  workspace: {
    mode: StudioMode;
    selectedTool: ToolId | null;
    prompt: string;
    model: string | null;
    aspect: string;
    referenceImageUrl: string | null;
    extraImageUrls: [string | null, string | null, string | null];
    editReferenceText: string;
    videoReferenceText: string;
    videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
    videoDurationSeconds: number;
    videoResolution: string;
    imageResolution: string;
    videoGenerateAudio: boolean;
    videoCameraFixed: boolean;
    videoAutoFix: boolean;
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
    motionReferenceVideoUrl: string | null;
  };
  outputs: {
    active: AiStudioSessionOutputV1[];
    archived: AiStudioSessionOutputV1[];
    activeOutputId: string | null;
    curatedReferenceIds: string[];
    removedFromAllRefsIds: string[];
  };
  agent: {
    messages: AiStudioSessionAgentMessageV1[];
    input: string;
    latestAgentPrompt: string | null;
    promptOrigin: "manual" | "agent" | "reference";
    chatModeEnabled: boolean;
  };
};

export type BuildAiStudioSessionSnapshotInput = {
  sessionId: string;
  updatedAt?: string;
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  model: string | null;
  aspect: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
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
  motionReferenceVideoUrl: string | null;
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds: string[];
  removedFromAllRefsIds: string[];
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: "manual" | "agent" | "reference";
  chatModeEnabled: boolean;
};

const sanitizeMediaUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return undefined;
  return normalized;
};

const sanitizeOutput = (output: StudioOutput): AiStudioSessionOutputV1 => {
  const previewUrl = sanitizeMediaUrl(output.previewUrl);
  const resultUrls = (output.resultUrls ?? [])
    .map((url) => sanitizeMediaUrl(url))
    .filter((url): url is string => Boolean(url));

  return {
    id: output.id,
    prompt: output.prompt,
    mode: output.mode,
    aspect: output.aspect,
    model: output.model,
    modelId: output.modelId,
    provider: output.provider,
    generationId: output.generationId,
    promptId: output.promptId,
    savedMediaIds: output.savedMediaIds,
    saveState: output.saveState,
    saveError: output.saveError ?? null,
    status: output.status,
    timestamp: output.timestamp,
    taskId: output.taskId,
    taskState: output.taskState,
    errorMessage: output.errorMessage ?? null,
    errorMessageShort: output.errorMessageShort ?? null,
    resultUrls: resultUrls.length > 0 ? resultUrls : undefined,
    previewUrl,
    previewStoragePath: output.previewStoragePath ?? null,
    fullStoragePath: output.fullStoragePath ?? null,
    previewTier: output.previewTier,
    mediaSource: output.mediaSource,
    previewText: output.previewText,
    pinned: output.pinned,
    hiddenInReferenceGrid: output.hiddenInReferenceGrid,
    archivedAt: output.archivedAt ?? null,
    archiveReason: output.archiveReason ?? null,
    characterContext: output.characterContext,
    ...(output.styleContext ? { styleContext: output.styleContext } : {}),
    generationReplay: output.generationReplay,
  };
};

const sanitizeAgentMessage = (message: AgentMessage): AiStudioSessionAgentMessageV1 => ({
  id: message.id ?? null,
  role: message.role,
  content: message.content,
});

/**
 * Builds a schema-versioned AI Studio snapshot payload for local/remote persistence.
 */
export const buildAiStudioSessionSnapshot = (
  input: BuildAiStudioSessionSnapshotInput
): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1,
  sessionId: input.sessionId,
  updatedAt: input.updatedAt ?? new Date().toISOString(),
  workspace: {
    mode: input.mode,
    selectedTool: input.selectedTool,
    prompt: input.prompt,
    model: input.model,
    aspect: input.aspect,
    referenceImageUrl: input.referenceImageUrl,
    extraImageUrls: input.extraImageUrls,
    editReferenceText: input.editReferenceText,
    videoReferenceText: input.videoReferenceText,
    videoReferenceMode: input.videoReferenceMode,
    videoDurationSeconds: input.videoDurationSeconds,
    videoResolution: input.videoResolution,
    imageResolution: input.imageResolution,
    videoGenerateAudio: input.videoGenerateAudio,
    videoCameraFixed: input.videoCameraFixed,
    videoAutoFix: input.videoAutoFix,
    klingNegativePrompt: input.klingNegativePrompt,
    klingCfgScale: input.klingCfgScale,
    klingShotType: input.klingShotType,
    klingVoiceIds: input.klingVoiceIds,
    klingMultiPrompts: input.klingMultiPrompts,
    klingElements: input.klingElements,
    motionReferenceVideoUrl: input.motionReferenceVideoUrl,
  },
  outputs: {
    active: input.outputs.map(sanitizeOutput),
    archived: input.archivedOutputs.map(sanitizeOutput),
    activeOutputId: input.activeOutputId,
    curatedReferenceIds: input.curatedReferenceIds,
    removedFromAllRefsIds: input.removedFromAllRefsIds,
  },
  agent: {
    messages: input.agentMessages.map(sanitizeAgentMessage),
    input: input.agentInput,
    latestAgentPrompt: input.latestAgentPrompt,
    promptOrigin: input.promptOrigin,
    chatModeEnabled: input.chatModeEnabled,
  },
});
