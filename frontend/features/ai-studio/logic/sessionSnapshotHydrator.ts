/**
 * AI Studio session snapshot hydrator.
 * Normalizes persisted snapshot payloads into safe in-memory state values.
 */
import type {
  AiStudioSessionOutputV1,
  AiStudioSessionSnapshot,
  AiStudioSessionSnapshotV1,
} from "./sessionSnapshot";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AgentAttachment, AgentMessage, AgentMessageRole } from "../../../prefabs/agent/types";
import { normalizeSeedance2UiModelId } from "./seedance2Availability";
import {
  parseAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";
import { parseAiStudioSessionExpertEditState } from "./sessionSnapshotExpertEdit";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

const FALLBACK_MODE: StudioMode = "text";
const FALLBACK_ASPECT = "9:16";
const FALLBACK_VIDEO_REFERENCE_MODE = "standard" as const;
const FALLBACK_VIDEO_DURATION_SECONDS = 6;
const FALLBACK_VIDEO_RESOLUTION = "1080p";
const FALLBACK_IMAGE_RESOLUTION = "model_default";
const FALLBACK_KLING_CFG_SCALE = 0.5;
const FALLBACK_KLING_WORKFLOW_MODE = "single" as const;
const FALLBACK_SEEDANCE2_INPUT_MODE = "text" as const;
const FALLBACK_KLING_SHOT_TYPE = "customize" as const;
const FALLBACK_PROMPT_ORIGIN = "manual" as const;

const TOOL_IDS = new Set<ToolId>([
  "create",
  "media-library",
  "workflows",
  "presets",
  "styles",
  "templates",
  "my-generations",
  "community",
  "character",
  "image",
  "video",
  "sound",
  "voices",
  "text-to-speech",
  "voice-changer",
  "sound-effects",
  "music",
  "text",
  "kling",
  "edit",
]);

const asString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return value;
};

const sanitizeHydratedMediaUrl = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return null;
  return normalized;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const asMode = (value: unknown): StudioMode => {
  return value === "text" || value === "image" || value === "video" ? value : FALLBACK_MODE;
};

const asToolId = (value: unknown): ToolId | null => {
  if (typeof value !== "string") return null;
  if (value === "canvas") return "create";
  return TOOL_IDS.has(value as ToolId) ? (value as ToolId) : null;
};

const asVideoReferenceMode = (
  value: unknown
): "standard" | "modify" | "keyframes" | "kling3" | "motion" => {
  return value === "standard" ||
    value === "modify" ||
    value === "keyframes" ||
    value === "kling3" ||
    value === "motion"
    ? value
    : FALLBACK_VIDEO_REFERENCE_MODE;
};

const asFiniteNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const asPromptOrigin = (value: unknown): "manual" | "agent" | "reference" => {
  return value === "manual" || value === "agent" || value === "reference"
    ? value
    : FALLBACK_PROMPT_ORIGIN;
};

const asAgentRole = (value: unknown): AgentMessageRole | null => {
  if (value === "user" || value === "assistant" || value === "system" || value === "observation") {
    return value;
  }
  return null;
};

const asAgentAttachmentKind = (value: unknown): AgentAttachment["kind"] | null => {
  return value === "image" || value === "prompt" ? value : null;
};

const asKlingShotType = (value: unknown): "customize" | "intelligent" => {
  return value === "customize" || value === "intelligent" ? value : FALLBACK_KLING_SHOT_TYPE;
};

const asKlingWorkflowMode = (
  value: unknown,
  klingMultiPrompts: { id: string; prompt: string; duration: number }[]
): "single" | "multi" | "custom" => {
  if (value === "single" || value === "multi" || value === "custom") return value;
  return klingMultiPrompts.length > 0 ? "custom" : FALLBACK_KLING_WORKFLOW_MODE;
};

const asSeedance2InputMode = (
  value: unknown
): "text" | "first-frame" | "first-last" | "multimodal" => {
  return value === "text" ||
    value === "first-frame" ||
    value === "first-last" ||
    value === "multimodal"
    ? value
    : FALLBACK_SEEDANCE2_INPUT_MODE;
};

