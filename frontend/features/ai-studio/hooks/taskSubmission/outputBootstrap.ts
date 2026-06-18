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
import { resolveInternalMediaRefForUrl } from "../../logic/referenceInputInternalMediaRegistry";
import { buildWorkflowReloadConfigV1 } from "../../logic/workflowReload";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputSubmissionMode,
  ToolId,
  VideoReferenceMode,
  WorkflowReloadConfig,
  WorkflowReloadExpertEditReferences,
  WorkflowReloadExpertEditRestoreSlot,
  WorkflowReloadPanelKind,
  WorkflowReloadVideoReferences,
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
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  videoReferenceMode: VideoReferenceMode;
  durationSeconds: number | null;
  resolution?: string | null;
  generateAudio?: boolean | null;
  cameraFixed?: boolean | null;
  autoFix?: boolean | null;
  motionReferenceVideoUrl?: string | null;
  lipSyncAudioUrl?: string | null;
  lipSyncAudioStoragePath?: string | null;
  lipSyncAudioDurationMs?: number | null;
  lipSyncTurboMode?: boolean | null;
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

export type PreparedWorkflowReloadReferenceInput = {
  originalUrl: string;
  preparedUrl: string;
  internalMediaRef?: InternalMediaRef | null;
};

const MAX_VIDEO_RESTORE_MEDIA_SLOTS = 16;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isLocalOnlyUrl = (value: string) => /^blob:|^data:/i.test(value);

const shouldKeepReloadMediaUrl = (
  sourceUrl: string,
  internalMediaRef: InternalMediaRef | null
): boolean => !isLocalOnlyUrl(sourceUrl) || Boolean(internalMediaRef);

const resolveReloadInternalMediaRef = (
  sourceUrl: string | null | undefined,
  explicitRef?: InternalMediaRef | null
): InternalMediaRef | null => explicitRef ?? resolveInternalMediaRefForUrl(sourceUrl);

const findPreparedReferenceInput = (
  sourceUrl: string,
  preparedInputs: readonly PreparedWorkflowReloadReferenceInput[]
): PreparedWorkflowReloadReferenceInput | null => {
  const normalizedSourceUrl = asTrimmedString(sourceUrl);
  if (!normalizedSourceUrl) return null;
  return (
    preparedInputs.find((item) => {
      const originalUrl = asTrimmedString(item.originalUrl);
      const preparedUrl = asTrimmedString(item.preparedUrl);
      return originalUrl === normalizedSourceUrl || preparedUrl === normalizedSourceUrl;
    }) ?? null
  );
};

const resolvePreparedReferenceInternalMediaRef = (
  preparedInput: PreparedWorkflowReloadReferenceInput | null | undefined,
  fallbackUrl: string | null | undefined,
  explicitRef?: InternalMediaRef | null
): InternalMediaRef | null =>
  explicitRef ??
  preparedInput?.internalMediaRef ??
  resolveReloadInternalMediaRef(preparedInput?.preparedUrl ?? fallbackUrl);

export const reconcileExpertEditWorkflowReloadReferences = ({
  expertEditReferences,
  preparedReferenceInputs,
  preparedRestoreOnlyReferenceInputs,
}: {
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
  preparedReferenceInputs?: readonly PreparedWorkflowReloadReferenceInput[];
  preparedRestoreOnlyReferenceInputs?: readonly PreparedWorkflowReloadReferenceInput[];
}): WorkflowReloadExpertEditReferences | null => {
  if (!expertEditReferences) return null;
  const referenceInputs = preparedReferenceInputs ?? [];
  const restoreInputs = preparedRestoreOnlyReferenceInputs ?? [];
  const secondarySlots = expertEditReferences.secondarySlots
    .map((slot) => {
      const preparedInput = referenceInputs[slot.referenceInputIndex] ?? null;
      const internalMediaRef = resolvePreparedReferenceInternalMediaRef(
        preparedInput,
        preparedInput?.preparedUrl,
        slot.internalMediaRef
      );
      return {
        slotIndex: slot.slotIndex,
        referenceInputIndex: slot.referenceInputIndex,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      };
    })
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const restoreSecondarySlots = (expertEditReferences.restoreSecondarySlots ?? [])
    .map((slot): WorkflowReloadExpertEditRestoreSlot | null => {
      const sourceUrl = asTrimmedString(slot.sourceUrl);
      if (!sourceUrl) return null;
      const preparedInput =
        findPreparedReferenceInput(sourceUrl, referenceInputs) ??
        findPreparedReferenceInput(sourceUrl, restoreInputs);
      const preparedUrl = asTrimmedString(preparedInput?.preparedUrl) ?? sourceUrl;
      const internalMediaRef = resolvePreparedReferenceInternalMediaRef(
        preparedInput,
        preparedUrl,
        slot.internalMediaRef
      );
      if (!shouldKeepReloadMediaUrl(preparedUrl, internalMediaRef)) return null;
      return {
        slotIndex: slot.slotIndex,
        sourceUrl: preparedUrl,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      };
    })
    .filter((slot): slot is WorkflowReloadExpertEditRestoreSlot => Boolean(slot))
    .sort((left, right) => left.slotIndex - right.slotIndex);
  if (secondarySlots.length === 0 && restoreSecondarySlots.length === 0) return null;
  return {
    version: 1,
    maxSecondarySlotCount: expertEditReferences.maxSecondarySlotCount,
    primaryReferenceInputIndex: expertEditReferences.primaryReferenceInputIndex,
    secondarySlots,
    ...(restoreSecondarySlots.length > 0 ? { restoreSecondarySlots } : {}),
  };
};

