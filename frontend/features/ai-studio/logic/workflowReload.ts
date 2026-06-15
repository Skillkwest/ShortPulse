/**
 * Workflow reload metadata helpers for generated AI Studio references.
 * Keeps manual navigate-and-hydrate reload separate from immediate reroll replay.
 */
import { normalizeInternalMediaRefList } from "../../../lib/media/internalMediaRefs";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputCharacterContext,
  StudioOutputStyleContext,
  ToolId,
  WorkflowReloadConfigV1,
  WorkflowReloadCreateMode,
  WorkflowReloadExpertEditReferences,
  WorkflowReloadImagePayload,
  WorkflowReloadKlingPromptShot,
  WorkflowReloadMediaKindHint,
  WorkflowReloadMusicComposerMode,
  WorkflowReloadMusicFormat,
  WorkflowReloadMusicMode,
  WorkflowReloadMusicPayload,
  WorkflowReloadMusicSongBatchCount,
  WorkflowReloadMusicStructure,
  WorkflowReloadPanelKind,
  WorkflowReloadPayload,
  WorkflowReloadSeedance2InputMode,
  WorkflowReloadSoundEffectFormat,
  WorkflowReloadSoundEffectsPayload,
  WorkflowReloadVideoFrameSlot,
  WorkflowReloadVideoKlingElementSlot,
  WorkflowReloadVideoMediaSlot,
  WorkflowReloadVideoPayload,
  WorkflowReloadVideoReferenceMode,
  WorkflowReloadVideoReferences,
  WorkflowReloadVoiceChangerPayload,
  WorkflowReloadVoiceChangerSource,
  WorkflowReloadVoiceoverPayload,
} from "../types";
import { MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT } from "./expertEditReferenceSlots";
import { isGenerationReplayConfigV1, isGenerationReplayConfigV2 } from "./generationReplay";
import { isNonDurableLipSyncAudioUrl, normalizeLipSyncAudioStoragePath } from "./lipSyncAudioState";
import { isAudioUrl, isVideoUrl } from "./stateParsers";

export type BuildWorkflowReloadConfigV1Input = {
  capturedAt?: string;
  originTool: ToolId | null | undefined;
  panelKind: WorkflowReloadPanelKind | null | undefined;
  outputMode: StudioMode | null | undefined;
  projectId?: string | null;
  createMode?: WorkflowReloadCreateMode | null;
  pulse?: WorkflowReloadConfigV1["pulse"];
  prompt: {
    display: string;
    submission?: string | null;
  };
  model: {
    id: string | null | undefined;
  };
  payload: WorkflowReloadPayload;
};

const VALID_ORIGIN_TOOLS = new Set<ToolId>([
  "create",
  "image",
  "video",
  "kling",
  "edit",
  "text-to-speech",
  "voice-changer",
  "sound-effects",
  "music",
]);

const VALID_PANEL_KINDS = new Set<WorkflowReloadPanelKind>([
  "create",
  "edit",
  "video",
  "music",
  "sound-effects",
  "voices",
]);

const VALID_OUTPUT_MODES = new Set<StudioMode>(["image", "video", "audio", "text"]);
const MAX_WORKFLOW_RELOAD_REFERENCE_INPUTS = 16;
const MAX_VIDEO_RELOAD_ELEMENT_SLOTS = 6;
const MAX_VIDEO_RELOAD_MEDIA_SLOTS = 16;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  return asTrimmedString(value);
};

const asBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asFiniteNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asIntegerOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const asStringArray = (value: unknown, limit = MAX_WORKFLOW_RELOAD_REFERENCE_INPUTS): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item));
};

const asPlainObject = (value: unknown): Record<string, unknown> | undefined =>
  isObject(value) ? { ...value } : undefined;

const isLocalOnlyUrl = (value: string) => /^blob:|^data:/i.test(value);

const INVALID_OPTIONAL_STRING = Symbol("invalid_optional_string");

const asOptionalNullableStringField = (
  record: Record<string, unknown>,
  key: string
): string | null | undefined | typeof INVALID_OPTIONAL_STRING => {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (value == null) return null;
  return typeof value === "string" ? value : INVALID_OPTIONAL_STRING;
};

const normalizeCharacterContext = (value: unknown): StudioOutputCharacterContext | null => {
  if (!isObject(value) || typeof value.applied !== "boolean") return null;
  const characterId = asOptionalNullableStringField(value, "characterId");
  const characterName = asOptionalNullableStringField(value, "characterName");
  const lookId = asOptionalNullableStringField(value, "lookId");
  const lookName = asOptionalNullableStringField(value, "lookName");
  const characterProfileImageUrl = asOptionalNullableStringField(value, "characterProfileImageUrl");
  if (
    characterId === INVALID_OPTIONAL_STRING ||
    characterName === INVALID_OPTIONAL_STRING ||
    lookId === INVALID_OPTIONAL_STRING ||
    lookName === INVALID_OPTIONAL_STRING ||
    characterProfileImageUrl === INVALID_OPTIONAL_STRING
  ) {
    return null;
  }
  return {
    applied: value.applied,
    ...(characterId !== undefined ? { characterId } : {}),
    ...(characterName !== undefined ? { characterName } : {}),
    ...(lookId !== undefined ? { lookId } : {}),
    ...(lookName !== undefined ? { lookName } : {}),
    ...(characterProfileImageUrl !== undefined ? { characterProfileImageUrl } : {}),
  };
};