const asExtraImageUrls = (value: unknown): [string | null, string | null, string | null] => {
  if (!Array.isArray(value)) return [null, null, null];
  return [
    sanitizeHydratedMediaUrl(asNullableString(value[0])),
    sanitizeHydratedMediaUrl(asNullableString(value[1])),
    sanitizeHydratedMediaUrl(asNullableString(value[2])),
  ];
};

const asKlingVoiceIds = (value: unknown): [string, string] => {
  if (!Array.isArray(value)) return ["", ""];
  return [asString(value[0], ""), asString(value[1], "")];
};

const asKlingMultiPrompts = (
  value: unknown
): { id: string; prompt: string; duration: number }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: asString(row.id, `kling-shot-${index}`),
        prompt: asString(row.prompt, ""),
        duration: Math.max(1, Math.trunc(asFiniteNumber(row.duration, 5))),
      };
    })
    .filter((item): item is { id: string; prompt: string; duration: number } => Boolean(item));
};

const asKlingProfileImageTransform = (
  value: unknown
): { zoom: number; offsetX: number; offsetY: number } | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const zoom = typeof row.zoom === "number" && Number.isFinite(row.zoom) ? row.zoom : null;
  const offsetX =
    typeof row.offsetX === "number" && Number.isFinite(row.offsetX) ? row.offsetX : null;
  const offsetY =
    typeof row.offsetY === "number" && Number.isFinite(row.offsetY) ? row.offsetY : null;
  if (zoom === null || offsetX === null || offsetY === null) return null;
  return { zoom, offsetX, offsetY };
};

type HydratedKlingElementRow = {
  id: string;
  slotIndex?: number;
  sourceKind?: "element" | "character" | null;
  sourceElementId?: string | null;
  sourceCharacterId?: string | null;
  name?: string;
  alias?: string;
  description?: string;
  profileImageUrl?: string | null;
  profileImageTransform?: { zoom: number; offsetX: number; offsetY: number } | null;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
};

const asKlingElements = (value: unknown): HydratedKlingElementRow[] => {
  if (!Array.isArray(value)) return [];
  const rows: Array<HydratedKlingElementRow | null> = value.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const frontalImageUrl = sanitizeHydratedMediaUrl(asNullableString(row.frontalImageUrl)) ?? "";
    const referenceImageUrls = asString(row.referenceImageUrls, "")
      .split(/[,\n]+/)
      .map((url) => sanitizeHydratedMediaUrl(url))
      .filter((url): url is string => Boolean(url))
      .join(", ");
    const videoUrl = sanitizeHydratedMediaUrl(asNullableString(row.videoUrl)) ?? "";
    return {
      id: asString(row.id, `kling-element-${index}`),
      slotIndex:
        typeof row.slotIndex === "number" && Number.isFinite(row.slotIndex)
          ? Math.max(0, Math.trunc(row.slotIndex))
          : undefined,
      sourceKind:
        row.sourceKind === "character" || row.sourceKind === "element" ? row.sourceKind : null,
      sourceElementId: asNullableString(row.sourceElementId),
      sourceCharacterId: asNullableString(row.sourceCharacterId),
      name: asString(row.name, ""),
      alias: asString(row.alias, ""),
      description: asString(row.description, ""),
      profileImageUrl: sanitizeHydratedMediaUrl(asNullableString(row.profileImageUrl)),
      profileImageTransform: asKlingProfileImageTransform(row.profileImageTransform),
      frontalImageUrl,
      referenceImageUrls,
      videoUrl,
    };
  });
  return rows.filter((item): item is HydratedKlingElementRow => Boolean(item));
};

const RESTORED_QUEUE_WAITING_TIMESTAMP = "Waiting in queue...";
const RESTORED_SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";

