/**
 * AI Studio session snapshot schema + serializer.
 * Builds durable write-shadow payloads while excluding transient/local-only fields.
 */
import type { AgentAttachment, AgentMessage, AgentMessageRole } from "../../../prefabs/agent/types";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputCharacterContext,
  StudioOutputMediaSource,
  StudioOutputPreviewTier,
  StudioOutputStyleContext,
  ToolId,
} from "../types";
import type { AiStudioKlingElement } from "./klingElements";
import {
  serializeAiStudioSessionCanvasState,
  type AiStudioSessionCanvasSnapshotV1,
  type AiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";

export const LATEST_AI_STUDIO_SESSION_SCHEMA_VERSION = 2;

export type AiStudioSessionSnapshotSchemaVersion = 1 | 2;

export type AiStudioSessionOutputV1 = {
  id: string;
  prompt: string;
  mode: StudioMode;
  aspect: string;
  model: string;
  modelId?: string;
  provider?: string;
  sourceRef?: string;
  generationId?: string;
  promptId?: string;
  savedMediaIds?: string[];
  saveState?: "idle" | "saving" | "saved" | "failed";
  saveError?: string | null;
  status: "ready" | "saved";
  timestamp: string;
  taskId?: string;
  taskState?: "pending" | "running" | "success" | "fail";
  queueState?: "queued" | "dispatching" | "dispatched";
  queueEnqueuedAtMs?: number;
  generationTraceId?: string;
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
  attachments?: {
    id: string;
    kind: AgentAttachment["kind"];
    referenceId?: string | null;
    text?: string | null;
    imageUrl?: string | null;
    aspect?: string | null;
    deliveryStatus?: AgentAttachment["deliveryStatus"];
    deliveryError?: string | null;
  }[];
};

export type AiStudioSessionWorkspaceV1 = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  model: string | null;
  aspect: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  motionReferenceVideoUrl: string | null;
};

export type AiStudioSessionOutputsV1 = {
  active: AiStudioSessionOutputV1[];
  archived: AiStudioSessionOutputV1[];
  activeOutputId: string | null;
  curatedReferenceIds: string[];
  removedFromAllRefsIds: string[];
};

export type AiStudioSessionAgentV1 = {
  messages: AiStudioSessionAgentMessageV1[];
  input: string;
  latestAgentPrompt: string | null;
  promptOrigin: "manual" | "agent" | "reference";
  chatModeEnabled: boolean;
};

export type AiStudioSessionSnapshotV1 = {
  schemaVersion: 1;
  sessionId: string;
  updatedAt: string;
  workspace: AiStudioSessionWorkspaceV1;
  outputs: AiStudioSessionOutputsV1;
  agent: AiStudioSessionAgentV1;
};

export type AiStudioSessionSnapshotMetaV2 = {
  generatedAt: string;
  checksum: string;
};

export type AiStudioSessionSnapshotV2 = {
  schemaVersion: 2;
  sessionId: string;
  updatedAt: string;
  meta: AiStudioSessionSnapshotMetaV2;
  workspace: AiStudioSessionWorkspaceV1;
  outputs: AiStudioSessionOutputsV1;
  agent: AiStudioSessionAgentV1;
  canvas: AiStudioSessionCanvasSnapshotV1;
};

export type AiStudioSessionSnapshot = AiStudioSessionSnapshotV1 | AiStudioSessionSnapshotV2;

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
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
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
  canvasState: AiStudioSessionCanvasState;
};

const sanitizeMediaUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return undefined;
  return normalized;
};

const sanitizeWorkspaceMediaUrl = (value: string | null | undefined): string | null =>
  sanitizeMediaUrl(value) ?? null;

const sanitizeWorkspaceExtraImageUrls = (
  values: [string | null, string | null, string | null]
): [string | null, string | null, string | null] => [
  sanitizeWorkspaceMediaUrl(values[0]),
  sanitizeWorkspaceMediaUrl(values[1]),
  sanitizeWorkspaceMediaUrl(values[2]),
];