const buildVideoFrameSlot = (
  sourceUrl: string | null | undefined,
  internalMediaRef?: InternalMediaRef | null
) => {
  const normalizedUrl = asTrimmedString(sourceUrl);
  if (!normalizedUrl) return null;
  const resolvedRef = resolveReloadInternalMediaRef(normalizedUrl, internalMediaRef);
  if (!shouldKeepReloadMediaUrl(normalizedUrl, resolvedRef)) return null;
  return {
    sourceUrl: normalizedUrl,
    ...(resolvedRef ? { internalMediaRef: resolvedRef } : {}),
  };
};

const buildVideoMediaSlots = (
  urls: readonly string[],
  refs: readonly (InternalMediaRef | null | undefined)[] = []
): NonNullable<WorkflowReloadVideoReferences["seedance2ReferenceImages"]> =>
  urls
    .slice(0, MAX_VIDEO_RESTORE_MEDIA_SLOTS)
    .reduce<
      NonNullable<WorkflowReloadVideoReferences["seedance2ReferenceImages"]>
    >((slots, url, index) => {
      const normalizedUrl = asTrimmedString(url);
      if (!normalizedUrl) return slots;
      const internalMediaRef = resolveReloadInternalMediaRef(normalizedUrl, refs[index] ?? null);
      if (!shouldKeepReloadMediaUrl(normalizedUrl, internalMediaRef)) return slots;
      slots.push({
        slotIndex: index,
        sourceUrl: normalizedUrl,
        ...(internalMediaRef ? { internalMediaRef } : {}),
      });
      return slots;
    }, []);

const splitReferenceImageUrls = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const buildKlingElementSlots = (
  elements: readonly Record<string, unknown>[]
): NonNullable<WorkflowReloadVideoReferences["klingElementSlots"]> =>
  elements.slice(0, 6).map((element, fallbackIndex) => {
    const slotIndex =
      typeof element.slotIndex === "number" &&
      Number.isInteger(element.slotIndex) &&
      element.slotIndex >= 0
        ? element.slotIndex
        : fallbackIndex;
    const profileImageUrl = asTrimmedString(element.profileImageUrl);
    const frontalImageUrl = asTrimmedString(element.frontalImageUrl);
    const referenceImageUrls = splitReferenceImageUrls(element.referenceImageUrls);
    const videoUrl = asTrimmedString(element.videoUrl);
    const profileImageInternalMediaRef = resolveReloadInternalMediaRef(profileImageUrl);
    const frontalImageInternalMediaRef = resolveReloadInternalMediaRef(frontalImageUrl);
    const referenceImageInternalMediaRefs = referenceImageUrls.map((url) =>
      resolveReloadInternalMediaRef(url)
    );
    const videoInternalMediaRef = resolveReloadInternalMediaRef(videoUrl);

    return {
      slotIndex,
      element: { ...element, slotIndex },
      ...(profileImageInternalMediaRef ? { profileImageInternalMediaRef } : {}),
      ...(frontalImageInternalMediaRef ? { frontalImageInternalMediaRef } : {}),
      ...(referenceImageInternalMediaRefs.length > 0 ? { referenceImageInternalMediaRefs } : {}),
      ...(videoInternalMediaRef ? { videoInternalMediaRef } : {}),
    };
  });

const buildVideoReferences = ({
  referenceInputs,
  internalMediaRefs,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  klingElements,
}: {
  referenceInputs: string[];
  internalMediaRefs: Array<InternalMediaRef | null>;
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  klingElements: Array<Record<string, unknown>>;
}): WorkflowReloadVideoReferences | null => {
  const firstFrame = buildVideoFrameSlot(referenceInputs[0], internalMediaRefs[0] ?? null);
  const lastFrame = buildVideoFrameSlot(referenceInputs[1], internalMediaRefs[1] ?? null);
  const seedance2ReferenceImages = buildVideoMediaSlots(seedance2ReferenceImageUrls);
  const seedance2ReferenceVideos = buildVideoMediaSlots(seedance2ReferenceVideoUrls);
  const seedance2ReferenceAudio = buildVideoMediaSlots(seedance2ReferenceAudioUrls);
  const klingElementSlots = buildKlingElementSlots(klingElements);
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
  expertEditReferences = null,
  characterContext,
  styleContext,
  videoReferenceMode,
  durationSeconds,
  resolution = null,
  generateAudio = null,
  cameraFixed = null,
  autoFix = null,
  motionReferenceVideoUrl = null,
  lipSyncAudioUrl = null,
  lipSyncAudioStoragePath = null,
  lipSyncAudioDurationMs = null,
  lipSyncTurboMode = null,
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
        ...(expertEditReferences ? { expertEditReferences } : {}),
        characterContext,
        styleContext,
      },
    });
  }
  if (outputMode !== "video") return null;
  const videoReferences = buildVideoReferences({
    referenceInputs,
    internalMediaRefs,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    klingElements,
  });
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
      styleContext,
      ...(videoReferences ? { videoReferences } : {}),
      motionReferenceVideoUrl,
      lipSyncAudioUrl,
      lipSyncAudioStoragePath,
      lipSyncAudioDurationMs,
      lipSyncTurboMode,
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