const hasSettledRestoredOutputPayload = (output: StudioOutput): boolean => {
  if (output.status === "saved") return true;
  if (Array.isArray(output.savedMediaIds) && output.savedMediaIds.length > 0) return true;
  if ((output.resultUrls ?? []).some((url) => typeof url === "string" && url.trim().length > 0)) {
    return true;
  }
  if (typeof output.previewUrl === "string" && output.previewUrl.trim().length > 0) return true;
  if (typeof output.previewText === "string" && output.previewText.trim().length > 0) return true;
  if (
    typeof output.previewStoragePath === "string" &&
    output.previewStoragePath.trim().length > 0
  ) {
    return true;
  }
  if (typeof output.fullStoragePath === "string" && output.fullStoragePath.trim().length > 0) {
    return true;
  }
  return false;
};

const normalizeRestoredOutputLifecycle = (output: StudioOutput): StudioOutput => {
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  const sourceRef = typeof output.sourceRef === "string" ? output.sourceRef.trim() : "";
  const taskId = typeof output.taskId === "string" ? output.taskId.trim() : "";
  if ((!generationId && !sourceRef) || taskId || hasSettledRestoredOutputPayload(output)) {
    return output;
  }

  if (output.queueState === "queued") {
    return {
      ...output,
      status: "ready",
      taskState: "pending",
      timestamp: RESTORED_QUEUE_WAITING_TIMESTAMP,
      errorMessage: null,
      errorMessageShort: null,
    };
  }

  return {
    ...output,
    status: "ready",
    taskState: "pending",
    timestamp: RESTORED_SERVER_RECOVERY_PENDING_TIMESTAMP,
    errorMessage: null,
    errorMessageShort: null,
  };
};

const hydrateOutput = (output: AiStudioSessionOutputV1): StudioOutput =>
  normalizeRestoredOutputLifecycle({
    id: output.id,
    prompt: output.prompt,
    mode: asMode(output.mode),
    aspect: typeof output.aspect === "string" ? output.aspect : FALLBACK_ASPECT,
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
    queueEnqueuedAtMs:
      typeof output.queueEnqueuedAtMs === "number" && Number.isFinite(output.queueEnqueuedAtMs)
        ? output.queueEnqueuedAtMs
        : undefined,
    generationTraceId: output.generationTraceId,
    errorMessage: output.errorMessage ?? null,
    errorMessageShort: output.errorMessageShort ?? null,
    resultUrls: output.resultUrls,
    previewUrl: output.previewUrl,
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
  });

const dedupeOutputs = (rows: StudioOutput[]): StudioOutput[] => {
  const byId = new Map<string, StudioOutput>();
  rows.forEach((row) => {
    if (!row.id) return;
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  });
  return [...byId.values()];
};

const normalizeAgentAttachments = (value: unknown): AgentAttachment[] => {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const normalized: AgentAttachment[] = [];
  value.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const attachment = row as Record<string, unknown>;
    const idCandidate = asString(attachment.id, "").trim() || `agent-attachment-restored-${index}`;
    let resolvedId = idCandidate;
    if (seenIds.has(resolvedId)) {
      let collisionIndex = 1;
      let nextId = `${resolvedId}-${collisionIndex}`;
      while (seenIds.has(nextId)) {
        collisionIndex += 1;
        nextId = `${resolvedId}-${collisionIndex}`;
      }
      resolvedId = nextId;
    }
    seenIds.add(resolvedId);
    const kind = asAgentAttachmentKind(attachment.kind);
    if (!kind) return;
    const imageUrl = sanitizeHydratedMediaUrl(asNullableString(attachment.imageUrl));
    const text = asNullableString(attachment.text)?.trim() || null;
    if (kind === "image" && !imageUrl) return;
    normalized.push({
      id: resolvedId,
      kind,
      referenceId: asNullableString(attachment.referenceId),
      text,
      imageUrl,
      aspect: asNullableString(attachment.aspect),
      deliveryStatus:
        attachment.deliveryStatus === "pending" ||
        attachment.deliveryStatus === "preparing" ||
        attachment.deliveryStatus === "ready" ||
        attachment.deliveryStatus === "failed"
          ? attachment.deliveryStatus
          : kind === "prompt"
            ? "ready"
            : "pending",
      deliveryError: asNullableString(attachment.deliveryError),
    });
  });
  return normalized;
};

