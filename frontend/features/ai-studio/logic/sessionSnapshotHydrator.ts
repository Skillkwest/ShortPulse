/**
 * AI Studio session snapshot hydrator.
 * Normalizes persisted snapshot payloads into safe in-memory state values.
 */
import type {
  AiStudioSessionCreateModeReferenceStatesV1,
  AiStudioSessionOutputV1,
  AiStudioSessionSnapshot,
  AiStudioSessionSnapshotV1,
} from "./sessionSnapshot";
import {
  normalizeInternalMediaRefList,
  type InternalMediaRef,
} from "../../../lib/media/internalMediaRefs";
import type { StudioMode, StudioOutput, ToolId, VideoReferenceMode } from "../types";
import { getModelConfig } from "../../../lib/model-runtime/modelRegistry";
import type {
  AgentAttachment,
  AgentMessage,
  AgentMessageRole,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent/types";
import { resolveComposerImageAttachmentPreview } from "./composerImageAttachment";
import { normalizeAiStudioRestoredModelId } from "./modelRestorePolicy";
import { normalizeSelectedToolForExpertCreateMode } from "./pulseToolInvariant";
import {
  createEmptyPulseChatProjectState,
  parsePulseChatProjectState,
  type PulseChatProjectState,
} from "../pulseChats/pulseChatThread";
import {
  parseAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";
import { parseAiStudioSessionExpertEditState } from "./sessionSnapshotExpertEdit";
import { normalizeAudioSourceMode } from "./audioSourceMode";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import {
  PULSE_CREATE_FORCED_CHAT_MODE_ENABLED,
  STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
} from "./chatModeDefaults";
import {
  createEmptyExpertEditSecondaryImageUrls,
  normalizeExpertEditSecondaryImageUrls,
} from "./expertEditReferenceSlots";
import { resolveVideoPosterStoragePath } from "./videoPosterStoragePaths";
import { resolveHydratedPulseRuntimeState, resolvePulseRuntimeState } from "./pulseSessionState";
import {
  hasRecoverableSessionOutputIdentity,
  hasSettledSessionOutputPayload,
  shouldKeepSessionOutputForDurableRestore,
} from "./sessionOutputAuthority";
import type { AiStudioRightRailLayoutV1 } from "./rightRailLayout";
import { sanitizeRightRailLayoutSnapshot } from "./rightRailLayout";

const FALLBACK_MODE: StudioMode = "text";
const FALLBACK_ASPECT = "9:16";
const FALLBACK_EXPERT_CREATE_MODE = "standard" as const;
const FALLBACK_VIDEO_REFERENCE_MODE = "standard" as const;
const FALLBACK_VIDEO_DURATION_SECONDS = 6;
const FALLBACK_VIDEO_RESOLUTION = "1080p";
const FALLBACK_IMAGE_RESOLUTION = "model_default";
const FALLBACK_KLING_CFG_SCALE = 0.5;
const FALLBACK_KLING_WORKFLOW_MODE = "single" as const;
const FALLBACK_SEEDANCE2_INPUT_MODE = "multimodal" as const;
const FALLBACK_KLING_SHOT_TYPE = "customize" as const;
const FALLBACK_PROMPT_ORIGIN = "manual" as const;
const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;

const TOOL_IDS = new Set<ToolId>([
  "create",
  "media-library",
  "elements",
  "workflows",
  "presets",
  "styles",
  "templates",
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

const normalizeArchiveReason = (value: unknown): StudioOutput["archiveReason"] => {
  if (value === "manual" || value === "cleanup") return value;
  return null;
};

const asIsoTimestampString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
};

const sanitizeHydratedMediaUrl = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return null;
  return normalized;
};

const sanitizeHydratedAttachmentIdentity = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const sanitizeHydratedAttachmentImageFallbackUrls = (value: unknown): string[] | undefined => {
  const normalized = asStringArray(value)
    .map((candidate) => sanitizeHydratedMediaUrl(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

const normalizeHydratedVideoStorageAuthority = ({
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

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const asMode = (value: unknown): StudioMode => {
  return value === "text" || value === "image" || value === "video" || value === "audio"
    ? value
    : FALLBACK_MODE;
};

const asToolId = (value: unknown): ToolId | null => {
  if (typeof value !== "string") return null;
  if (value === "canvas") return "create";
  if (value === "pulse-presets") return "presets";
  return TOOL_IDS.has(value as ToolId) ? (value as ToolId) : null;
};

const asVideoReferenceMode = (value: unknown): VideoReferenceMode => {
  if (value === "standard" || value === "modify" || value === "kling3" || value === "motion") {
    return value;
  }
  if (value === "lip-sync") {
    return value;
  }
  // Hidden keyframes snapshot values should reopen on the visible Standard lane.
  if (value === "keyframes") {
    return "standard";
  }
  return FALLBACK_VIDEO_REFERENCE_MODE;
};

const asExpertCreateMode = (value: unknown): "standard" | "pulse" => {
  return value === "standard" || value === "pulse" ? value : FALLBACK_EXPERT_CREATE_MODE;
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

const asAgentOutcomeClass = (value: unknown): AgentMessage["outcomeClass"] => {
  if (
    value === "success_prompt" ||
    value === "success_message" ||
    value === "refusal_safety" ||
    value === "refusal_model" ||
    value === "route_error" ||
    value === "upstream_error"
  ) {
    return value;
  }
  return null;
};

const asAgentDecision = (value: unknown): AgentMessage["decision"] => {
  if (value === "allow" || value === "refuse" || value === "error") return value;
  return null;
};

const asAgentAttachmentKind = (value: unknown): AgentAttachment["kind"] | null => {
  return value === "image" || value === "prompt" ? value : null;
};

const asPulseWorkflowStatus = (value: unknown): AgentPulseWorkflowSession["status"] => {
  return value === "idle" ||
    value === "running" ||
    value === "awaiting_input" ||
    value === "completed"
    ? value
    : "idle";
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

const asExtraImageUrls = (value: unknown): (string | null)[] => {
  if (!Array.isArray(value)) return createEmptyExpertEditSecondaryImageUrls();
  return normalizeExpertEditSecondaryImageUrls(
    value.map((item) => sanitizeHydratedMediaUrl(asNullableString(item)))
  );
};

const asCreateModeReferenceState = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    selectedTool: asToolId(row.selectedTool) ?? "create",
    showCreateTools: asBoolean(row.showCreateTools),
    referenceImageUrl: sanitizeHydratedMediaUrl(asNullableString(row.referenceImageUrl)),
    extraImageUrls: asExtraImageUrls(row.extraImageUrls),
    referenceImageInternalMediaRefs: normalizeInternalMediaRefList(
      row.referenceImageInternalMediaRefs,
      11
    ),
    motionReferenceVideoUrl: sanitizeHydratedMediaUrl(
      asNullableString(row.motionReferenceVideoUrl)
    ),
    useReferenceImageIndicator: asBoolean(row.useReferenceImageIndicator),
    detailOutputId: asNullableString(row.detailOutputId)?.trim() || null,
  };
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
  sourceKind?:
    | "element"
    | "character"
    | "reference-image"
    | "reference-video"
    | "reference-audio"
    | null;
  sourceElementId?: string | null;
  sourceCharacterId?: string | null;
  sourceCharacterLookId?: string | null;
  sourceCharacterLookLabel?: string | null;
  name?: string;
  alias?: string;
  description?: string;
  profileImageUrl?: string | null;
  profileImageTransform?: { zoom: number; offsetX: number; offsetY: number } | null;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
  audioUrl?: string;
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
    const audioUrl = sanitizeHydratedMediaUrl(asNullableString(row.audioUrl)) ?? "";
    return {
      id: asString(row.id, `kling-element-${index}`),
      slotIndex:
        typeof row.slotIndex === "number" && Number.isFinite(row.slotIndex)
          ? Math.max(0, Math.trunc(row.slotIndex))
          : undefined,
      sourceKind:
        row.sourceKind === "character" ||
        row.sourceKind === "element" ||
        row.sourceKind === "reference-image" ||
        row.sourceKind === "reference-video" ||
        row.sourceKind === "reference-audio"
          ? row.sourceKind
          : null,
      sourceElementId: asNullableString(row.sourceElementId),
      sourceCharacterId: asNullableString(row.sourceCharacterId),
      sourceCharacterLookId: asNullableString(row.sourceCharacterLookId),
      sourceCharacterLookLabel: asNullableString(row.sourceCharacterLookLabel),
      name: asString(row.name, ""),
      alias: asString(row.alias, ""),
      description: asString(row.description, ""),
      profileImageUrl: sanitizeHydratedMediaUrl(asNullableString(row.profileImageUrl)),
      profileImageTransform: asKlingProfileImageTransform(row.profileImageTransform),
      frontalImageUrl,
      referenceImageUrls,
      videoUrl,
      ...(audioUrl ? { audioUrl } : {}),
    };
  });
  return rows.filter((item): item is HydratedKlingElementRow => Boolean(item));
};

const RESTORED_QUEUE_WAITING_TIMESTAMP = "Waiting in queue...";
const RESTORED_SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";

const resolveRestoredSubmissionMode = (
  output: Pick<AiStudioSessionOutputV1, "submissionMode" | "modelId">
): StudioOutput["submissionMode"] => {
  if (output.submissionMode === "direct-request" || output.submissionMode === "provider-task") {
    return output.submissionMode;
  }
  const modelId = typeof output.modelId === "string" ? output.modelId.trim() : "";
  if (!modelId) return undefined;
  return getModelConfig(modelId)?.executionMode === "direct" ? "direct-request" : undefined;
};

const shouldDropRestoredTransientFailure = (output: StudioOutput): boolean => {
  if (output.taskState !== "fail") return false;
  if (output.submissionMode !== "direct-request") return false;
  if (hasSettledSessionOutputPayload(output)) return false;
  if (hasRecoverableSessionOutputIdentity(output)) return false;
  if (output.mediaSource && output.mediaSource !== "generated") return false;
  return true;
};

const shouldDropRestoredUnsettledGeneratedAudioFailure = (output: StudioOutput): boolean => {
  if (output.taskState !== "fail") return false;
  if (output.mode !== "audio") return false;
  if (output.mediaSource && output.mediaSource !== "generated") return false;
  return !hasSettledSessionOutputPayload(output);
};

const normalizeRestoredOutputLifecycle = (output: StudioOutput): StudioOutput => {
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  const sourceRef = typeof output.sourceRef === "string" ? output.sourceRef.trim() : "";
  const taskId = typeof output.taskId === "string" ? output.taskId.trim() : "";
  if ((!generationId && !sourceRef) || taskId || hasSettledSessionOutputPayload(output)) {
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

const hydrateOutput = (output: AiStudioSessionOutputV1): StudioOutput | null => {
  const mode = asMode(output.mode);
  const normalizedStorageAuthority = normalizeHydratedVideoStorageAuthority({
    mode,
    previewStoragePath: output.previewStoragePath ?? null,
    previewPosterStoragePath: output.previewPosterStoragePath ?? null,
    fullStoragePath: output.fullStoragePath ?? null,
  });
  const hydratedOutput = normalizeRestoredOutputLifecycle({
    id: output.id,
    prompt: output.prompt,
    transcriptText: typeof output.transcriptText === "string" ? output.transcriptText : null,
    lyricsText: typeof output.lyricsText === "string" ? output.lyricsText : null,
    musicMode:
      output.musicMode === "instrumental" || output.musicMode === "vocal" ? output.musicMode : null,
    mode,
    aspect: typeof output.aspect === "string" ? output.aspect : FALLBACK_ASPECT,
    model: output.model,
    createdAt: asIsoTimestampString(output.createdAt) ?? asIsoTimestampString(output.timestamp),
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
    submissionMode: resolveRestoredSubmissionMode(output),
    errorMessage: output.errorMessage ?? null,
    errorMessageShort: output.errorMessageShort ?? null,
    errorDetail:
      typeof output.errorDetail === "string" || output.errorDetail === null
        ? output.errorDetail
        : null,
    audioSourceMode: normalizeAudioSourceMode(output.audioSourceMode),
    durationMs:
      typeof output.durationMs === "number" && Number.isFinite(output.durationMs)
        ? Math.max(0, Math.round(output.durationMs))
        : null,
    waveformPeaks:
      Array.isArray(output.waveformPeaks) && output.waveformPeaks.length > 0
        ? output.waveformPeaks.filter((value): value is number => typeof value === "number")
        : null,
    resultUrls: output.resultUrls,
    previewUrl: output.previewUrl,
    previewPosterUrl: output.previewPosterUrl ?? null,
    previewPosterStoragePath: normalizedStorageAuthority.previewPosterStoragePath,
    companionArtUrl: output.companionArtUrl ?? null,
    companionArtStoragePath: output.companionArtStoragePath ?? null,
    companionArtStatus: output.companionArtStatus ?? null,
    width:
      typeof output.width === "number" && Number.isFinite(output.width) && output.width > 0
        ? Math.max(1, Math.round(output.width))
        : null,
    height:
      typeof output.height === "number" && Number.isFinite(output.height) && output.height > 0
        ? Math.max(1, Math.round(output.height))
        : null,
    previewStoragePath: normalizedStorageAuthority.previewStoragePath,
    fullStoragePath: normalizedStorageAuthority.fullStoragePath,
    previewTier: output.previewTier,
    mediaSource: output.mediaSource,
    previewText: output.previewText,
    pinned: output.pinned,
    hiddenInReferenceGrid: output.hiddenInReferenceGrid,
    archivedAt: output.archivedAt ?? null,
    archiveReason: normalizeArchiveReason(output.archiveReason),
    characterContext: output.characterContext,
    ...(output.styleContext ? { styleContext: output.styleContext } : {}),
    generationReplay: output.generationReplay,
  });
  return !shouldKeepSessionOutputForDurableRestore(hydratedOutput) ||
    shouldDropRestoredTransientFailure(hydratedOutput) ||
    shouldDropRestoredUnsettledGeneratedAudioFailure(hydratedOutput)
    ? null
    : hydratedOutput;
};

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

const resolveHydratedCuratedReferenceIds = ({
  rawCuratedReferenceIds,
  activeOutputs,
  archivedOutputs,
  allOutputIds,
}: {
  rawCuratedReferenceIds: unknown;
  activeOutputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  allOutputIds: Set<string>;
}): string[] => {
  const explicitIds = asStringArray(rawCuratedReferenceIds).filter((id) => allOutputIds.has(id));
  if (explicitIds.length > 0) return explicitIds;
  return [...activeOutputs, ...archivedOutputs]
    .filter((output) => output.pinned === true && allOutputIds.has(output.id))
    .map((output) => output.id);
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
    if (attachment.source === "ephemeral_local") return;
    const imageUrl = sanitizeHydratedMediaUrl(asNullableString(attachment.imageUrl));
    const imageFallbackUrls = sanitizeHydratedAttachmentImageFallbackUrls(
      attachment.imageFallbackUrls
    );
    const text = asNullableString(attachment.text)?.trim() || null;
    const referenceUrl = sanitizeHydratedMediaUrl(asNullableString(attachment.referenceUrl));
    const referenceRenderUrl = sanitizeHydratedMediaUrl(
      asNullableString(attachment.referenceRenderUrl)
    );
    const previewStoragePath = sanitizeHydratedAttachmentIdentity(
      asNullableString(attachment.previewStoragePath)
    );
    const fullStoragePath = sanitizeHydratedAttachmentIdentity(
      asNullableString(attachment.fullStoragePath)
    );
    const preview =
      kind === "image"
        ? resolveComposerImageAttachmentPreview({
            kind,
            imageUrl,
            imageFallbackUrls,
            referenceRenderUrl,
            referenceUrl,
          })
        : null;
    const hasRepairableImageIdentity =
      kind === "image" &&
      Boolean(
        previewStoragePath ||
        fullStoragePath ||
        referenceUrl ||
        referenceRenderUrl ||
        imageUrl ||
        imageFallbackUrls?.length
      );
    if (kind === "image" && !preview && !hasRepairableImageIdentity) return;
    normalized.push({
      id: resolvedId,
      kind,
      referenceId: asNullableString(attachment.referenceId),
      mediaId: sanitizeHydratedAttachmentIdentity(asNullableString(attachment.mediaId)),
      text,
      previewStoragePath,
      fullStoragePath,
      referenceUrl,
      referenceRenderUrl,
      imageUrl: preview?.url ?? imageUrl,
      imageFallbackUrls: preview?.candidates.slice(1) ?? imageFallbackUrls,
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
    const outputPrompt = asNullableString(message.outputPrompt);
    const outcomeClass = asAgentOutcomeClass(message.outcomeClass);
    const reasonCode = asNullableString(message.reasonCode) as AgentMessage["reasonCode"];
    const decision = asAgentDecision(message.decision);
    normalized.push({
      id: resolvedId,
      role,
      content,
      ...(outputPrompt ? { outputPrompt } : {}),
      ...(typeof message.canUseAsPrompt === "boolean"
        ? { canUseAsPrompt: message.canUseAsPrompt }
        : {}),
      ...(outcomeClass ? { outcomeClass } : {}),
      ...(reasonCode ? { reasonCode } : {}),
      ...(decision ? { decision } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    });
  });
  return normalized;
};

export type AiStudioSessionHydrationPayload = {
  workspace: {
    mode: StudioMode;
    selectedTool: ToolId | null;
    prompt: string;
    standardPrompt: string;
    pulsePrompt: string;
    model: string | null;
    aspect: string;
    selectedCharacterId: string | null;
    selectedCharacterLookId: string | null;
    expertCreateMode: "standard" | "pulse";
    activePulsePresetId: string | null;
    pulseSessionInstanceId: string | null;
    createModeReferenceStates?: AiStudioSessionCreateModeReferenceStatesV1;
    referenceImageUrl: string | null;
    extraImageUrls: (string | null)[];
    referenceImageInternalMediaRefs?: Array<InternalMediaRef | null>;
    editReferenceText: string;
    videoReferenceText: string;
    videoReferenceMode: VideoReferenceMode;
    lipSyncAudioUrl: string | null;
    lipSyncAudioStoragePath: string | null;
    lipSyncAudioDurationMs: number | null;
    lipSyncTurboMode: boolean;
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
      audioUrl?: string;
    }[];
    motionReferenceVideoUrl: string | null;
    rightRailLayout: AiStudioRightRailLayoutV1;
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
    pulseWorkflowSession: AgentPulseWorkflowSession | null;
  };
  agentRuntimes: {
    standard: {
      messages: AgentMessage[];
      input: string;
      latestAgentPrompt: string | null;
      promptOrigin: "manual" | "agent" | "reference";
      chatModeEnabled: boolean;
      pulseWorkflowSession: AgentPulseWorkflowSession | null;
    };
    pulsePresetId: string | null;
    pulseSessionInstanceId: string | null;
    pulse: {
      messages: AgentMessage[];
      input: string;
      latestAgentPrompt: string | null;
      promptOrigin: "manual" | "agent" | "reference";
      chatModeEnabled: boolean;
      pulseWorkflowSession: AgentPulseWorkflowSession | null;
    };
  };
  pulseChats: PulseChatProjectState;
  canvas: AiStudioSessionCanvasState | null;
  expertEdit: ExpertEditSessionState | null;
};

const asPulseWorkflowSession = (value: unknown): AgentPulseWorkflowSession | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const presetId = asNullableString(row.presetId)?.trim() ?? "";
  if (!presetId) return null;
  const currentStepIndexRaw =
    typeof row.currentStepIndex === "number" && Number.isFinite(row.currentStepIndex)
      ? Math.max(1, Math.trunc(row.currentStepIndex))
      : null;
  const currentStepLabel = asNullableString(row.currentStepLabel)?.trim() ?? null;
  const currentStepPrompt = asNullableString(row.currentStepPrompt)?.trim() ?? null;
  const lastArtifact = asNullableString(row.lastArtifact)?.trim() ?? null;
  const finalArtifactSource =
    row.finalArtifactSource === "apply_prompt" || row.finalArtifactSource === "chat_reply"
      ? row.finalArtifactSource
      : null;
  const collectedInputs = asStringArray(row.collectedInputs)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return {
    presetId,
    status: asPulseWorkflowStatus(row.status),
    currentStepIndex: currentStepIndexRaw,
    currentStepLabel: currentStepLabel && currentStepLabel.length > 0 ? currentStepLabel : null,
    currentStepPrompt: currentStepPrompt && currentStepPrompt.length > 0 ? currentStepPrompt : null,
    collectedInputs,
    lastArtifact: lastArtifact && lastArtifact.length > 0 ? lastArtifact : null,
    finalArtifactSource,
  };
};

export const buildHydratedAgentRuntime = (value: unknown) => {
  const runtime = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    messages: normalizeAgentMessages(runtime.messages),
    input: asString(runtime.input, ""),
    latestAgentPrompt: asNullableString(runtime.latestAgentPrompt),
    promptOrigin: asPromptOrigin(runtime.promptOrigin),
    chatModeEnabled: asBoolean(runtime.chatModeEnabled, STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED),
    pulseWorkflowSession: asPulseWorkflowSession(runtime.pulseWorkflowSession),
  };
};

const coerceHydratedRuntimeChatMode = <
  TRuntime extends ReturnType<typeof buildHydratedAgentRuntime>,
>(
  runtime: TRuntime,
  options?: {
    forceChatModeEnabled?: boolean;
  }
): TRuntime =>
  options?.forceChatModeEnabled
    ? { ...runtime, chatModeEnabled: PULSE_CREATE_FORCED_CHAT_MODE_ENABLED }
    : runtime;

const isHydratedPulseRuntimeAuthorizedForPreset = (
  runtime: ReturnType<typeof buildHydratedAgentRuntime>,
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
 * Builds normalized state payload used by snapshot hydration apply paths.
 */
export const buildAiStudioSessionHydrationPayload = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionHydrationPayload => {
  const workspace = snapshot.workspace ?? ({} as AiStudioSessionSnapshotV1["workspace"]);
  const outputs = snapshot.outputs ?? ({} as AiStudioSessionSnapshotV1["outputs"]);
  const agentRuntimes =
    snapshot.schemaVersion >= 2
      ? (((snapshot as Record<string, unknown>).agentRuntimes as Record<string, unknown> | null) ??
        null)
      : null;
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
  const pulseChats =
    snapshot.schemaVersion >= 2
      ? parsePulseChatProjectState((snapshot as Record<string, unknown>).pulseChats ?? null)
      : createEmptyPulseChatProjectState();

  const activeOutputs = dedupeOutputs(
    (outputs.active ?? []).map(hydrateOutput).filter((row): row is StudioOutput => Boolean(row))
  );
  const archivedOutputs = dedupeOutputs(
    (outputs.archived ?? []).map(hydrateOutput).filter((row): row is StudioOutput => Boolean(row))
  );
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
  const klingWorkflowMode = persistedKlingWorkflowMode;
  const klingMultiPrompts = persistedKlingMultiPrompts;
  const workspaceExpertCreateMode = asExpertCreateMode(
    (workspace as { expertCreateMode?: unknown }).expertCreateMode
  );
  const legacyWorkspacePrompt = asString(workspace.prompt, "");
  const workspaceStandardPrompt = asString(
    (workspace as { standardPrompt?: unknown }).standardPrompt,
    workspaceExpertCreateMode === "pulse" ? "" : legacyWorkspacePrompt
  );
  const normalizedWorkspacePulseState = resolvePulseRuntimeState({
    expertCreateMode: workspaceExpertCreateMode,
    activePulsePresetId: (workspace as { activePulsePresetId?: unknown }).activePulsePresetId,
    pulseSessionInstanceId: (workspace as { pulseSessionInstanceId?: unknown })
      .pulseSessionInstanceId,
  });
  const workspaceActivePulsePresetId = normalizedWorkspacePulseState.activePulsePresetId;
  const workspacePulseSessionInstanceId = normalizedWorkspacePulseState.pulseSessionInstanceId;
  const shouldHydrateHiddenPulseWorkspaceState =
    workspaceExpertCreateMode === "pulse" || workspacePulseSessionInstanceId !== null;
  const workspacePulsePrompt = shouldHydrateHiddenPulseWorkspaceState
    ? asString(
        (workspace as { pulsePrompt?: unknown }).pulsePrompt,
        workspaceExpertCreateMode === "pulse" ? legacyWorkspacePrompt : ""
      )
    : "";
  const defaultAgentRuntime = buildHydratedAgentRuntime(null);
  const hydratedPulsePresetId = shouldHydrateHiddenPulseWorkspaceState
    ? workspaceActivePulsePresetId
    : null;
  const persistedPulsePresetId = asNullableString(agentRuntimes?.pulsePresetId)?.trim() || null;
  const persistedPulseSessionInstanceId =
    asNullableString(agentRuntimes?.pulseSessionInstanceId)?.trim() || null;
  const hasHydratedPulseRuntimeAuthority =
    hydratedPulsePresetId !== null &&
    persistedPulsePresetId === hydratedPulsePresetId &&
    persistedPulseSessionInstanceId === workspacePulseSessionInstanceId &&
    Boolean(agentRuntimes?.pulse);
  const candidatePulseRuntime = hasHydratedPulseRuntimeAuthority
    ? coerceHydratedRuntimeChatMode(buildHydratedAgentRuntime(agentRuntimes?.pulse), {
        forceChatModeEnabled: true,
      })
    : defaultAgentRuntime;
  const hydratedAgentRuntimes = {
    standard: agentRuntimes?.standard
      ? buildHydratedAgentRuntime(agentRuntimes.standard)
      : defaultAgentRuntime,
    pulsePresetId: hydratedPulsePresetId,
    pulseSessionInstanceId: hydratedPulsePresetId ? workspacePulseSessionInstanceId : null,
    pulse:
      hasHydratedPulseRuntimeAuthority &&
      isHydratedPulseRuntimeAuthorizedForPreset(
        candidatePulseRuntime,
        hydratedPulsePresetId,
        workspacePulseSessionInstanceId,
        persistedPulseSessionInstanceId
      )
        ? candidatePulseRuntime
        : defaultAgentRuntime,
  };
  const resolvedWorkspacePulseState = resolveHydratedPulseRuntimeState({
    expertCreateMode: workspaceExpertCreateMode,
    workspaceActivePulsePresetId,
    workspacePulseSessionInstanceId: workspacePulseSessionInstanceId,
    sessionId: snapshot.sessionId,
    updatedAt: snapshot.updatedAt,
  });
  const resolvedWorkspaceActivePulsePresetId = resolvedWorkspacePulseState.activePulsePresetId;
  const resolvedWorkspacePulseSessionInstanceId =
    resolvedWorkspacePulseState.pulseSessionInstanceId;
  const resolvedWorkspaceSelectedTool = normalizeSelectedToolForExpertCreateMode(
    workspaceExpertCreateMode,
    asToolId(workspace.selectedTool)
  );
  const visibleReferenceImageUrl = sanitizeHydratedMediaUrl(
    asNullableString(workspace.referenceImageUrl)
  );
  const visibleExtraImageUrls = asExtraImageUrls(workspace.extraImageUrls);
  const visibleMotionReferenceVideoUrl = sanitizeHydratedMediaUrl(
    asNullableString(workspace.motionReferenceVideoUrl)
  );
  const rawCreateModeReferenceStates = (workspace as { createModeReferenceStates?: unknown })
    .createModeReferenceStates;
  const hydratedCreateModeReferenceStates: AiStudioSessionCreateModeReferenceStatesV1 = {
    standard: asCreateModeReferenceState(
      (rawCreateModeReferenceStates as { standard?: unknown } | undefined)?.standard
    ) ?? {
      selectedTool:
        workspaceExpertCreateMode === "standard" ? resolvedWorkspaceSelectedTool : "create",
      showCreateTools: false,
      referenceImageUrl: workspaceExpertCreateMode === "standard" ? visibleReferenceImageUrl : null,
      extraImageUrls:
        workspaceExpertCreateMode === "standard"
          ? visibleExtraImageUrls
          : createEmptyExpertEditSecondaryImageUrls(),
      referenceImageInternalMediaRefs:
        workspaceExpertCreateMode === "standard"
          ? normalizeInternalMediaRefList(
              (workspace as { referenceImageInternalMediaRefs?: unknown })
                .referenceImageInternalMediaRefs,
              11
            )
          : [],
      motionReferenceVideoUrl:
        workspaceExpertCreateMode === "standard" ? visibleMotionReferenceVideoUrl : null,
      useReferenceImageIndicator: false,
      detailOutputId: null,
    },
    pulse: asCreateModeReferenceState(
      (rawCreateModeReferenceStates as { pulse?: unknown } | undefined)?.pulse
    ) ?? {
      selectedTool:
        workspaceExpertCreateMode === "pulse" ? resolvedWorkspaceSelectedTool : "create",
      showCreateTools: false,
      referenceImageUrl: workspaceExpertCreateMode === "pulse" ? visibleReferenceImageUrl : null,
      extraImageUrls:
        workspaceExpertCreateMode === "pulse"
          ? visibleExtraImageUrls
          : createEmptyExpertEditSecondaryImageUrls(),
      referenceImageInternalMediaRefs:
        workspaceExpertCreateMode === "pulse"
          ? normalizeInternalMediaRefList(
              (workspace as { referenceImageInternalMediaRefs?: unknown })
                .referenceImageInternalMediaRefs,
              11
            )
          : [],
      motionReferenceVideoUrl:
        workspaceExpertCreateMode === "pulse" ? visibleMotionReferenceVideoUrl : null,
      useReferenceImageIndicator: false,
      detailOutputId: null,
    },
  };
  const activeAgentRuntime =
    workspaceExpertCreateMode === "pulse"
      ? hydratedAgentRuntimes.pulse
      : hydratedAgentRuntimes.standard;
  const lipSyncAudioUrl = sanitizeHydratedMediaUrl(asNullableString(workspace.lipSyncAudioUrl));
  const lipSyncAudioStoragePath =
    asNullableString(
      (workspace as { lipSyncAudioStoragePath?: unknown }).lipSyncAudioStoragePath
    )?.trim() || null;

  return {
    workspace: {
      mode: asMode(workspace.mode),
      selectedTool: resolvedWorkspaceSelectedTool,
      prompt:
        workspaceExpertCreateMode === "pulse" ? workspacePulsePrompt : workspaceStandardPrompt,
      standardPrompt: workspaceStandardPrompt,
      pulsePrompt: workspacePulsePrompt,
      model: normalizeAiStudioRestoredModelId(asNullableString(workspace.model)) ?? null,
      aspect: asString(workspace.aspect, FALLBACK_ASPECT),
      selectedCharacterId: asNullableString(workspace.selectedCharacterId)?.trim() || null,
      selectedCharacterLookId: asNullableString(workspace.selectedCharacterLookId)?.trim() || null,
      expertCreateMode: workspaceExpertCreateMode,
      activePulsePresetId: resolvedWorkspaceActivePulsePresetId,
      pulseSessionInstanceId: resolvedWorkspacePulseSessionInstanceId,
      createModeReferenceStates: hydratedCreateModeReferenceStates,
      referenceImageUrl: visibleReferenceImageUrl,
      extraImageUrls: visibleExtraImageUrls,
      referenceImageInternalMediaRefs: normalizeInternalMediaRefList(
        (workspace as { referenceImageInternalMediaRefs?: unknown })
          .referenceImageInternalMediaRefs,
        11
      ),
      editReferenceText: asString(workspace.editReferenceText, ""),
      videoReferenceText: asString(workspace.videoReferenceText, ""),
      videoReferenceMode: asVideoReferenceMode(workspace.videoReferenceMode),
      lipSyncAudioUrl,
      lipSyncAudioStoragePath,
      lipSyncAudioDurationMs:
        (lipSyncAudioUrl || lipSyncAudioStoragePath) &&
        typeof workspace.lipSyncAudioDurationMs === "number" &&
        Number.isFinite(workspace.lipSyncAudioDurationMs)
          ? workspace.lipSyncAudioDurationMs
          : null,
      lipSyncTurboMode: asBoolean(workspace.lipSyncTurboMode),
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
      motionReferenceVideoUrl: visibleMotionReferenceVideoUrl,
      rightRailLayout: sanitizeRightRailLayoutSnapshot(
        (workspace as { rightRailLayout?: unknown }).rightRailLayout
      ),
    },
    outputs: {
      active: activeOutputs,
      archived: archivedOutputs,
      activeOutputId,
      curatedReferenceIds: resolveHydratedCuratedReferenceIds({
        rawCuratedReferenceIds: outputs.curatedReferenceIds,
        activeOutputs,
        archivedOutputs,
        allOutputIds,
      }),
      removedFromAllRefsIds: asStringArray(outputs.removedFromAllRefsIds).filter((id) =>
        allOutputIds.has(id)
      ),
    },
    agent: activeAgentRuntime,
    agentRuntimes: hydratedAgentRuntimes,
    pulseChats,
    canvas,
    expertEdit,
  };
};