const normalizeStyleContext = (value: unknown): StudioOutputStyleContext | null => {
  if (!isObject(value) || typeof value.applied !== "boolean") return null;
  const styleId = asOptionalNullableStringField(value, "styleId");
  const styleName = asOptionalNullableStringField(value, "styleName");
  const stylePrompt = asOptionalNullableStringField(value, "stylePrompt");
  const stylePreviewImageUrl = asOptionalNullableStringField(value, "stylePreviewImageUrl");
  if (
    styleId === INVALID_OPTIONAL_STRING ||
    styleName === INVALID_OPTIONAL_STRING ||
    stylePrompt === INVALID_OPTIONAL_STRING ||
    stylePreviewImageUrl === INVALID_OPTIONAL_STRING
  ) {
    return null;
  }
  return {
    applied: value.applied,
    ...(styleId !== undefined ? { styleId } : {}),
    ...(styleName !== undefined ? { styleName } : {}),
    ...(stylePrompt !== undefined ? { stylePrompt } : {}),
    ...(stylePreviewImageUrl !== undefined ? { stylePreviewImageUrl } : {}),
  };
};

const normalizeInternalRefs = (value: unknown, limit = MAX_WORKFLOW_RELOAD_REFERENCE_INPUTS) =>
  normalizeInternalMediaRefList(value, limit);

const hasValidInternalRefs = (
  value: unknown,
  limit = MAX_WORKFLOW_RELOAD_REFERENCE_INPUTS
): boolean => {
  if (value == null) return true;
  if (!Array.isArray(value)) return false;
  return normalizeInternalRefs(value, limit).length === value.slice(0, limit).length;
};

const isOriginTool = (value: unknown): value is ToolId =>
  typeof value === "string" && VALID_ORIGIN_TOOLS.has(value as ToolId);

const isPanelKind = (value: unknown): value is WorkflowReloadPanelKind =>
  typeof value === "string" && VALID_PANEL_KINDS.has(value as WorkflowReloadPanelKind);

const isOutputMode = (value: unknown): value is StudioMode =>
  typeof value === "string" && VALID_OUTPUT_MODES.has(value as StudioMode);

const isCreateMode = (value: unknown): value is WorkflowReloadCreateMode =>
  value === "standard" || value === "pulse";

const toCapturedAt = (value: unknown): string => asTrimmedString(value) ?? new Date().toISOString();

const normalizePrompt = (value: unknown): WorkflowReloadConfigV1["prompt"] | null => {
  if (!isObject(value)) return null;
  const display = typeof value.display === "string" ? value.display : null;
  if (display == null) return null;
  const submission = typeof value.submission === "string" ? value.submission : null;
  return {
    display,
    ...(submission != null ? { submission } : {}),
  };
};

const normalizeModel = (value: unknown): WorkflowReloadConfigV1["model"] | null => {
  if (!isObject(value)) return null;
  const id = asTrimmedString(value.id);
  return id ? { id } : null;
};

const normalizePulse = (value: unknown): WorkflowReloadConfigV1["pulse"] => {
  if (value == null) return null;
  if (!isObject(value)) return null;
  return {
    presetId: asOptionalString(value.presetId),
    presetLabel: asOptionalString(value.presetLabel),
    pulseKind: asOptionalString(value.pulseKind),
  };
};

const isReplaySubmitTool = (value: unknown): value is WorkflowReloadImagePayload["submitTool"] =>
  value === "create" || value === "image" || value === "edit";

const normalizeExpertEditReferences = (
  value: unknown,
  referenceInputCount: number
): WorkflowReloadExpertEditReferences | null => {
  if (value == null) return null;
  if (!isObject(value) || value.version !== 1) return null;
  const primaryReferenceInputIndex = asIntegerOrNull(value.primaryReferenceInputIndex);
  const normalizedPrimaryReferenceInputIndex =
    primaryReferenceInputIndex != null &&
    primaryReferenceInputIndex >= 0 &&
    primaryReferenceInputIndex < referenceInputCount
      ? primaryReferenceInputIndex
      : null;
  const seenSlots = new Set<number>();
  const secondarySlots: WorkflowReloadExpertEditReferences["secondarySlots"] = [];
  const seenRestoreSlots = new Set<number>();
  const restoreSecondarySlots: NonNullable<
    WorkflowReloadExpertEditReferences["restoreSecondarySlots"]
  > = [];
  if (Array.isArray(value.secondarySlots)) {
    value.secondarySlots.forEach((item) => {
      if (!isObject(item)) return;
      const slotIndex = asIntegerOrNull(item.slotIndex);
      const referenceInputIndex = asIntegerOrNull(item.referenceInputIndex);
      if (
        slotIndex == null ||
        slotIndex < 0 ||
        slotIndex >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT ||
        referenceInputIndex == null ||
        referenceInputIndex < 0 ||
        referenceInputIndex >= referenceInputCount ||
        seenSlots.has(slotIndex)
      ) {
        return;
      }
      seenSlots.add(slotIndex);
      const internalMediaRef = normalizeInternalRefs([item.internalMediaRef], 1)[0] ?? null;
      secondarySlots.push({
        slotIndex,
        referenceInputIndex,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      });
    });
  }
  if (Array.isArray(value.restoreSecondarySlots)) {
    value.restoreSecondarySlots.forEach((item) => {
      if (!isObject(item)) return;
      const slotIndex = asIntegerOrNull(item.slotIndex);
      const sourceUrl = asTrimmedString(item.sourceUrl);
      if (
        slotIndex == null ||
        slotIndex < 0 ||
        slotIndex >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT ||
        !sourceUrl ||
        seenRestoreSlots.has(slotIndex)
      ) {
        return;
      }
      const internalMediaRef = normalizeInternalRefs([item.internalMediaRef], 1)[0] ?? null;
      if (/^blob:|^data:/i.test(sourceUrl) && !internalMediaRef) return;
      seenRestoreSlots.add(slotIndex);
      restoreSecondarySlots.push({
        slotIndex,
        sourceUrl,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      });
    });
  }
  secondarySlots.sort((left, right) => left.slotIndex - right.slotIndex);
  restoreSecondarySlots.sort((left, right) => left.slotIndex - right.slotIndex);
  if (secondarySlots.length === 0 && restoreSecondarySlots.length === 0) return null;
  return {
    version: 1,
    maxSecondarySlotCount: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
    primaryReferenceInputIndex: normalizedPrimaryReferenceInputIndex,
    secondarySlots,
    ...(restoreSecondarySlots.length > 0 ? { restoreSecondarySlots } : {}),
  };
};