const normalizeAgentMessages = (value: unknown): AgentMessage[] => {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const normalized: AgentMessage[] = [];
  value.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const message = row as Record<string, unknown>;
    const role = asAgentRole(message.role);
    if (!role) return;
    const content = asString(message.content, "").trim();
    const attachments = normalizeAgentAttachments(message.attachments);
    if (!content && attachments.length === 0) return;

    const candidateId = asString(message.id, "").trim();
    let resolvedId = candidateId || `agent-${role}-restored-${index}`;
    if (seenIds.has(resolvedId)) {
      let collisionIndex = 1;
      let nextId = `${resolvedId}-${collisionIndex}`;
      while (seenIds.has(nextId)) {
        collisionIndex += 1;
        nextId = `${resolvedId}-${collisionIndex}`;
      }
      resolvedId = nextId;
    }
    seenIds.add(resolvedId);
    normalized.push({
      id: resolvedId,
      role,
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  });
  return normalized;
};

export type AiStudioSessionHydrationPayload = {
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
    videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
    videoDurationSeconds: number;
    videoResolution: string;
    imageResolution: string;
    videoGenerateAudio: boolean;
    videoCameraFixed: boolean;
    videoAutoFix: boolean;
    klingNegativePrompt: string;
    klingCfgScale: number;
    klingWorkflowMode: "single" | "multi" | "custom";
    seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
    seedance2ReferenceImageUrls: string[];
    seedance2ReferenceVideoUrls: string[];
    seedance2ReferenceAudioUrls: string[];
    seedance2ReturnLastFrame: boolean;
    seedance2WebSearch: boolean;
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
    active: StudioOutput[];
    archived: StudioOutput[];
    activeOutputId: string | null;
    curatedReferenceIds: string[];
    removedFromAllRefsIds: string[];
  };
  agent: {
    messages: AgentMessage[];
    input: string;
    latestAgentPrompt: string | null;
    promptOrigin: "manual" | "agent" | "reference";
    chatModeEnabled: boolean;
  };
  canvas: AiStudioSessionCanvasState | null;
  expertEdit: ExpertEditSessionState | null;
};

/**
 * Builds normalized state payload used by snapshot hydration apply paths.
 */
