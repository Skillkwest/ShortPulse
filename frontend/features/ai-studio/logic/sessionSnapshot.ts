/**
 * AI Studio session snapshot schema + serializer.
 * Builds durable workspace snapshot payloads while excluding transient/local-only fields.
 */
import type {
  AgentAttachment,
  AgentMessage,
  AgentMessageRole,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent/types";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutputCompanionArtStatus,
  StudioOutput,
  StudioOutputCharacterContext,
  StudioOutputMediaSource,
  StudioOutputPreviewTier,
  StudioOutputSaveState,
  StudioOutputSubmissionMode,
  StudioOutputStyleContext,
  ToolId,
  VideoReferenceMode,
} from "../types";
import type { AiStudioKlingElement } from "./klingElements";
import {
  serializeAiStudioSessionCanvasState,
  type AiStudioSessionCanvasSnapshotV1,
  type AiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";
import {
  serializeAiStudioSessionExpertEditState,
  type AiStudioSessionExpertEditSnapshotV1,
} from "./sessionSnapshotExpertEdit";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import {
  PULSE_CREATE_FORCED_CHAT_MODE_ENABLED,
  STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
} from "./chatModeDefaults";
import { createAiStudioProjectWorkspaceSnapshot as createProjectWorkspaceSnapshot } from "../../../lib/ai-studio-session/projectWorkspaceSnapshot";
import type { InternalMediaRef } from "../../../lib/media/internalMediaRefs";
import { projectAgentAttachmentToComposerImageAttachment } from "./composerImageAttachment";
import { resolveInternalMediaRefsForUrls } from "./referenceInputInternalMediaRegistry";
import { resolveVideoPosterStoragePath } from "./videoPosterStoragePaths";
import { isEphemeralLocalImageAttachment } from "./ephemeralComposerImage";
import { resolvePulseRuntimeState, type PulseWorkspaceState } from "./pulseSessionState";
import {
  createEmptyExpertEditSecondaryImageUrls,
  normalizeExpertEditSecondaryImageUrls,
} from "./expertEditReferenceSlots";
import {
  hasSettledSessionOutputPayload,
  shouldKeepSessionOutputForDurableRestore,
} from "./sessionOutputAuthority";

export const LATEST_AI_STUDIO_SESSION_SCHEMA_VERSION = 2;

const normalizeArchiveReason = (value: unknown): StudioOutput["archiveReason"] => {
  if (value === "manual" || value === "cleanup") return value;
  return null;
};

const canonicalizeDurableVideoReferenceMode = (value: VideoReferenceMode): VideoReferenceMode =>
  value === "keyframes" ? "standard" : value;

export type AiStudioSessionSnapshotSchemaVersion = 1 | 2;
export type AiStudioSessionExpertCreateMode = "standard" | "pulse";
export type AiStudioSessionCreateModeReferenceStateV1 = {
  selectedTool: ToolId | null;
  showCreateTools?: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  referenceImageInternalMediaRefs?: Array<InternalMediaRef | null>;
  motionReferenceVideoUrl: string | null;
  useReferenceImageIndicator?: boolean;
  detailOutputId?: string | null;
};
export type AiStudioSessionCreateModeReferenceStatesV1 = {
  standard: AiStudioSessionCreateModeReferenceStateV1;
  pulse: AiStudioSessionCreateModeReferenceStateV1;
};

export type AiStudioSessionOutputV1 = {
  id: string;
  prompt: string;
  transcriptText?: string | null;
  lyricsText?: string | null;
  mode: StudioMode;
  aspect: string;
  model: string;
  createdAt?: string | null;
  modelId?: string;
  provider?: string;
  sourceRef?: string;
  generationId?: string;
  promptId?: string;
  savedMediaIds?: string[];
  saveState?: StudioOutputSaveState;
  saveError?: string | null;
  status: "ready" | "saved";
  timestamp: string;
  taskId?: string;
  taskState?: "pending" | "running" | "success" | "fail";
  queueState?: "queued" | "dispatching" | "dispatched";
  queueEnqueuedAtMs?: number;
  generationTraceId?: string;
  submissionMode?: StudioOutputSubmissionMode;
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  audioSourceMode?: import("../types").StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
  resultUrls?: string[];
  previewUrl?: string;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
  companionArtStatus?: StudioOutputCompanionArtStatus | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewTier?: StudioOutputPreviewTier;
  width?: number | null;
  height?: number | null;
  mediaSource?: StudioOutputMediaSource;
  previewText?: string;
  pinned?: boolean;
  hiddenInReferenceGrid?: boolean;
  archivedAt?: string | null;
  archiveReason?: "manual" | "cleanup" | null;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  generationReplay?: GenerationReplayConfig;
};

export type AiStudioSessionAgentMessageV1 = {
  id: string | null;
  role: AgentMessageRole;
  content: string;
  outputPrompt?: string | null;
  canUseAsPrompt?: boolean;
  outcomeClass?: AgentMessage["outcomeClass"];
  reasonCode?: AgentMessage["reasonCode"];
  decision?: AgentMessage["decision"];
  attachments?: {
    id: string;
    kind: AgentAttachment["kind"];
    referenceId?: string | null;
    mediaId?: string | null;
    text?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    referenceUrl?: string | null;
    referenceRenderUrl?: string | null;
    imageUrl?: string | null;
    imageFallbackUrls?: string[];
    aspect?: string | null;
    deliveryStatus?: AgentAttachment["deliveryStatus"];
    deliveryError?: string | null;
  }[];
};

export type AiStudioSessionWorkspaceV1 = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  standardPrompt?: string;
  pulsePrompt?: string;
  model: string | null;
  aspect: string;
  selectedCharacterId?: string | null;
  selectedCharacterLookId?: string | null;
  expertCreateMode?: AiStudioSessionExpertCreateMode;
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  createModeReferenceStates?: AiStudioSessionCreateModeReferenceStatesV1;
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  referenceImageInternalMediaRefs?: Array<InternalMediaRef | null>;
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: VideoReferenceMode;
  lipSyncAudioUrl?: string | null;
  lipSyncAudioDurationMs?: number | null;
  lipSyncTurboMode?: boolean;
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
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
};