const normalizeImagePayload = (value: unknown): WorkflowReloadImagePayload | null => {
  if (!isObject(value) || value.kind !== "image") return null;
  if (!isReplaySubmitTool(value.submitTool)) return null;
  const aspect = asTrimmedString(value.aspect);
  if (!aspect) return null;
  if (!hasValidInternalRefs(value.internalMediaRefs)) return null;
  const referenceInputs = asStringArray(value.referenceInputs);
  const expertEditReferences = normalizeExpertEditReferences(
    value.expertEditReferences,
    referenceInputs.length
  );
  const characterContext = normalizeCharacterContext(value.characterContext);
  const styleContext = normalizeStyleContext(value.styleContext);
  return {
    kind: "image",
    submitTool: value.submitTool,
    aspect,
    imageResolution: typeof value.imageResolution === "string" ? value.imageResolution : null,
    referenceInputs,
    internalMediaRefs: normalizeInternalRefs(value.internalMediaRefs),
    ...(expertEditReferences ? { expertEditReferences } : {}),
    ...(characterContext ? { characterContext } : {}),
    ...(styleContext ? { styleContext } : {}),
  };
};

const isVideoReferenceMode = (value: unknown): value is WorkflowReloadVideoReferenceMode =>
  value === "standard" ||
  value === "modify" ||
  value === "keyframes" ||
  value === "kling3" ||
  value === "motion" ||
  value === "lip-sync";

const isSeedance2InputMode = (value: unknown): value is WorkflowReloadSeedance2InputMode =>
  value === "text" || value === "first-frame" || value === "first-last" || value === "multimodal";

const isKlingWorkflowMode = (
  value: unknown
): value is NonNullable<WorkflowReloadVideoPayload["klingWorkflowMode"]> =>
  value === "single" || value === "multi" || value === "custom";

const isKlingShotType = (
  value: unknown
): value is NonNullable<WorkflowReloadVideoPayload["klingShotType"]> =>
  value === "customize" || value === "intelligent";

const normalizeKlingPromptShots = (value: unknown): WorkflowReloadKlingPromptShot[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item)) return null;
      const id = asTrimmedString(item.id);
      const prompt = typeof item.prompt === "string" ? item.prompt : null;
      const duration = asFiniteNumberOrNull(item.duration);
      if (!id || prompt == null || duration == null) return null;
      return { id, prompt, duration };
    })
    .filter((item): item is WorkflowReloadKlingPromptShot => Boolean(item));
};

const normalizeKlingVoiceIds = (value: unknown): [string, string] | null => {
  if (!Array.isArray(value) || value.length < 2) return null;
  const first = asTrimmedString(value[0]);
  const second = asTrimmedString(value[1]);
  return first && second ? [first, second] : null;
};

const normalizeKlingElements = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((item) => ({ ...item }));
};

const splitReferenceImageUrls = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const normalizeVideoFrameSlot = (value: unknown): WorkflowReloadVideoFrameSlot | null => {
  if (!isObject(value)) return null;
  const sourceUrl = asTrimmedString(value.sourceUrl);
  if (!sourceUrl) return null;
  const internalMediaRef = normalizeInternalRefs([value.internalMediaRef], 1)[0] ?? null;
  if (isLocalOnlyUrl(sourceUrl) && !internalMediaRef) return null;
  return {
    sourceUrl,
    ...(internalMediaRef ? { internalMediaRef } : {}),
  };
};