export const buildAiStudioSessionHydrationPayload = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionHydrationPayload => {
  const workspace = snapshot.workspace ?? ({} as AiStudioSessionSnapshotV1["workspace"]);
  const outputs = snapshot.outputs ?? ({} as AiStudioSessionSnapshotV1["outputs"]);
  const agent = snapshot.agent ?? ({} as AiStudioSessionSnapshotV1["agent"]);
  const canvas =
    snapshot.schemaVersion >= 2
      ? parseAiStudioSessionCanvasState((snapshot as Record<string, unknown>).canvas ?? null)
      : null;
  const expertEdit =
    snapshot.schemaVersion >= 2
      ? parseAiStudioSessionExpertEditState(
          (snapshot as Record<string, unknown>).expertEdit ?? null
        )
      : null;

  const activeOutputs = dedupeOutputs((outputs.active ?? []).map(hydrateOutput));
  const archivedOutputs = dedupeOutputs((outputs.archived ?? []).map(hydrateOutput));
  const allOutputIds = new Set<string>([
    ...activeOutputs.map((row) => row.id),
    ...archivedOutputs.map((row) => row.id),
  ]);

  const candidateActiveOutputId = asNullableString(outputs.activeOutputId);
  const activeOutputId =
    candidateActiveOutputId && allOutputIds.has(candidateActiveOutputId)
      ? candidateActiveOutputId
      : null;
  const persistedKlingMultiPrompts = asKlingMultiPrompts(workspace.klingMultiPrompts);
  const persistedKlingWorkflowMode = asKlingWorkflowMode(
    workspace.klingWorkflowMode,
    persistedKlingMultiPrompts
  );
  const shouldResetPersistedCustomKlingWorkspace =
    persistedKlingWorkflowMode === "custom" || persistedKlingMultiPrompts.length > 0;
  const klingWorkflowMode = shouldResetPersistedCustomKlingWorkspace
    ? FALLBACK_KLING_WORKFLOW_MODE
    : persistedKlingWorkflowMode;
  const klingMultiPrompts = shouldResetPersistedCustomKlingWorkspace
    ? []
    : persistedKlingMultiPrompts;

  return {
    workspace: {
      mode: asMode(workspace.mode),
      selectedTool: asToolId(workspace.selectedTool),
      prompt: asString(workspace.prompt, ""),
      model: normalizeSeedance2UiModelId(asNullableString(workspace.model)) ?? null,
      aspect: asString(workspace.aspect, FALLBACK_ASPECT),
      referenceImageUrl: sanitizeHydratedMediaUrl(asNullableString(workspace.referenceImageUrl)),
      extraImageUrls: asExtraImageUrls(workspace.extraImageUrls),
      editReferenceText: asString(workspace.editReferenceText, ""),
      videoReferenceText: asString(workspace.videoReferenceText, ""),
      videoReferenceMode: asVideoReferenceMode(workspace.videoReferenceMode),
      videoDurationSeconds: Math.max(
        1,
        Math.trunc(asFiniteNumber(workspace.videoDurationSeconds, FALLBACK_VIDEO_DURATION_SECONDS))
      ),
      videoResolution: asString(workspace.videoResolution, FALLBACK_VIDEO_RESOLUTION),
      imageResolution: asString(workspace.imageResolution, FALLBACK_IMAGE_RESOLUTION),
      videoGenerateAudio: asBoolean(workspace.videoGenerateAudio),
      videoCameraFixed: asBoolean(workspace.videoCameraFixed),
      videoAutoFix: asBoolean(workspace.videoAutoFix),
      klingNegativePrompt: asString(workspace.klingNegativePrompt, ""),
      klingCfgScale: asFiniteNumber(workspace.klingCfgScale, FALLBACK_KLING_CFG_SCALE),
      klingWorkflowMode,
      seedance2InputMode: asSeedance2InputMode(workspace.seedance2InputMode),
      seedance2ReferenceImageUrls: asStringArray(workspace.seedance2ReferenceImageUrls)
        .map((url) => sanitizeHydratedMediaUrl(url))
        .filter((url): url is string => Boolean(url)),
      seedance2ReferenceVideoUrls: asStringArray(workspace.seedance2ReferenceVideoUrls)
        .map((url) => sanitizeHydratedMediaUrl(url))
        .filter((url): url is string => Boolean(url)),
      seedance2ReferenceAudioUrls: asStringArray(workspace.seedance2ReferenceAudioUrls)
        .map((url) => sanitizeHydratedMediaUrl(url))
        .filter((url): url is string => Boolean(url)),
      seedance2ReturnLastFrame: asBoolean(workspace.seedance2ReturnLastFrame),
      seedance2WebSearch: asBoolean(workspace.seedance2WebSearch),
      klingShotType: asKlingShotType(workspace.klingShotType),
      klingVoiceIds: asKlingVoiceIds(workspace.klingVoiceIds),
      klingMultiPrompts,
      klingElements: asKlingElements(workspace.klingElements),
      motionReferenceVideoUrl: sanitizeHydratedMediaUrl(
        asNullableString(workspace.motionReferenceVideoUrl)
      ),
    },
    outputs: {
      active: activeOutputs,
      archived: archivedOutputs,
      activeOutputId,
      curatedReferenceIds: asStringArray(outputs.curatedReferenceIds).filter((id) =>
        allOutputIds.has(id)
      ),
      removedFromAllRefsIds: asStringArray(outputs.removedFromAllRefsIds).filter((id) =>
        allOutputIds.has(id)
      ),
    },
    agent: {
      messages: normalizeAgentMessages(agent.messages),
      input: asString(agent.input, ""),
      latestAgentPrompt: asNullableString(agent.latestAgentPrompt),
      promptOrigin: asPromptOrigin(agent.promptOrigin),
      chatModeEnabled: asBoolean(agent.chatModeEnabled, true),
    },
    canvas,
    expertEdit,
  };
};
