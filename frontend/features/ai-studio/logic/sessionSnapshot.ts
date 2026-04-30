/**
 * AI Studio session snapshot schema + serializer.
 * Builds durable write-shadow payloads while excluding transient/local-only fields.
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
import {
  serializeAiStudioSessionExpertEditState,
  type AiStudioSessionExpertEditSnapshotV1,
} from "./sessionSnapshotExpertEdit";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { resolvePulseRuntimeState, type PulseWorkspaceState } from "./pulseSessionState";

export const LATEST_AI_STUDIO_SESSION_SCHEMA_VERSION = 2;

export type AiStudioSessionSnapshotSchemaVersion = 1 | 2;
export type AiStudioSessionExpertCreateMode = "standard" | "pulse";

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
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
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
  outputPrompt?: string | null;
  canUseAsPrompt?: boolean;
  outcomeClass?: AgentMessage["outcomeClass"];
  reasonCode?: AgentMessage["reasonCode"];
  decision?: AgentMessage["decision"];
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
  standardPrompt?: string;
  pulsePrompt?: string;
  model: string | null;
  aspect: string;
  selectedCharacterId?: string | null;
  selectedCharacterLookId?: string | null;
  expertCreateMode?: AiStudioSessionExpertCreateMode;
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
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
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
};

export type AiStudioSessionAgentRuntimesV2 = {
  standard: AiStudioSessionAgentV1;
  pulsePresetId: string | null;
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
  // Legacy compatibility extension for older canvas sessions. Canonical /ai-studio writes omit this.
  canvas?: AiStudioSessionCanvasSnapshotV1;
  expertEdit?: AiStudioSessionExpertEditSnapshotV1;
};

export type AiStudioSessionSnapshot = AiStudioSessionSnapshotV1 | AiStudioSessionSnapshotV2;

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

const sanitizeMediaUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return undefined;
  return normalized;
};

const sanitizeWorkspaceMediaUrl = (value: string | null | undefined): string | null =>
  sanitizeMediaUrl(value) ?? null;

const sanitizeSelectedCharacterId = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

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
  const previewPosterUrl = sanitizeMediaUrl(output.previewPosterUrl);
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
    previewPosterUrl,
    previewPosterStoragePath: output.previewPosterStoragePath ?? null,
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
    session.finalArtifactSource === "chat_reply" ? session.finalArtifactSource : null;
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
  attachments: sanitizeAgentAttachments(message.attachments as AgentMessage["attachments"]),
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
  presetId: string | null
): boolean => {
  if (!presetId) return false;
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
  chatModeEnabled: true,
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
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const resolvedPulseWorkspaceState = resolvePulseRuntimeState(
    input.pulseWorkspaceState ?? {
      expertCreateMode: input.expertCreateMode ?? "standard",
      activePulsePresetId: input.activePulsePresetId,
      pulseSessionInstanceId: input.pulseSessionInstanceId,
    }
  );
  const resolvedExpertCreateMode = resolvedPulseWorkspaceState.expertCreateMode;
  const resolvedStandardCreatePrompt =
    input.standardCreatePrompt ?? (resolvedExpertCreateMode === "pulse" ? "" : input.prompt);
  const resolvedPulseCreatePrompt =
    resolvedExpertCreateMode === "pulse" ? (input.pulseCreatePrompt ?? input.prompt) : "";
  const {
    activePulsePresetId: resolvedActivePulsePresetId,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
  } = resolvedPulseWorkspaceState;
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
    resolvedExpertCreateMode === "pulse" && resolvedActivePulsePresetId !== null;
  const resolveAuthorizedPulseAgentRuntime = (
    runtime: AiStudioSessionAgentV1
  ): AiStudioSessionAgentV1 =>
    isPulseAgentRuntimeAuthorizedForPreset(runtime, resolvedActivePulsePresetId)
      ? runtime
      : emptyAgentRuntime;
  const agentRuntimes = input.agentRuntimes
    ? (() => {
        const inputPulsePresetId = input.agentRuntimes.pulsePresetId?.trim() || null;
        const hasMatchingPulseRuntimeAuthority =
          hasPulseWorkspaceAuthority && inputPulsePresetId === resolvedActivePulsePresetId;
        return {
          standard: sanitizeAgentRuntime(input.agentRuntimes.standard),
          pulsePresetId: hasPulseWorkspaceAuthority ? resolvedActivePulsePresetId : null,
          pulse: hasMatchingPulseRuntimeAuthority
            ? resolveAuthorizedPulseAgentRuntime(sanitizeAgentRuntime(input.agentRuntimes.pulse))
            : emptyAgentRuntime,
        };
      })()
    : {
        standard: hasPulseWorkspaceAuthority ? emptyAgentRuntime : activeAgentRuntime,
        pulsePresetId: hasPulseWorkspaceAuthority ? resolvedActivePulsePresetId : null,
        pulse: hasPulseWorkspaceAuthority
          ? resolveAuthorizedPulseAgentRuntime(activeAgentRuntime)
          : emptyAgentRuntime,
      };

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
      activePulsePresetId: resolvedActivePulsePresetId,
      pulseSessionInstanceId: resolvedPulseSessionInstanceId,
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
    extraImageUrls: [null, null, null],
    editReferenceText: "",
    videoReferenceText: "",
    videoReferenceMode: "standard",
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingWorkflowMode: "single",
    seedance2InputMode: "text",
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
    chatModeEnabled: true,
    pulseWorkflowSession: null,
    agentRuntimes: {
      standard: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
      pulsePresetId: null,
      pulse: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
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
): AiStudioSessionSnapshot => {
  const emptyAgentRuntime = createEmptyAiStudioSessionAgentState();
  if (snapshot.schemaVersion >= 2) {
    const baseSnapshot = {
      ...(snapshot as AiStudioSessionSnapshotV2 & {
        agentRuntimes?: AiStudioSessionAgentRuntimesV2;
      }),
    };
    delete (baseSnapshot as Partial<AiStudioSessionSnapshotV2>).meta;
    delete (
      baseSnapshot as Partial<AiStudioSessionSnapshotV2> & {
        agentRuntimes?: AiStudioSessionAgentRuntimesV2;
      }
    ).agentRuntimes;
    const standardProjectPrompt =
      typeof baseSnapshot.workspace.standardPrompt === "string"
        ? baseSnapshot.workspace.standardPrompt
        : baseSnapshot.workspace.expertCreateMode === "pulse"
          ? ""
          : baseSnapshot.workspace.prompt;
    const normalizedSnapshot = {
      ...baseSnapshot,
      workspace: {
        ...baseSnapshot.workspace,
        prompt: standardProjectPrompt,
        standardPrompt: standardProjectPrompt,
        pulsePrompt: "",
        selectedTool: "create" as ToolId,
        expertCreateMode: "standard" as const,
        activePulsePresetId: null,
        pulseSessionInstanceId: null,
      },
      agent: emptyAgentRuntime,
    };
    return {
      ...normalizedSnapshot,
      meta: {
        generatedAt: snapshot.updatedAt,
        checksum: computeChecksum(normalizedSnapshot),
      },
    } satisfies AiStudioSessionSnapshotV2;
  }

  return {
    ...snapshot,
    workspace: {
      ...snapshot.workspace,
      prompt: snapshot.workspace.expertCreateMode === "pulse" ? "" : snapshot.workspace.prompt,
      selectedTool: "create" as ToolId,
      expertCreateMode: "standard" as const,
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    },
    agent: emptyAgentRuntime,
  };
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