const normalizeVideoMediaSlots = (value: unknown): WorkflowReloadVideoMediaSlot[] => {
  if (!Array.isArray(value)) return [];
  const seenSlots = new Set<number>();
  return value
    .slice(0, MAX_VIDEO_RELOAD_MEDIA_SLOTS)
    .reduce<WorkflowReloadVideoMediaSlot[]>((slots, item) => {
      if (!isObject(item)) return slots;
      const slotIndex = asIntegerOrNull(item.slotIndex);
      const sourceUrl = asTrimmedString(item.sourceUrl);
      if (
        slotIndex == null ||
        slotIndex < 0 ||
        slotIndex >= MAX_VIDEO_RELOAD_MEDIA_SLOTS ||
        !sourceUrl ||
        seenSlots.has(slotIndex)
      ) {
        return slots;
      }
      const internalMediaRef = normalizeInternalRefs([item.internalMediaRef], 1)[0] ?? null;
      if (isLocalOnlyUrl(sourceUrl) && !internalMediaRef) return slots;
      seenSlots.add(slotIndex);
      slots.push({
        slotIndex,
        sourceUrl,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      });
      return slots;
    }, [])
    .sort((left, right) => left.slotIndex - right.slotIndex);
};

const normalizeVideoKlingElementSlot = (
  value: unknown
): WorkflowReloadVideoKlingElementSlot | null => {
  if (!isObject(value) || !isObject(value.element)) return null;
  const slotIndex = asIntegerOrNull(value.slotIndex);
  if (slotIndex == null || slotIndex < 0 || slotIndex >= MAX_VIDEO_RELOAD_ELEMENT_SLOTS) {
    return null;
  }
  const element: WorkflowReloadVideoKlingElementSlot["element"] = {
    ...value.element,
    slotIndex,
  };
  const profileImageInternalMediaRef =
    normalizeInternalRefs([value.profileImageInternalMediaRef], 1)[0] ?? null;
  const frontalImageInternalMediaRef =
    normalizeInternalRefs([value.frontalImageInternalMediaRef], 1)[0] ?? null;
  const videoInternalMediaRef = normalizeInternalRefs([value.videoInternalMediaRef], 1)[0] ?? null;
  const referenceImageInternalMediaRefs = normalizeInternalRefs(
    value.referenceImageInternalMediaRefs,
    MAX_WORKFLOW_RELOAD_REFERENCE_INPUTS
  );
  const profileImageUrl = asOptionalString(element.profileImageUrl);
  if (profileImageUrl && isLocalOnlyUrl(profileImageUrl) && !profileImageInternalMediaRef) {
    element.profileImageUrl = null;
  }
  const frontalImageUrl = asOptionalString(element.frontalImageUrl);
  if (frontalImageUrl && isLocalOnlyUrl(frontalImageUrl) && !frontalImageInternalMediaRef) {
    element.frontalImageUrl = "";
  }
  const referenceImageUrls = splitReferenceImageUrls(element.referenceImageUrls);
  if (referenceImageUrls.length > 0) {
    const keptReferenceUrls: string[] = [];
    const keptReferenceRefs: Array<
      NonNullable<WorkflowReloadVideoKlingElementSlot["referenceImageInternalMediaRefs"]>[number]
    > = [];
    referenceImageUrls.forEach((url, index) => {
      const internalMediaRef = referenceImageInternalMediaRefs[index] ?? null;
      if (isLocalOnlyUrl(url) && !internalMediaRef) return;
      keptReferenceUrls.push(url);
      keptReferenceRefs.push(internalMediaRef);
    });
    element.referenceImageUrls = keptReferenceUrls.join(", ");
    referenceImageInternalMediaRefs.splice(
      0,
      referenceImageInternalMediaRefs.length,
      ...keptReferenceRefs
    );
  }
  const videoUrl = asOptionalString(element.videoUrl);
  if (videoUrl && isLocalOnlyUrl(videoUrl) && !videoInternalMediaRef) {
    element.videoUrl = "";
  }
  const hasMedia =
    Boolean(asOptionalString(element.profileImageUrl)) ||
    Boolean(asOptionalString(element.frontalImageUrl)) ||
    splitReferenceImageUrls(element.referenceImageUrls).length > 0 ||
    Boolean(asOptionalString(element.videoUrl));
  const hasSavedSource =
    Boolean(asOptionalString(element.sourceElementId)) ||
    Boolean(asOptionalString(element.sourceCharacterId));
  if (!hasMedia && !hasSavedSource) return null;
  return {
    slotIndex,
    element,
    ...(profileImageInternalMediaRef ? { profileImageInternalMediaRef } : {}),
    ...(frontalImageInternalMediaRef ? { frontalImageInternalMediaRef } : {}),
    ...(referenceImageInternalMediaRefs.length > 0 ? { referenceImageInternalMediaRefs } : {}),
    ...(videoInternalMediaRef ? { videoInternalMediaRef } : {}),
  };
};