const sanitizeAgentAttachments = (
  attachments: AgentMessage["attachments"]
): AiStudioSessionAgentMessageV1["attachments"] => {
  if (!attachments?.length) return undefined;
  const sanitized: NonNullable<AiStudioSessionAgentMessageV1["attachments"]> = [];
  attachments.forEach((attachment) => {
    const id = attachment.id?.trim();
    if (!id) return;
    sanitized.push({
      id,
      kind: attachment.kind,
      referenceId: attachment.referenceId ?? null,
      text: attachment.text?.trim() || null,
      imageUrl: sanitizeMediaUrl(attachment.imageUrl) ?? null,
      aspect: attachment.aspect?.trim() || null,
      deliveryStatus: attachment.deliveryStatus,
      deliveryError: attachment.deliveryError?.trim() || null,
    });
  });
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeWorkspaceKlingProfileImageTransform = (
  value: AiStudioKlingElement["profileImageTransform"]
): AiStudioKlingElement["profileImageTransform"] => {
  if (!value || typeof value !== "object") return null;
  const zoom = typeof value.zoom === "number" && Number.isFinite(value.zoom) ? value.zoom : null;
  const offsetX =
    typeof value.offsetX === "number" && Number.isFinite(value.offsetX) ? value.offsetX : null;
  const offsetY =
    typeof value.offsetY === "number" && Number.isFinite(value.offsetY) ? value.offsetY : null;
  if (zoom === null || offsetX === null || offsetY === null) return null;
  return { zoom, offsetX, offsetY };
};

const sanitizeWorkspaceKlingElements = (elements: AiStudioKlingElement[]) =>
  elements.map((element) => {
    const sanitizedReferenceImageUrls = element.referenceImageUrls
      .split(/[,\n]+/)
      .map((value) => sanitizeMediaUrl(value))
      .filter((value): value is string => Boolean(value))
      .join(", ");
    return {
      ...element,
      slotIndex:
        typeof element.slotIndex === "number" && Number.isFinite(element.slotIndex)
          ? Math.max(0, Math.trunc(element.slotIndex))
          : undefined,
      sourceKind:
        element.sourceKind === "character" || element.sourceKind === "element"
          ? element.sourceKind
          : null,
      sourceElementId:
        typeof element.sourceElementId === "string" || element.sourceElementId === null
          ? (element.sourceElementId ?? null)
          : null,
      sourceCharacterId:
        typeof element.sourceCharacterId === "string" || element.sourceCharacterId === null
          ? (element.sourceCharacterId ?? null)
          : null,
      name: element.name?.trim() ?? "",
      alias: element.alias?.trim() ?? "",
      description: element.description?.trim() ?? "",
      profileImageUrl: sanitizeWorkspaceMediaUrl(element.profileImageUrl) ?? null,
      profileImageTransform: sanitizeWorkspaceKlingProfileImageTransform(
        element.profileImageTransform
      ),
      frontalImageUrl: sanitizeMediaUrl(element.frontalImageUrl) ?? "",
      referenceImageUrls: sanitizedReferenceImageUrls,
      videoUrl: sanitizeMediaUrl(element.videoUrl) ?? "",
    };
  });

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
    sourceRef: output.sourceRef,
    generationId: output.generationId,
    promptId: output.promptId,
    savedMediaIds: output.savedMediaIds,
    saveState: output.saveState,
    saveError: output.saveError ?? null,
    status: output.status,
    timestamp: output.timestamp,
    taskId: output.taskId,
    taskState: output.taskState,
    queueState: output.queueState,
    queueEnqueuedAtMs: output.queueEnqueuedAtMs,
    generationTraceId: output.generationTraceId,
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
  attachments: sanitizeAgentAttachments(message.attachments),
});

const computeChecksum = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(16).padStart(8, "0");
  return `fnv1a32:${normalized}`;
};

/**
 * Builds a schema-versioned AI Studio snapshot payload for local/remote persistence.
 */
export const buildAiStudioSessionSnapshot = (
  input: BuildAiStudioSessionSnapshotInput
): AiStudioSessionSnapshotV2 => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const canvas = serializeAiStudioSessionCanvasState(input.canvasState);

  const basePayload = {
    schemaVersion: LATEST_AI_STUDIO_SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    updatedAt,
    workspace: {
      mode: input.mode,
      selectedTool: input.selectedTool,
      prompt: input.prompt,
      model: input.model,
      aspect: input.aspect,
      referenceImageUrl: sanitizeWorkspaceMediaUrl(input.referenceImageUrl),
      extraImageUrls: sanitizeWorkspaceExtraImageUrls(input.extraImageUrls),
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
      klingWorkflowMode:
        input.klingWorkflowMode ?? (input.klingMultiPrompts.length > 0 ? "custom" : "single"),
      seedance2InputMode: input.seedance2InputMode ?? "text",
      seedance2ReferenceImageUrls: input.seedance2ReferenceImageUrls ?? [],
      seedance2ReferenceVideoUrls: input.seedance2ReferenceVideoUrls ?? [],
      seedance2ReferenceAudioUrls: input.seedance2ReferenceAudioUrls ?? [],
      seedance2ReturnLastFrame: input.seedance2ReturnLastFrame ?? false,
      seedance2WebSearch: input.seedance2WebSearch ?? false,
      klingShotType: input.klingShotType,
      klingVoiceIds: input.klingVoiceIds,
      klingMultiPrompts: input.klingMultiPrompts,
      klingElements: sanitizeWorkspaceKlingElements(input.klingElements),
      motionReferenceVideoUrl: sanitizeWorkspaceMediaUrl(input.motionReferenceVideoUrl),
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
    canvas,
  } as const;

  return {
    ...basePayload,
    meta: {
      generatedAt: updatedAt,
      checksum: computeChecksum(basePayload),
    },
  };
};