export type AiStudioSessionAgentRuntimesV2 = {
  standard: AiStudioSessionAgentV1;
  pulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
  pulse: AiStudioSessionAgentV1;
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
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
  pulseChats?: unknown;
  // Legacy compatibility extension for older canvas sessions. Canonical /ai-studio writes omit this.
  canvas?: AiStudioSessionCanvasSnapshotV1;
  expertEdit?: AiStudioSessionExpertEditSnapshotV1;
};

export type AiStudioSessionSnapshot = AiStudioSessionSnapshotV1 | AiStudioSessionSnapshotV2;
export type AiStudioProjectWorkspaceAutosaveCandidateKind =
  | "full"
  | "without_canvas"
  | "without_archived_outputs";

export type BuildAiStudioSessionSnapshotInput = {
  sessionId: string;
  updatedAt?: string;
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  standardCreatePrompt?: string;
  pulseCreatePrompt?: string;
  model: string | null;
  aspect: string;
  selectedCharacterId?: string | null;
  selectedCharacterLookId?: string | null;
  pulseWorkspaceState?: PulseWorkspaceState;
  expertCreateMode?: AiStudioSessionExpertCreateMode;
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  createModeReferenceStates?: AiStudioSessionCreateModeReferenceStatesV1;
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: VideoReferenceMode;
  lipSyncAudioUrl?: string | null;
  lipSyncAudioDurationMs?: number | null;
  lipSyncTurboMode?: boolean;
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
  agentMessages: Array<AgentMessage | AiStudioSessionAgentMessageV1>;
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: "manual" | "agent" | "reference";
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
  // Legacy compatibility input for optional canvas session serialization. Canonical /ai-studio writes omit this.
  canvasState?: AiStudioSessionCanvasState;
  expertEditSessionState?: ExpertEditSessionState | null;
};

const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;