const normalizeVideoReferences = (value: unknown): WorkflowReloadVideoReferences | null => {
  if (value == null) return null;
  if (!isObject(value) || value.version !== 1) return null;
  const firstFrame = normalizeVideoFrameSlot(value.firstFrame);
  const lastFrame = normalizeVideoFrameSlot(value.lastFrame);
  const seedance2ReferenceImages = normalizeVideoMediaSlots(value.seedance2ReferenceImages);
  const seedance2ReferenceVideos = normalizeVideoMediaSlots(value.seedance2ReferenceVideos);
  const seedance2ReferenceAudio = normalizeVideoMediaSlots(value.seedance2ReferenceAudio);
  const seenElementSlots = new Set<number>();
  const klingElementSlots = Array.isArray(value.klingElementSlots)
    ? value.klingElementSlots
        .map((item) => normalizeVideoKlingElementSlot(item))
        .filter((item): item is WorkflowReloadVideoKlingElementSlot => {
          if (!item || seenElementSlots.has(item.slotIndex)) return false;
          seenElementSlots.add(item.slotIndex);
          return true;
        })
        .sort((left, right) => left.slotIndex - right.slotIndex)
    : [];
  if (
    !firstFrame &&
    !lastFrame &&
    seedance2ReferenceImages.length === 0 &&
    seedance2ReferenceVideos.length === 0 &&
    seedance2ReferenceAudio.length === 0 &&
    klingElementSlots.length === 0
  ) {
    return null;
  }
  return {
    version: 1,
    ...(firstFrame ? { firstFrame } : {}),
    ...(lastFrame ? { lastFrame } : {}),
    ...(seedance2ReferenceImages.length > 0 ? { seedance2ReferenceImages } : {}),
    ...(seedance2ReferenceVideos.length > 0 ? { seedance2ReferenceVideos } : {}),
    ...(seedance2ReferenceAudio.length > 0 ? { seedance2ReferenceAudio } : {}),
    ...(klingElementSlots.length > 0 ? { klingElementSlots } : {}),
  };
};

const normalizeVideoPayload = (value: unknown): WorkflowReloadVideoPayload | null => {
  if (!isObject(value) || value.kind !== "video") return null;
  const aspect = asTrimmedString(value.aspect);
  if (!aspect || !isVideoReferenceMode(value.videoReferenceMode)) return null;
  if (!hasValidInternalRefs(value.internalMediaRefs)) return null;
  const videoReferenceMode = value.videoReferenceMode;
  const requestedMotionReferenceVideoUrl =
    videoReferenceMode === "motion" ? asOptionalString(value.motionReferenceVideoUrl) : null;
  const requestedLipSyncAudioUrl =
    videoReferenceMode === "lip-sync" ? asOptionalString(value.lipSyncAudioUrl) : null;
  const lipSyncAudioUrl =
    requestedLipSyncAudioUrl && !isNonDurableLipSyncAudioUrl(requestedLipSyncAudioUrl)
      ? requestedLipSyncAudioUrl
      : null;
  const lipSyncAudioStoragePath =
    videoReferenceMode === "lip-sync"
      ? normalizeLipSyncAudioStoragePath(value.lipSyncAudioStoragePath as string | null)
      : null;
  const videoReferences = normalizeVideoReferences(value.videoReferences);
  const styleContext = normalizeStyleContext(value.styleContext);
  return {
    kind: "video",
    aspect,
    videoReferenceMode,
    durationSeconds: asFiniteNumberOrNull(value.durationSeconds),
    resolution: asOptionalString(value.resolution),
    generateAudio: asBooleanOrNull(value.generateAudio),
    cameraFixed: asBooleanOrNull(value.cameraFixed),
    autoFix: asBooleanOrNull(value.autoFix),
    referenceInputs: asStringArray(value.referenceInputs),
    internalMediaRefs: normalizeInternalRefs(value.internalMediaRefs),
    ...(styleContext ? { styleContext } : {}),
    ...(videoReferences ? { videoReferences } : {}),
    motionReferenceVideoUrl: requestedMotionReferenceVideoUrl,
    lipSyncAudioUrl,
    lipSyncAudioStoragePath,
    lipSyncAudioDurationMs:
      lipSyncAudioUrl || lipSyncAudioStoragePath
        ? asFiniteNumberOrNull(value.lipSyncAudioDurationMs)
        : null,
    lipSyncTurboMode:
      videoReferenceMode === "lip-sync" ? asBooleanOrNull(value.lipSyncTurboMode) : null,
    seedance2InputMode: isSeedance2InputMode(value.seedance2InputMode)
      ? value.seedance2InputMode
      : null,
    seedance2ReferenceImageUrls: asStringArray(value.seedance2ReferenceImageUrls),
    seedance2ReferenceVideoUrls: asStringArray(value.seedance2ReferenceVideoUrls),
    seedance2ReferenceAudioUrls: asStringArray(value.seedance2ReferenceAudioUrls),
    seedance2ReturnLastFrame: asBooleanOrNull(value.seedance2ReturnLastFrame),
    seedance2WebSearch: asBooleanOrNull(value.seedance2WebSearch),
    klingNegativePrompt: asOptionalString(value.klingNegativePrompt),
    klingCfgScale: asFiniteNumberOrNull(value.klingCfgScale),
    klingWorkflowMode: isKlingWorkflowMode(value.klingWorkflowMode)
      ? value.klingWorkflowMode
      : null,
    klingShotType: isKlingShotType(value.klingShotType) ? value.klingShotType : null,
    klingVoiceIds: normalizeKlingVoiceIds(value.klingVoiceIds),
    klingMultiPrompts: normalizeKlingPromptShots(value.klingMultiPrompts),
    klingElements: normalizeKlingElements(value.klingElements),
  };
};

const isMusicMode = (value: unknown): value is WorkflowReloadMusicMode =>
  value === "instrumental" || value === "vocal";