const normalizeVideoStorageAuthority = ({
  mode,
  previewStoragePath,
  previewPosterStoragePath,
  fullStoragePath,
}: {
  mode: StudioMode;
  previewStoragePath: string | null;
  previewPosterStoragePath: string | null;
  fullStoragePath: string | null;
}) => {
  if (mode !== "video") {
    return {
      previewStoragePath,
      previewPosterStoragePath,
      fullStoragePath,
    };
  }
  const inferredPosterStoragePath = resolveVideoPosterStoragePath({
    previewPosterStoragePath,
    previewStoragePath,
    fullStoragePath,
  });
  const normalizedPreviewStoragePath =
    previewStoragePath && VIDEO_STORAGE_PATH_PATTERN.test(previewStoragePath)
      ? previewStoragePath
      : (fullStoragePath ?? previewStoragePath);
  return {
    previewStoragePath: normalizedPreviewStoragePath,
    previewPosterStoragePath: inferredPosterStoragePath,
    fullStoragePath,
  };
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

const sanitizeAttachmentIdentityValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const sanitizeAttachmentImageFallbackUrls = (
  values: string[] | null | undefined
): string[] | undefined => {
  if (!Array.isArray(values)) return undefined;
  const normalized = Array.from(
    new Set(
      values
        .map((value) => sanitizeMediaUrl(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizeSelectedCharacterId = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const sanitizeWorkspaceExtraImageUrls = (values: readonly (string | null)[]): (string | null)[] =>
  normalizeExpertEditSecondaryImageUrls(values).map((value) => sanitizeWorkspaceMediaUrl(value));

const sanitizeWorkspaceInternalMediaRefs = (
  primary: string | null,
  extras: readonly (string | null)[]
): Array<InternalMediaRef | null> => resolveInternalMediaRefsForUrls([primary, ...extras], 11);

const sanitizeCreateModeReferenceState = (
  value: AiStudioSessionCreateModeReferenceStateV1
): AiStudioSessionCreateModeReferenceStateV1 => ({
  selectedTool: value.selectedTool,
  showCreateTools: value.showCreateTools ?? false,
  referenceImageUrl: sanitizeWorkspaceMediaUrl(value.referenceImageUrl),
  extraImageUrls: sanitizeWorkspaceExtraImageUrls(value.extraImageUrls),
  referenceImageInternalMediaRefs: sanitizeWorkspaceInternalMediaRefs(
    value.referenceImageUrl,
    value.extraImageUrls
  ),
  motionReferenceVideoUrl: sanitizeWorkspaceMediaUrl(value.motionReferenceVideoUrl),
  useReferenceImageIndicator: value.useReferenceImageIndicator ?? false,
  detailOutputId: typeof value.detailOutputId === "string" ? value.detailOutputId : null,
});

const sanitizeAgentAttachments = (
  attachments: AgentMessage["attachments"]
): AiStudioSessionAgentMessageV1["attachments"] => {
  if (!attachments?.length) return undefined;
  const sanitized: NonNullable<AiStudioSessionAgentMessageV1["attachments"]> = [];
  attachments.forEach((attachment) => {
    if (isEphemeralLocalImageAttachment(attachment)) return;
    const id = attachment.id?.trim();
    if (!id) return;
    const projectedImageAttachment =
      attachment.kind === "image"
        ? projectAgentAttachmentToComposerImageAttachment(attachment)
        : null;
    sanitized.push({
      id,
      kind: attachment.kind,
      referenceId: attachment.referenceId ?? null,
      mediaId: sanitizeAttachmentIdentityValue(attachment.mediaId),
      text: attachment.text?.trim() || null,
      previewStoragePath: sanitizeAttachmentIdentityValue(attachment.previewStoragePath),
      fullStoragePath: sanitizeAttachmentIdentityValue(attachment.fullStoragePath),
      referenceUrl: sanitizeMediaUrl(attachment.referenceUrl) ?? null,
      referenceRenderUrl: sanitizeMediaUrl(attachment.referenceRenderUrl) ?? null,
      imageUrl:
        sanitizeMediaUrl(projectedImageAttachment?.preview.url ?? attachment.imageUrl) ?? null,
      imageFallbackUrls: sanitizeAttachmentImageFallbackUrls(
        projectedImageAttachment?.preview.candidates.slice(1) ?? attachment.imageFallbackUrls
      ),
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
        element.sourceKind === "character" ||
        element.sourceKind === "element" ||
        element.sourceKind === "reference-image"
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
  const normalizedStorageAuthority = normalizeVideoStorageAuthority({
    mode: output.mode,
    previewStoragePath: sanitizeAttachmentIdentityValue(output.previewStoragePath),
    previewPosterStoragePath: sanitizeAttachmentIdentityValue(output.previewPosterStoragePath),
    fullStoragePath: sanitizeAttachmentIdentityValue(output.fullStoragePath),
  });
  const previewPosterStoragePath = normalizedStorageAuthority.previewPosterStoragePath;
  const companionArtStoragePath = sanitizeAttachmentIdentityValue(output.companionArtStoragePath);
  const previewStoragePath = normalizedStorageAuthority.previewStoragePath;
  const fullStoragePath = normalizedStorageAuthority.fullStoragePath;
  const hasDurablePreviewAuthority = Boolean(previewStoragePath || fullStoragePath);
  const hasDurablePosterAuthority = Boolean(previewPosterStoragePath);
  const hasDurableCompanionArtAuthority = Boolean(companionArtStoragePath);
  const hasDurableResultAuthority = Boolean(fullStoragePath);
  const previewUrl = hasDurablePreviewAuthority ? undefined : sanitizeMediaUrl(output.previewUrl);
  const previewPosterUrl = hasDurablePosterAuthority
    ? undefined
    : sanitizeMediaUrl(output.previewPosterUrl);
  const companionArtUrl = hasDurableCompanionArtAuthority
    ? undefined
    : sanitizeMediaUrl(output.companionArtUrl);
  const resultUrls = (output.resultUrls ?? [])
    .map((url) => sanitizeMediaUrl(url))
    .filter((url): url is string => Boolean(url));
  const persistedResultUrls = hasDurableResultAuthority
    ? undefined
    : resultUrls.length > 0
      ? resultUrls
      : undefined;
  return {
    id: output.id,
    prompt: output.prompt,
    transcriptText: typeof output.transcriptText === "string" ? output.transcriptText : null,
    lyricsText: typeof output.lyricsText === "string" ? output.lyricsText : null,
    mode: output.mode,
    aspect: output.aspect,
    model: output.model,
    createdAt: output.createdAt ?? null,
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
    submissionMode: output.submissionMode,
    errorMessage: output.errorMessage ?? null,
    errorMessageShort: output.errorMessageShort ?? null,
    errorDetail: output.errorDetail ?? null,
    audioSourceMode: output.audioSourceMode ?? null,
    durationMs:
      typeof output.durationMs === "number" && Number.isFinite(output.durationMs)
        ? Math.max(0, Math.round(output.durationMs))
        : null,
    waveformPeaks:
      Array.isArray(output.waveformPeaks) && output.waveformPeaks.length > 0
        ? output.waveformPeaks.filter((value): value is number => typeof value === "number")
        : null,
    resultUrls: persistedResultUrls,
    previewUrl,
    previewPosterUrl,
    previewPosterStoragePath,
    companionArtUrl,
    companionArtStoragePath,
    companionArtStatus: output.companionArtStatus ?? null,
    previewStoragePath,
    fullStoragePath,
    previewTier: output.previewTier,
    width:
      typeof output.width === "number" && Number.isFinite(output.width) && output.width > 0
        ? Math.max(1, Math.round(output.width))
        : null,
    height:
      typeof output.height === "number" && Number.isFinite(output.height) && output.height > 0
        ? Math.max(1, Math.round(output.height))
        : null,
    mediaSource: output.mediaSource,
    previewText: output.previewText,
    pinned: output.pinned,
    hiddenInReferenceGrid: output.hiddenInReferenceGrid,
    archivedAt: output.archivedAt ?? null,
    archiveReason: normalizeArchiveReason(output.archiveReason),
    characterContext: output.characterContext,
    ...(output.styleContext ? { styleContext: output.styleContext } : {}),
    generationReplay: output.generationReplay,
  };
};

const shouldPersistOutputInSnapshot = (output: StudioOutput): boolean => {
  if (output.taskState === "fail" && output.mode === "audio") {
    if (!output.mediaSource || output.mediaSource === "generated") {
      return hasSettledSessionOutputPayload(output);
    }
  }
  return shouldKeepSessionOutputForDurableRestore(output);
};

const sanitizePulseWorkflowStatus = (
  value: AgentPulseWorkflowSession["status"] | null | undefined
): AgentPulseWorkflowSession["status"] => {
  return value === "idle" ||
    value === "running" ||
    value === "awaiting_input" ||
    value === "completed"
    ? value
    : "idle";
};

const sanitizePulseWorkflowSession = (
  session: AgentPulseWorkflowSession | null | undefined
): AgentPulseWorkflowSession | null => {
  if (!session) return null;
  const presetId = typeof session.presetId === "string" ? session.presetId.trim() : "";
  if (!presetId) return null;
  const currentStepIndex =
    typeof session.currentStepIndex === "number" && Number.isFinite(session.currentStepIndex)
      ? Math.max(1, Math.trunc(session.currentStepIndex))
      : null;
  const currentStepLabel =
    typeof session.currentStepLabel === "string" && session.currentStepLabel.trim().length > 0
      ? session.currentStepLabel.trim()
      : null;
  const currentStepPrompt =
    typeof session.currentStepPrompt === "string" && session.currentStepPrompt.trim().length > 0
      ? session.currentStepPrompt.trim()
      : null;
  const collectedInputs = Array.isArray(session.collectedInputs)
    ? session.collectedInputs
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];
  const lastArtifact =
    typeof session.lastArtifact === "string" && session.lastArtifact.trim().length > 0
      ? session.lastArtifact.trim()
      : null;
  const finalArtifactSource =
    session.finalArtifactSource === "apply_prompt" || session.finalArtifactSource === "chat_reply"
      ? session.finalArtifactSource
      : null;
  return {
    presetId,
    status: sanitizePulseWorkflowStatus(session.status),
    currentStepIndex,
    currentStepLabel,
    currentStepPrompt,
    collectedInputs,
    lastArtifact,
    finalArtifactSource,
  };
};

const sanitizeAgentRuntimeMessage = (
  message: AgentMessage | AiStudioSessionAgentMessageV1
): AiStudioSessionAgentMessageV1 => ({
  id: typeof message.id === "string" ? message.id : null,
  role: message.role,
  content: message.content,
  ...(typeof message.outputPrompt === "string" || message.outputPrompt === null
    ? { outputPrompt: message.outputPrompt }
    : {}),
  ...(typeof message.canUseAsPrompt === "boolean"
    ? { canUseAsPrompt: message.canUseAsPrompt }
    : {}),
  ...(message.outcomeClass ? { outcomeClass: message.outcomeClass } : {}),
  ...(message.reasonCode ? { reasonCode: message.reasonCode } : {}),
  ...(message.decision ? { decision: message.decision } : {}),
  ...(message.attachments
    ? {
        attachments: sanitizeAgentAttachments(message.attachments as AgentMessage["attachments"]),
      }
    : {}),
});

const sanitizeAgentRuntime = (runtime: {
  messages: Array<AgentMessage | AiStudioSessionAgentMessageV1>;
  input: string;
  latestAgentPrompt: string | null;
  promptOrigin: "manual" | "agent" | "reference";
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
}): AiStudioSessionAgentV1 => ({
  messages: runtime.messages.map(sanitizeAgentRuntimeMessage),
  input: runtime.input,
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: runtime.chatModeEnabled,
  pulseWorkflowSession: sanitizePulseWorkflowSession(runtime.pulseWorkflowSession),
});

const isPulseAgentRuntimeAuthorizedForPreset = (
  runtime: AiStudioSessionAgentV1,
  presetId: string | null,
  pulseSessionInstanceId: string | null,
  runtimePulseSessionInstanceId: string | null
): boolean => {
  if (
    !presetId ||
    !pulseSessionInstanceId ||
    runtimePulseSessionInstanceId !== pulseSessionInstanceId
  ) {
    return false;
  }
  const workflowPresetId = runtime.pulseWorkflowSession?.presetId ?? null;
  return workflowPresetId === null || workflowPresetId === presetId;
};

/**
 * Returns the canonical empty agent runtime payload.
 * Project workspace persistence uses this to strip conversation state while
 * keeping the shared snapshot envelope compatible with restore logic.
 */
export const createEmptyAiStudioSessionAgentState = (): AiStudioSessionAgentV1 => ({
  messages: [],
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
  pulseWorkflowSession: null,
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
  const persistedActiveOutputs = input.outputs.filter(shouldPersistOutputInSnapshot);
  const persistedArchivedOutputs = input.archivedOutputs.filter(shouldPersistOutputInSnapshot);
  const persistedOutputIds = new Set<string>([
    ...persistedActiveOutputs.map((output) => output.id),
    ...persistedArchivedOutputs.map((output) => output.id),
  ]);
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const resolvedPulseWorkspaceState = resolvePulseRuntimeState(
    input.pulseWorkspaceState ?? {
      expertCreateMode: input.expertCreateMode ?? "standard",
      activePulsePresetId: input.activePulsePresetId,
      pulseSessionInstanceId: input.pulseSessionInstanceId,
    }
  );
  const resolvedExpertCreateMode = resolvedPulseWorkspaceState.expertCreateMode;
  const {
    activePulsePresetId: resolvedActivePulsePresetId,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
  } = resolvedPulseWorkspaceState;
  const shouldPersistPulseWorkspaceState =
    resolvedExpertCreateMode === "pulse" || resolvedPulseSessionInstanceId !== null;
  const resolvedStandardCreatePrompt =
    input.standardCreatePrompt ?? (resolvedExpertCreateMode === "pulse" ? "" : input.prompt);
  const resolvedPulseCreatePrompt = shouldPersistPulseWorkspaceState
    ? (input.pulseCreatePrompt ?? (resolvedExpertCreateMode === "pulse" ? input.prompt : ""))
    : "";
  const persistedActivePulsePresetId = shouldPersistPulseWorkspaceState
    ? resolvedActivePulsePresetId
    : null;
  const persistedPulseSessionInstanceId = shouldPersistPulseWorkspaceState
    ? resolvedPulseSessionInstanceId
    : null;
  const persistedCreateModeReferenceStates = input.createModeReferenceStates
    ? {
        standard: sanitizeCreateModeReferenceState(input.createModeReferenceStates.standard),
        pulse: sanitizeCreateModeReferenceState(input.createModeReferenceStates.pulse),
      }
    : {
        standard: sanitizeCreateModeReferenceState({
          selectedTool: resolvedExpertCreateMode === "standard" ? input.selectedTool : "create",
          referenceImageUrl:
            resolvedExpertCreateMode === "standard" ? input.referenceImageUrl : null,
          extraImageUrls:
            resolvedExpertCreateMode === "standard"
              ? input.extraImageUrls
              : createEmptyExpertEditSecondaryImageUrls(),
          motionReferenceVideoUrl:
            resolvedExpertCreateMode === "standard" ? input.motionReferenceVideoUrl : null,
        }),
        pulse: sanitizeCreateModeReferenceState({
          selectedTool: resolvedExpertCreateMode === "pulse" ? input.selectedTool : "create",
          referenceImageUrl: resolvedExpertCreateMode === "pulse" ? input.referenceImageUrl : null,
          extraImageUrls:
            resolvedExpertCreateMode === "pulse"
              ? input.extraImageUrls
              : createEmptyExpertEditSecondaryImageUrls(),
          motionReferenceVideoUrl:
            resolvedExpertCreateMode === "pulse" ? input.motionReferenceVideoUrl : null,
        }),
      };
  const canvas = input.canvasState
    ? serializeAiStudioSessionCanvasState(input.canvasState)
    : undefined;
  const expertEdit = input.expertEditSessionState
    ? serializeAiStudioSessionExpertEditState(input.expertEditSessionState)
    : undefined;
  const activeAgentRuntime = sanitizeAgentRuntime({
    messages: input.agentMessages,
    input: input.agentInput,
    latestAgentPrompt: input.latestAgentPrompt,
    promptOrigin: input.promptOrigin,
    chatModeEnabled: input.chatModeEnabled,
    pulseWorkflowSession: input.pulseWorkflowSession,
  });
  const emptyAgentRuntime = createEmptyAiStudioSessionAgentState();
  const hasPulseWorkspaceAuthority =
    persistedActivePulsePresetId !== null && persistedPulseSessionInstanceId !== null;
  const resolveAuthorizedPulseAgentRuntime = (
    runtime: AiStudioSessionAgentV1
  ): AiStudioSessionAgentV1 =>
    isPulseAgentRuntimeAuthorizedForPreset(
      runtime,
      resolvedActivePulsePresetId,
      resolvedPulseSessionInstanceId,
      resolvedPulseSessionInstanceId
    )
      ? runtime
      : emptyAgentRuntime;
  const agentRuntimes = input.agentRuntimes
    ? (() => {
        const inputPulsePresetId = input.agentRuntimes.pulsePresetId?.trim() || null;
        const inputPulseSessionInstanceId =
          input.agentRuntimes.pulseSessionInstanceId?.trim() || null;
        const hasMatchingPulseRuntimeAuthority =
          hasPulseWorkspaceAuthority &&
          inputPulsePresetId === persistedActivePulsePresetId &&
          inputPulseSessionInstanceId === persistedPulseSessionInstanceId;
        return {
          standard: sanitizeAgentRuntime(input.agentRuntimes.standard),
          pulsePresetId: hasPulseWorkspaceAuthority ? persistedActivePulsePresetId : null,
          pulseSessionInstanceId: hasPulseWorkspaceAuthority
            ? persistedPulseSessionInstanceId
            : null,
          pulse: hasMatchingPulseRuntimeAuthority
            ? resolveAuthorizedPulseAgentRuntime(sanitizeAgentRuntime(input.agentRuntimes.pulse))
            : emptyAgentRuntime,
        };
      })()
    : {
        standard: resolvedExpertCreateMode === "pulse" ? emptyAgentRuntime : activeAgentRuntime,
        pulsePresetId: hasPulseWorkspaceAuthority ? persistedActivePulsePresetId : null,
        pulseSessionInstanceId: hasPulseWorkspaceAuthority ? persistedPulseSessionInstanceId : null,
        pulse:
          hasPulseWorkspaceAuthority && resolvedExpertCreateMode === "pulse"
            ? resolveAuthorizedPulseAgentRuntime(activeAgentRuntime)
            : emptyAgentRuntime,
      };

  const lipSyncAudioUrl = sanitizeWorkspaceMediaUrl(input.lipSyncAudioUrl);

  const basePayload = {
    schemaVersion: LATEST_AI_STUDIO_SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    updatedAt,
    workspace: {
      mode: input.mode,
      selectedTool: input.selectedTool,
      prompt: input.prompt,
      standardPrompt: resolvedStandardCreatePrompt,
      pulsePrompt: resolvedPulseCreatePrompt,
      model: input.model,
      aspect: input.aspect,
      selectedCharacterId: sanitizeSelectedCharacterId(input.selectedCharacterId),
      selectedCharacterLookId: sanitizeSelectedCharacterId(input.selectedCharacterLookId),
      expertCreateMode: resolvedExpertCreateMode,
      activePulsePresetId: persistedActivePulsePresetId,
      pulseSessionInstanceId: persistedPulseSessionInstanceId,
      createModeReferenceStates: persistedCreateModeReferenceStates,
      referenceImageUrl: sanitizeWorkspaceMediaUrl(input.referenceImageUrl),
      extraImageUrls: sanitizeWorkspaceExtraImageUrls(input.extraImageUrls),
      referenceImageInternalMediaRefs: sanitizeWorkspaceInternalMediaRefs(
        input.referenceImageUrl,
        input.extraImageUrls
      ),
      editReferenceText: input.editReferenceText,
      videoReferenceText: input.videoReferenceText,
      videoReferenceMode: canonicalizeDurableVideoReferenceMode(input.videoReferenceMode),
      lipSyncAudioUrl,
      lipSyncAudioDurationMs: lipSyncAudioUrl ? input.lipSyncAudioDurationMs : null,
      lipSyncTurboMode: input.lipSyncTurboMode,
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
      seedance2InputMode: input.seedance2InputMode ?? "multimodal",
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
      active: persistedActiveOutputs.map(sanitizeOutput),
      archived: persistedArchivedOutputs.map(sanitizeOutput),
      activeOutputId:
        input.activeOutputId && persistedOutputIds.has(input.activeOutputId)
          ? input.activeOutputId
          : null,
      curatedReferenceIds: input.curatedReferenceIds.filter((id) => persistedOutputIds.has(id)),
      removedFromAllRefsIds: input.removedFromAllRefsIds.filter((id) => persistedOutputIds.has(id)),
    },
    agent: emptyAgentRuntime,
    agentRuntimes,
    ...(canvas ? { canvas } : {}),
    ...(expertEdit ? { expertEdit } : {}),
  } as const;

  return {
    ...basePayload,
    meta: {
      generatedAt: updatedAt,
      checksum: computeChecksum(basePayload),
    },
  };
};

/**
 * Builds the canonical empty AI Studio snapshot used for explicit project/workspace resets.
 * Keeping this on the serializer path avoids drift between empty-state apply and persisted shape.
 */
export const createEmptyAiStudioSessionSnapshot = ({
  sessionId = "00000000-0000-0000-0000-000000000000",
  updatedAt,
}: {
  sessionId?: string;
  updatedAt?: string;
} = {}): AiStudioSessionSnapshotV2 =>
  buildAiStudioSessionSnapshot({
    sessionId,
    updatedAt,
    mode: "text",
    selectedTool: "create",
    prompt: "",
    standardCreatePrompt: "",
    pulseCreatePrompt: "",
    model: null,
    aspect: "9:16",
    selectedCharacterId: null,
    selectedCharacterLookId: null,
    expertCreateMode: "standard",
    activePulsePresetId: null,
    pulseSessionInstanceId: null,
    referenceImageUrl: null,
    extraImageUrls: createEmptyExpertEditSecondaryImageUrls(),
    editReferenceText: "",
    videoReferenceText: "",
    videoReferenceMode: "standard",
    lipSyncAudioUrl: null,
    lipSyncAudioDurationMs: null,
    lipSyncTurboMode: false,
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingWorkflowMode: "single",
    seedance2InputMode: "multimodal",
    seedance2ReferenceImageUrls: [],
    seedance2ReferenceVideoUrls: [],
    seedance2ReferenceAudioUrls: [],
    seedance2ReturnLastFrame: false,
    seedance2WebSearch: false,
    klingShotType: "customize",
    klingVoiceIds: ["", ""],
    klingMultiPrompts: [],
    klingElements: [],
    motionReferenceVideoUrl: null,
    outputs: [],
    archivedOutputs: [],
    activeOutputId: null,
    curatedReferenceIds: [],
    removedFromAllRefsIds: [],
    agentMessages: [],
    agentInput: "",
    latestAgentPrompt: null,
    promptOrigin: "manual",
    chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
    pulseWorkflowSession: null,
    agentRuntimes: {
      standard: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
        pulseWorkflowSession: null,
      },
      pulsePresetId: null,
      pulseSessionInstanceId: null,
      pulse: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: PULSE_CREATE_FORCED_CHAT_MODE_ENABLED,
        pulseWorkflowSession: null,
      },
    },
    canvasState: undefined,
    expertEditSessionState: null,
  });

/**
 * Strips conversational runtime state from a session snapshot so project-owned
 * workspace rows persist only authored workspace content, not chat history.
 */
export const createAiStudioProjectWorkspaceSnapshot = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshot => createProjectWorkspaceSnapshot(snapshot);

const rebuildV2SnapshotMeta = (
  snapshot: Omit<AiStudioSessionSnapshotV2, "meta"> & { updatedAt: string }
): AiStudioSessionSnapshotV2 => ({
  ...snapshot,
  meta: {
    generatedAt: snapshot.updatedAt,
    checksum: computeChecksum(snapshot),
  },
});

const stripArchivedOutputsFromSnapshot = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshot => {
  const nextOutputs = {
    ...snapshot.outputs,
    archived: [],
    removedFromAllRefsIds: [],
  };
  if (snapshot.schemaVersion === 1) {
    return {
      ...snapshot,
      outputs: nextOutputs,
    };
  }
  const { meta, ...baseSnapshot } = snapshot as AiStudioSessionSnapshotV2;
  void meta;
  return rebuildV2SnapshotMeta({
    ...(baseSnapshot as Omit<AiStudioSessionSnapshotV2, "meta">),
    outputs: nextOutputs,
  });
};

const stripCanvasFromSnapshot = (
  snapshot: AiStudioSessionSnapshotV2
): AiStudioSessionSnapshotV2 => {
  const { meta, canvas, ...baseSnapshot } = snapshot;
  void meta;
  void canvas;
  return rebuildV2SnapshotMeta(baseSnapshot);
};

export const createAiStudioProjectWorkspaceAutosaveCandidates = (
  snapshot: AiStudioSessionSnapshot
): Array<{
  kind: AiStudioProjectWorkspaceAutosaveCandidateKind;
  snapshot: AiStudioSessionSnapshot;
}> => {
  const candidates: Array<{
    kind: AiStudioProjectWorkspaceAutosaveCandidateKind;
    snapshot: AiStudioSessionSnapshot;
  }> = [{ kind: "full", snapshot }];
  if (snapshot.schemaVersion >= 2) {
    const v2Snapshot = snapshot as AiStudioSessionSnapshotV2;
    const withoutCanvas = stripCanvasFromSnapshot(v2Snapshot);
    candidates.push(
      { kind: "without_canvas", snapshot: withoutCanvas },
      { kind: "without_archived_outputs", snapshot: stripArchivedOutputsFromSnapshot(v2Snapshot) }
    );
  } else {
    candidates.push({
      kind: "without_archived_outputs",
      snapshot: stripArchivedOutputsFromSnapshot(snapshot),
    });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const candidateChecksum =
      candidate.snapshot.schemaVersion >= 2
        ? ((candidate.snapshot as AiStudioSessionSnapshotV2).meta?.checksum ?? null)
        : null;
    const dedupeKey = candidateChecksum
      ? `checksum:${candidateChecksum}`
      : `json:${JSON.stringify(candidate.snapshot)}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
};

/**
 * Applies workspace-field patches to a v2 snapshot and recomputes metadata checksum.
 */
export const patchAiStudioSessionSnapshotWorkspace = (
  snapshot: AiStudioSessionSnapshotV2,
  workspacePatch: Partial<AiStudioSessionWorkspaceV1>
): AiStudioSessionSnapshotV2 => {
  const { meta, ...baseSnapshot } = snapshot;
  void meta;
  const patchedSnapshot = {
    ...baseSnapshot,
    workspace: {
      ...baseSnapshot.workspace,
      ...workspacePatch,
    },
  };

  return {
    ...patchedSnapshot,
    meta: {
      generatedAt: snapshot.updatedAt,
      checksum: computeChecksum(patchedSnapshot),
    },
  };
};

/**
 * Applies output-field patches to a v2 snapshot and recomputes metadata checksum.
 */
export const patchAiStudioSessionSnapshotOutputs = (
  snapshot: AiStudioSessionSnapshotV2,
  outputsPatch: Partial<AiStudioSessionOutputsV1>
): AiStudioSessionSnapshotV2 => {
  const { meta, ...baseSnapshot } = snapshot;
  void meta;
  const patchedSnapshot = {
    ...baseSnapshot,
    outputs: {
      ...baseSnapshot.outputs,
      ...outputsPatch,
    },
  };

  return {
    ...patchedSnapshot,
    meta: {
      generatedAt: snapshot.updatedAt,
      checksum: computeChecksum(patchedSnapshot),
    },
  };
};

/**
 * Applies or removes page-owned canvas state on a v2 snapshot and recomputes metadata checksum.
 * This keeps page-level canvas ownership decoupled from the shared state hook while preserving
 * the canonical snapshot envelope used by project/session persistence.
 */
export const patchAiStudioSessionSnapshotCanvas = (
  snapshot: AiStudioSessionSnapshotV2,
  canvasState: AiStudioSessionCanvasState | null | undefined
): AiStudioSessionSnapshotV2 => {
  const { meta, ...baseSnapshot } = snapshot;
  void meta;

  const patchedSnapshot = {
    ...baseSnapshot,
    ...(canvasState ? { canvas: serializeAiStudioSessionCanvasState(canvasState) } : {}),
  };

  if (!canvasState && "canvas" in patchedSnapshot) {
    delete (patchedSnapshot as Partial<AiStudioSessionSnapshotV2>).canvas;
  }

  return {
    ...patchedSnapshot,
    meta: {
      generatedAt: snapshot.updatedAt,
      checksum: computeChecksum(patchedSnapshot),
    },
  };
};

/**
 * Applies or removes project-owned Pulse chat state on a v2 snapshot and recomputes metadata.
 * Project routes use this to persist the project-scoped `Chats` library without reviving
 * conversational auto-restore on project open.
 */
export const patchAiStudioSessionSnapshotPulseChats = (
  snapshot: AiStudioSessionSnapshotV2,
  pulseChats: unknown | null | undefined
): AiStudioSessionSnapshotV2 => {
  const { meta, ...baseSnapshot } = snapshot;
  void meta;

  const patchedSnapshot = {
    ...baseSnapshot,
    ...(pulseChats ? { pulseChats } : {}),
  };

  if (!pulseChats && "pulseChats" in patchedSnapshot) {
    delete (patchedSnapshot as Partial<AiStudioSessionSnapshotV2>).pulseChats;
  }

  return {
    ...patchedSnapshot,
    meta: {
      generatedAt: snapshot.updatedAt,
      checksum: computeChecksum(patchedSnapshot),
    },
  };
};

/**
 * Applies or removes durable Expert Edit state on a v2 snapshot and recomputes metadata checksum.
 * This lets project/session persistence patch the Edit document onto a cached base snapshot
 * without rebuilding the entire non-Edit workspace payload.
 */
export const patchAiStudioSessionSnapshotExpertEdit = (
  snapshot: AiStudioSessionSnapshotV2,
  expertEditSessionState: ExpertEditSessionState | null | undefined
): AiStudioSessionSnapshotV2 => {
  const { meta, ...baseSnapshot } = snapshot;
  void meta;

  const patchedSnapshot = {
    ...baseSnapshot,
    ...(expertEditSessionState
      ? {
          expertEdit: serializeAiStudioSessionExpertEditState(expertEditSessionState),
        }
      : {}),
  };

  if (!expertEditSessionState && "expertEdit" in patchedSnapshot) {
    delete (patchedSnapshot as Partial<AiStudioSessionSnapshotV2>).expertEdit;
  }

  return {
    ...patchedSnapshot,
    meta: {
      generatedAt: snapshot.updatedAt,
      checksum: computeChecksum(patchedSnapshot),
    },
  };
};