const isMusicStructure = (value: unknown): value is WorkflowReloadMusicStructure =>
  value === "loop" || value === "full-track" || value === "cinematic";

const isMusicFormat = (value: unknown): value is WorkflowReloadMusicFormat =>
  value === "mp3_44100_128" || value === "wav_48000";

const isMusicComposerMode = (value: unknown): value is WorkflowReloadMusicComposerMode =>
  value === "simple" || value === "custom";

const isMusicSongBatchCount = (value: unknown): value is WorkflowReloadMusicSongBatchCount =>
  value === 1 || value === 2 || value === 3 || value === 4;

const normalizeMusicPayload = (value: unknown): WorkflowReloadMusicPayload | null => {
  if (!isObject(value) || value.kind !== "music") return null;
  const text = typeof value.text === "string" ? value.text : null;
  if (text == null) return null;
  return {
    kind: "music",
    text,
    lyrics: typeof value.lyrics === "string" ? value.lyrics : "",
    durationSeconds: asFiniteNumberOrNull(value.durationSeconds),
    bpm: asFiniteNumberOrNull(value.bpm),
    mode: isMusicMode(value.mode) ? value.mode : null,
    structure: isMusicStructure(value.structure) ? value.structure : null,
    energyPercent: asFiniteNumberOrNull(value.energyPercent),
    outputFormat: isMusicFormat(value.outputFormat) ? value.outputFormat : null,
    composerMode: isMusicComposerMode(value.composerMode) ? value.composerMode : null,
    instrumentalEnabled: asBooleanOrNull(value.instrumentalEnabled),
    singerEnabled: asBooleanOrNull(value.singerEnabled),
    songBatchCount: isMusicSongBatchCount(value.songBatchCount) ? value.songBatchCount : null,
  };
};

const isSoundEffectFormat = (value: unknown): value is WorkflowReloadSoundEffectFormat =>
  value === "mp3_44100_128" || value === "pcm_48000";

const normalizeSoundEffectsPayload = (value: unknown): WorkflowReloadSoundEffectsPayload | null => {
  if (!isObject(value) || value.kind !== "sound-effects") return null;
  const text = typeof value.text === "string" ? value.text : null;
  if (text == null) return null;
  return {
    kind: "sound-effects",
    text,
    durationSeconds: asFiniteNumberOrNull(value.durationSeconds),
    loop: asBooleanOrNull(value.loop),
    promptInfluence: asFiniteNumberOrNull(value.promptInfluence),
    outputFormat: isSoundEffectFormat(value.outputFormat) ? value.outputFormat : null,
  };
};

const normalizeVoiceoverPayload = (value: unknown): WorkflowReloadVoiceoverPayload | null => {
  if (!isObject(value) || value.kind !== "voiceover") return null;
  const script = typeof value.script === "string" ? value.script : null;
  const voiceId = asTrimmedString(value.voiceId);
  const voiceName = asTrimmedString(value.voiceName);
  const outputFormat = asTrimmedString(value.outputFormat);
  if (script == null || !voiceId || !voiceName || !outputFormat) return null;
  return {
    kind: "voiceover",
    script,
    voiceId,
    voiceName,
    outputFormat,
    config: asPlainObject(value.config),
  };
};

const normalizeVoiceChangerSource = (value: unknown): WorkflowReloadVoiceChangerSource | null => {
  if (!isObject(value)) return null;
  const internalRefsValid = hasValidInternalRefs([value.internalMediaRef], 1);
  const extractedFrom = isObject(value.extractedFrom) ? value.extractedFrom : null;
  const extractedInternalRefsValid =
    !extractedFrom || hasValidInternalRefs([extractedFrom.internalMediaRef], 1);
  if (!internalRefsValid || !extractedInternalRefsValid) return null;
  return {
    name: asOptionalString(value.name),
    origin: asOptionalString(value.origin),
    sourceUrl: asOptionalString(value.sourceUrl),
    storagePath: asOptionalString(value.storagePath),
    internalMediaRef: normalizeInternalRefs([value.internalMediaRef], 1)[0] ?? null,
    referenceOutputId: asOptionalString(value.referenceOutputId),
    referenceMediaId: asOptionalString(value.referenceMediaId),
    mimeType: asOptionalString(value.mimeType),
    aspect: asOptionalString(value.aspect),
    extractedFrom: extractedFrom
      ? {
          name: asOptionalString(extractedFrom.name),
          sourceUrl: asOptionalString(extractedFrom.sourceUrl),
          storagePath: asOptionalString(extractedFrom.storagePath),
          internalMediaRef: normalizeInternalRefs([extractedFrom.internalMediaRef], 1)[0] ?? null,
          referenceOutputId: asOptionalString(extractedFrom.referenceOutputId),
          referenceMediaId: asOptionalString(extractedFrom.referenceMediaId),
          mimeType: asOptionalString(extractedFrom.mimeType),
          aspect: asOptionalString(extractedFrom.aspect),
        }
      : null,
  };
};

const normalizeVoiceChangerPayload = (value: unknown): WorkflowReloadVoiceChangerPayload | null => {
  if (!isObject(value) || value.kind !== "voice-changer") return null;
  const source = normalizeVoiceChangerSource(value.source);
  const voiceId = asTrimmedString(value.voiceId);
  const voiceName = asTrimmedString(value.voiceName);
  const outputFormat = asTrimmedString(value.outputFormat);
  const modelId = asTrimmedString(value.modelId);
  if (!source || !voiceId || !voiceName || !outputFormat || !modelId) return null;
  return {
    kind: "voice-changer",
    source,
    voiceId,
    voiceName,
    outputFormat,
    modelId,
    inputFormat: asOptionalString(value.inputFormat),
    removeBackgroundNoise: asBooleanOrNull(value.removeBackgroundNoise),
    voiceSettings: asPlainObject(value.voiceSettings),
  };
};

const normalizePayload = (value: unknown): WorkflowReloadPayload | null => {
  if (!isObject(value)) return null;
  switch (value.kind) {
    case "image":
      return normalizeImagePayload(value);
    case "video":
      return normalizeVideoPayload(value);
    case "music":
      return normalizeMusicPayload(value);
    case "sound-effects":
      return normalizeSoundEffectsPayload(value);
    case "voiceover":
      return normalizeVoiceoverPayload(value);
    case "voice-changer":
      return normalizeVoiceChangerPayload(value);
    default:
      return null;
  }
};

const isPayloadCompatibleWithOutputMode = (
  payload: WorkflowReloadPayload,
  outputMode: StudioMode
): boolean => {
  if (payload.kind === "image") return outputMode === "image";
  if (payload.kind === "video") return outputMode === "video";
  return outputMode === "audio";
};

export type ResolveWorkflowReloadConfigOptions = {
  mediaKindHint?: WorkflowReloadMediaKindHint | null;
};

export const buildWorkflowReloadConfigV1 = ({
  capturedAt,
  originTool,
  panelKind,
  outputMode,
  projectId,
  createMode,
  pulse,
  prompt,
  model,
  payload,
}: BuildWorkflowReloadConfigV1Input): WorkflowReloadConfigV1 | null => {
  if (!isOriginTool(originTool) || !isPanelKind(panelKind) || !isOutputMode(outputMode)) {
    return null;
  }
  const normalizedModel = normalizeModel(model);
  const normalizedPayload = normalizePayload(payload);
  if (!normalizedModel || !normalizedPayload) return null;
  if (!isPayloadCompatibleWithOutputMode(normalizedPayload, outputMode)) return null;
  return {
    version: 1,
    source: "ai_studio_generation",
    capturedAt: toCapturedAt(capturedAt),
    originTool,
    panelKind,
    outputMode,
    restoreBehavior: "navigate_and_hydrate",
    projectId: asOptionalString(projectId),
    createMode: isCreateMode(createMode) ? createMode : null,
    pulse: normalizePulse(pulse),
    prompt: {
      display: typeof prompt.display === "string" ? prompt.display : "",
      ...(typeof prompt.submission === "string" ? { submission: prompt.submission } : {}),
    },
    model: normalizedModel,
    payload: normalizedPayload,
  };
};

export const isWorkflowReloadConfigV1 = (value: unknown): value is WorkflowReloadConfigV1 => {
  if (!isObject(value)) return false;
  return (
    value.version === 1 &&
    value.source === "ai_studio_generation" &&
    asTrimmedString(value.capturedAt) != null &&
    isOriginTool(value.originTool) &&
    isPanelKind(value.panelKind) &&
    isOutputMode(value.outputMode) &&
    value.restoreBehavior === "navigate_and_hydrate" &&
    (value.projectId == null || asTrimmedString(value.projectId) != null) &&
    (value.createMode == null || isCreateMode(value.createMode)) &&
    normalizePrompt(value.prompt) != null &&
    normalizeModel(value.model) != null &&
    (() => {
      const payload = normalizePayload(value.payload);
      return payload != null && isPayloadCompatibleWithOutputMode(payload, value.outputMode);
    })()
  );
};

export const deriveImageWorkflowReloadFromGenerationReplay = (
  replay: GenerationReplayConfig | undefined
): WorkflowReloadConfigV1 | null => {
  if (!isGenerationReplayConfigV1(replay) && !isGenerationReplayConfigV2(replay)) return null;
  return buildWorkflowReloadConfigV1({
    capturedAt: replay.capturedAt,
    originTool: replay.submitTool === "image" ? "edit" : replay.submitTool,
    panelKind: replay.submitTool === "edit" || replay.submitTool === "image" ? "edit" : "create",
    outputMode: "image",
    prompt: {
      display: replay.displayPrompt,
      submission: replay.submissionPrompt,
    },
    model: {
      id: replay.modelId,
    },
    payload: {
      kind: "image",
      submitTool: replay.submitTool,
      aspect: replay.aspect,
      imageResolution: replay.imageResolution,
      referenceInputs: replay.referenceInputs,
      internalMediaRefs: "internalMediaRefs" in replay ? replay.internalMediaRefs : undefined,
      characterContext: replay.characterContext,
      styleContext: replay.styleContext,
    },
  });
};

const VIDEO_MODEL_ID_PATTERN = /(?:kling|veo|seedance|omnihuman|video)/i;

const hasNonImageDelivery = (output: StudioOutput): boolean => {
  if (output.mode === "video" || output.mode === "audio") return true;
  const urls = [
    output.previewUrl,
    output.previewPosterUrl,
    output.previewStoragePath,
    output.fullStoragePath,
    output.localObjectUrl,
    ...(output.resultUrls ?? []),
  ];
  return urls.some((url) => Boolean(url && (isVideoUrl(url) || isAudioUrl(url))));
};

const asWorkflowReloadRecord = (value: unknown): Record<string, unknown> | null =>
  isObject(value) ? value : null;

const resolveVideoFallbackModelId = (
  output: StudioOutput,
  rawConfig: Record<string, unknown> | null,
  imageReload: WorkflowReloadConfigV1 | null
): string | null => {
  const outputModelId = asTrimmedString(output.modelId);
  if (outputModelId) return outputModelId;
  const rawModelId = normalizeModel(rawConfig?.model)?.id ?? null;
  if (rawModelId && VIDEO_MODEL_ID_PATTERN.test(rawModelId)) return rawModelId;
  const replayModelId = imageReload?.model.id ?? null;
  if (replayModelId && VIDEO_MODEL_ID_PATTERN.test(replayModelId)) return replayModelId;
  return null;
};

const deriveVideoWorkflowReloadFromOutput = (
  output: StudioOutput
): WorkflowReloadConfigV1 | null => {
  const rawConfig = asWorkflowReloadRecord(output.workflowReload);
  const rawPayload = asWorkflowReloadRecord(rawConfig?.payload);
  const rawPrompt = normalizePrompt(rawConfig?.prompt);
  const rawProjectId = asOptionalString(rawConfig?.projectId);

  if (rawPayload?.kind === "video") {
    const rawVideoModelId = normalizeModel(rawConfig?.model)?.id ?? asTrimmedString(output.modelId);
    if (rawVideoModelId) {
      const coercedVideoReload = buildWorkflowReloadConfigV1({
        capturedAt: asTrimmedString(rawConfig?.capturedAt) ?? undefined,
        originTool: isOriginTool(rawConfig?.originTool) ? rawConfig?.originTool : "video",
        panelKind: "video",
        outputMode: "video",
        projectId: rawProjectId,
        prompt: rawPrompt ?? { display: output.prompt },
        model: { id: rawVideoModelId },
        payload: rawPayload as unknown as WorkflowReloadVideoPayload,
      });
      if (coercedVideoReload) return coercedVideoReload;
    }
  }

  const imageReload =
    isWorkflowReloadConfigV1(output.workflowReload) &&
    output.workflowReload.payload.kind === "image"
      ? output.workflowReload
      : deriveImageWorkflowReloadFromGenerationReplay(output.generationReplay);
  const imagePayload = imageReload?.payload.kind === "image" ? imageReload.payload : null;
  const modelId = resolveVideoFallbackModelId(output, rawConfig, imageReload);
  const aspect = asTrimmedString(imagePayload?.aspect) ?? asTrimmedString(output.aspect);
  if (!modelId || !aspect) return null;

  const referenceInputs = imagePayload?.referenceInputs ?? [];
  const internalMediaRefs = imagePayload?.internalMediaRefs ?? [];
  const durationSeconds =
    typeof output.durationMs === "number" && Number.isFinite(output.durationMs)
      ? Math.max(0, Math.round(output.durationMs / 1000))
      : null;

  return buildWorkflowReloadConfigV1({
    capturedAt: imageReload?.capturedAt,
    originTool: "video",
    panelKind: "video",
    outputMode: "video",
    projectId: imageReload?.projectId ?? rawProjectId,
    prompt: imageReload?.prompt ?? rawPrompt ?? { display: output.prompt },
    model: { id: modelId },
    payload: {
      kind: "video",
      aspect,
      videoReferenceMode: referenceInputs.length >= 2 ? "keyframes" : "standard",
      durationSeconds,
      resolution: null,
      generateAudio: null,
      cameraFixed: null,
      autoFix: null,
      referenceInputs,
      internalMediaRefs,
      styleContext: imagePayload?.styleContext ?? output.styleContext,
      seedance2InputMode: null,
      seedance2ReferenceImageUrls: [],
      seedance2ReferenceVideoUrls: [],
      seedance2ReferenceAudioUrls: [],
      seedance2ReturnLastFrame: null,
      seedance2WebSearch: null,
      klingElements: [],
    },
  });
};

export const resolveWorkflowReloadConfigForOutput = (
  output: StudioOutput,
  options: ResolveWorkflowReloadConfigOptions = {}
): WorkflowReloadConfigV1 | null => {
  const workflowReload = isWorkflowReloadConfigV1(output.workflowReload)
    ? output.workflowReload
    : null;
  if (workflowReload?.payload.kind === "video") return workflowReload;
  if (options.mediaKindHint === "video") return deriveVideoWorkflowReloadFromOutput(output);
  if (workflowReload) return workflowReload;
  if (output.workflowReload != null || hasNonImageDelivery(output)) return null;
  return deriveImageWorkflowReloadFromGenerationReplay(output.generationReplay);
};

export const canReloadWorkflowOutput = (
  output: StudioOutput,
  options: ResolveWorkflowReloadConfigOptions = {}
): boolean => {
  if (output.mediaSource !== "generated") return false;
  return resolveWorkflowReloadConfigForOutput(output, options) != null;
};
