/**
 * Dedicated properties panel for the Video workflow.
 */
import React from "react";
import { Trash } from "phosphor-react";
import type { AspectOption, LipSyncAudioState, VideoReferenceMode } from "../types";
import { modelLogos } from "../constants";
import { extractPromptDropText } from "../utils/dragDrop";
import {
  insertDroppedPromptTextAtSelection,
  resolveDroppedPromptTextEdit,
  resolveDroppedPromptTextEditMode,
  useAgentComposerPromptDropModifierTracking,
} from "./promptStep/agentComposerDrop";
import { ElementPickerModal } from "./ElementPickerModal";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceKlingAdvancedSteps } from "./ReferenceKlingAdvancedSteps";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { MotionRecorderModal } from "./MotionRecorderModal";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { ComposerPinButton } from "./shared/ComposerPinButton";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";
import { VideoGenerateFooter } from "./video/VideoGenerateFooter";
import { VideoLipSyncAudioDropzone } from "./video/VideoLipSyncAudioDropzone";
import { VideoLipSyncSetup } from "./video/VideoLipSyncSetup";
import { VideoModeTabs } from "./video/VideoModeTabs";
import type { VideoUploadResult } from "../utils/videoUpload";
import { createEmptyLipSyncAudioState } from "../logic/lipSyncAudioState";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";
import { isSeedance2UiEnabled } from "../logic/seedance2Availability";
import {
  collectSeedanceElementProviderReferences,
  createSeedanceImageReferenceSlot,
  createSeedanceAudioReferenceSlot,
  createSeedanceVideoReferenceSlot,
  isElementSlotVisibleForVideoModel,
  isPromptTokenEligibleKlingElement,
  resolveSeedanceReferenceLimitError,
  resolveAiStudioKlingElementLegacyTokens,
  type AiStudioKlingElement,
  type AiStudioKlingSavedEntitySourceKind,
  resolveAiStudioKlingElementTokens,
  resolveKieKlingElementTokens,
} from "../logic/klingElements";
import {
  KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS,
  resolveKlingSinglePromptEffectiveVisibleCharacterLimit,
} from "../logic/klingShotModePromptComposition";
import { loadSavedKlingEntityBySource } from "../logic/klingEntityAdapters";
import {
  analyzeKlingPromptTokens,
  buildKlingElementPromptToken,
  buildKlingPromptHighlightSegments,
  extractKlingElementPromptTokenFromTransfer,
} from "../logic/klingPromptReferences";
import { insertPromptTokenAtSelection } from "../logic/promptTokenInsertion";
import { syncTextareaMirrorScroll } from "./edit/expertEditInteractionUtils";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import type { GenerationAccessCta } from "../logic/generationAccessCta";
import { useVideoLipSyncAudioController } from "./useVideoLipSyncAudioController";
import { useVideoSavedKlingElementRefresh } from "./useVideoSavedKlingElementRefresh";
import { VideoAssetSlotsCard } from "./video/VideoAssetSlotsCard";
import { VideoMotionRecorderLaunch } from "./video/VideoMotionRecorderLaunch";
import { VideoPromptTokenPicker } from "./video/VideoPromptTokenPicker";

const VIDEO_KLING_ELEMENT_SLOT_COUNT = 3;
const VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT = 9;
// Deferred past the July 7 launch while the turbo path remains internally wired.
const SHOW_LIP_SYNC_TURBO_CONTROL = false;

const resolveKlingElementPanelSlotIndex = (
  element: AiStudioKlingElement,
  fallbackIndex: number
): number | null =>
  typeof element.slotIndex === "number" &&
  Number.isInteger(element.slotIndex) &&
  element.slotIndex >= 0
    ? element.slotIndex
    : fallbackIndex >= 0
      ? fallbackIndex
      : null;

const sortKlingElementsBySlotIndex = (elements: AiStudioKlingElement[]): AiStudioKlingElement[] =>
  [...elements].sort((a, b) => {
    const left = a.slotIndex ?? 0;
    const right = b.slotIndex ?? 0;
    return left - right;
  });

type KlingPromptCharacterCounterProps = {
  count: number;
  limit: number;
  overLimit: boolean;
  ariaLabel: string;
};

function KlingPromptCharacterCounter({
  count,
  limit,
  overLimit,
  ariaLabel,
}: KlingPromptCharacterCounterProps) {
  return (
    <div
      className={`video-prompt-character-meta ${overLimit ? "is-over-limit" : ""}`.trim()}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="video-prompt-character-meta-value">
        {`${count.toLocaleString()} / ${limit.toLocaleString()}`}
      </span>
    </div>
  );
}

function isSeedance2FamilyModelId(modelId: string | null): boolean {
  return (
    isSeedance2UiEnabled() &&
    (modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID)
  );
}

export type VideoPropertiesPanelProps = {
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  videoReferenceMode?: VideoReferenceMode;
  onVideoReferenceModeChange?: (value: VideoReferenceMode) => void;
  klingNegativePrompt?: string;
  klingCfgScale?: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingShotType?: "customize" | "intelligent";
  klingVoiceIds?: [string, string];
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  klingElements?: AiStudioKlingElement[];
  onKlingNegativePromptChange?: (value: string) => void;
  onKlingCfgScaleChange?: (value: number) => void;
  onKlingWorkflowModeChange?: (value: "single" | "multi" | "custom") => void;
  onKlingShotTypeChange?: (value: "customize" | "intelligent") => void;
  onKlingVoiceIdChange?: (index: 0 | 1, value: string) => void;
  onKlingMultiPromptsChange?: (value: { id: string; prompt: string; duration: number }[]) => void;
  onKlingElementsChange?: (value: AiStudioKlingElement[]) => void;
  motionVideoUrl?: string | null;
  onMotionVideoChange?: (url: string | null) => void;
  onStageMotionVideoSelection?: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  onRecordedMotionVideoReady?: (
    upload: VideoUploadResult,
    sourceFile: File
  ) => void | Promise<void>;
  onClearMotionVideo?: () => void;
  motionVideoLoading?: boolean;
  motionVideoError?: string | null;
  lipSyncAudio?: LipSyncAudioState;
  onLipSyncAudioChange?: (value: LipSyncAudioState) => void;
  lipSyncTurboMode?: boolean;
  onLipSyncTurboModeChange?: (value: boolean) => void;
  videoDurationSeconds?: number;
  videoResolution?: string;
  videoGenerateAudio?: boolean;
  videoAutoFix?: boolean;
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean;
  seedance2WebSearch?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
  onSeedance2InputModeChange?: (
    value: "text" | "first-frame" | "first-last" | "multimodal"
  ) => void;
  onSeedance2ReferenceImageUrlsChange?: (value: string[]) => void;
  onSeedance2ReferenceVideoUrlsChange?: (value: string[]) => void;
  onSeedance2ReferenceAudioUrlsChange?: (value: string[]) => void;
  onSeedance2ReturnLastFrameChange?: (value: boolean) => void;
  onSeedance2WebSearchChange?: (value: boolean) => void;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onPinPromptReference?: (text: string) => void;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onRegenerate: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  generationAccessCta?: GenerationAccessCta | null;
  guardrailReason?: string | null;
  referenceImageWarning?: string | null;
  onCreateCharacter?: () => void;
  onCreateElement?: () => void;
};

/**
 * Renders Video controls with video/Kling mode handling.
 */
export function VideoPropertiesPanel({
  modelId,
  modelLabel,
  aspect,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  videoReferenceMode,
  onVideoReferenceModeChange,
  klingNegativePrompt = "blur, distort, and low quality",
  klingCfgScale = 0.5,
  klingWorkflowMode = "single",
  klingShotType = "customize",
  klingVoiceIds = ["", ""],
  klingMultiPrompts = [],
  klingElements = [],
  onKlingNegativePromptChange,
  onKlingCfgScaleChange,
  onKlingWorkflowModeChange,
  onKlingShotTypeChange,
  onKlingVoiceIdChange,
  onKlingMultiPromptsChange,
  onKlingElementsChange,
  motionVideoUrl = null,
  onMotionVideoChange,
  onStageMotionVideoSelection,
  onRecordedMotionVideoReady,
  onClearMotionVideo,
  motionVideoLoading = false,
  motionVideoError = null,
  lipSyncAudio = createEmptyLipSyncAudioState(),
  onLipSyncAudioChange,
  lipSyncTurboMode = false,
  onLipSyncTurboModeChange,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  videoAutoFix = false,
  seedance2InputMode = "multimodal",
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoAutoFixChange,
  onSeedance2InputModeChange,
  aspectOptions,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  onPinPromptReference,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId = null,
  stylesCatalog,
  onRegenerate,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceImageDropSource,
  resolveInternalReferenceVideoDropSource,
  canvasTearOutTargetRegistry,
  costCredits,
  isGenerateDisabled = false,
  generationAccessCta = null,
  guardrailReason = null,
  referenceImageWarning = null,
  onCreateCharacter,
  onCreateElement,
}: VideoPropertiesPanelProps) {
  useAgentComposerPromptDropModifierTracking();

  type KlingPromptTarget = "primary" | string;
  const shotWorkspaceScrollRef = React.useRef<HTMLDivElement | null>(null);
  const shotWorkspaceStackRef = React.useRef<HTMLDivElement | null>(null);
  const primaryPromptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const primaryPromptShellRef = React.useRef<HTMLDivElement | null>(null);
  const seedanceElementSlotRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const customPromptTextareaRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const customPromptHighlightRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const pendingPromptCaretRef = React.useRef<{ target: "primary" | string; caret: number } | null>(
    null
  );
  const activePromptTargetRef = React.useRef<KlingPromptTarget>("primary");
  const pendingPromptTokenPickerTriggerRef = React.useRef<{
    target: KlingPromptTarget;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [elementPickerSlotIndex, setElementPickerSlotIndex] = React.useState<number | null>(null);
  const [isElementPickerOpen, setIsElementPickerOpen] = React.useState(false);
  const [isMotionRecorderOpen, setIsMotionRecorderOpen] = React.useState(false);
  const [elementPickerError, setElementPickerError] = React.useState<string | null>(null);
  const [seedanceSlotLimitWarning, setSeedanceSlotLimitWarning] = React.useState<string | null>(
    null
  );
  const shouldStagePrimaryImageForProviderAccess = videoReferenceMode === "motion";
  const [promptTokenPickerState, setPromptTokenPickerState] = React.useState<{
    isOpen: boolean;
    selectedSlotIndex: number | null;
    replaceStart: number;
    replaceEnd: number;
    target: KlingPromptTarget;
  }>({
    isOpen: false,
    selectedSlotIndex: null,
    replaceStart: 0,
    replaceEnd: 0,
    target: "primary",
  });
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const isSeedance2FamilyModelSelectedForSlots = isSeedance2FamilyModelId(modelId);
  const klingElementSlotCount = isSeedance2FamilyModelSelectedForSlots
    ? VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT
    : VIDEO_KLING_ELEMENT_SLOT_COUNT;
  const commitSelectedKlingElements = React.useCallback(
    (elements: Array<AiStudioKlingElement | null>) => {
      const visibleSlotIndexes = new Set(
        Array.from({ length: klingElementSlotCount }, (_, index) => index)
      );
      const committedVisibleElements = elements
        .map((item, index) => {
          if (!item) return null;
          const slotIndex = resolveKlingElementPanelSlotIndex(item, index);
          if (slotIndex == null || !visibleSlotIndexes.has(slotIndex)) return null;
          return item.slotIndex === slotIndex ? item : { ...item, slotIndex };
        })
        .filter((item): item is AiStudioKlingElement => Boolean(item));
      const preservedHiddenElements = klingElements.filter((element, index) => {
        const slotIndex = resolveKlingElementPanelSlotIndex(element, index);
        return slotIndex != null && !visibleSlotIndexes.has(slotIndex);
      });
      onKlingElementsChange?.(
        sortKlingElementsBySlotIndex([...preservedHiddenElements, ...committedVisibleElements])
      );
    },
    [klingElementSlotCount, klingElements, onKlingElementsChange]
  );
  const selectedKlingElements = React.useMemo(() => {
    const slots = Array.from(
      { length: klingElementSlotCount },
      () => null as AiStudioKlingElement | null
    );
    const legacyElements: AiStudioKlingElement[] = [];

    klingElements.forEach((element) => {
      const slotIndex = resolveKlingElementPanelSlotIndex(element, -1);

      if (slotIndex != null && slotIndex >= klingElementSlotCount) {
        return;
      }

      if (slotIndex == null || slotIndex < 0) {
        legacyElements.push(element);
        return;
      }

      if (!slots[slotIndex]) {
        slots[slotIndex] = element.slotIndex === slotIndex ? element : { ...element, slotIndex };
        return;
      }

      legacyElements.push(element);
    });

    legacyElements.forEach((element) => {
      const emptySlotIndex = slots.findIndex((slot) => slot == null);
      if (emptySlotIndex < 0) return;
      slots[emptySlotIndex] = { ...element, slotIndex: emptySlotIndex };
    });

    return slots;
  }, [klingElementSlotCount, klingElements]);
  const resolveSeedanceElementSlotLimitError = React.useCallback(
    (elements: Array<AiStudioKlingElement | null>) => {
      if (!isSeedance2FamilyModelSelectedForSlots) return null;
      const references = collectSeedanceElementProviderReferences(
        elements.filter((element): element is AiStudioKlingElement => Boolean(element))
      );
      return resolveSeedanceReferenceLimitError(references);
    },
    [isSeedance2FamilyModelSelectedForSlots]
  );
  const modelVisibleKlingElements = React.useMemo(
    () =>
      selectedKlingElements.map((element) =>
        isElementSlotVisibleForVideoModel(element, {
          allowSeedanceImageReferences: isSeedance2FamilyModelSelectedForSlots,
        })
          ? element
          : null
      ),
    [isSeedance2FamilyModelSelectedForSlots, selectedKlingElements]
  );
  const handleSeedanceElementMediaSlotChange = React.useCallback(
    (
      slotIndex: number,
      value: { kind: "image" | "video" | "audio"; url: string; name?: string | null } | null
    ) => {
      const next = Array.from(
        { length: klingElementSlotCount },
        (_, index) => selectedKlingElements[index] ?? null
      );
      if (!value) {
        next[slotIndex] = null;
      } else if (value.kind === "video") {
        next[slotIndex] = createSeedanceVideoReferenceSlot({
          slotIndex,
          videoUrl: value.url,
          name: value.name,
        });
      } else if (value.kind === "audio") {
        next[slotIndex] = createSeedanceAudioReferenceSlot({
          slotIndex,
          audioUrl: value.url,
          name: value.name,
        });
      } else {
        next[slotIndex] = createSeedanceImageReferenceSlot({
          slotIndex,
          imageUrl: value.url,
          name: value.name,
        });
      }
      const limitError = resolveSeedanceElementSlotLimitError(next);
      if (limitError) {
        setSeedanceSlotLimitWarning(limitError);
        return;
      }
      setSeedanceSlotLimitWarning(null);
      commitSelectedKlingElements(next);
    },
    [
      commitSelectedKlingElements,
      klingElementSlotCount,
      resolveSeedanceElementSlotLimitError,
      selectedKlingElements,
    ]
  );
  const {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    motionVideoInputRef,
    seedanceElementImageInputRefs,
    primaryDragActive,
    extraDragActive,
    seedanceElementImageDragActive,
    primaryImageLoading,
    extraImageLoading,
    seedanceElementImageLoading,
    setSeedanceElementImageDragActiveAt,
    motionVideoDragActive,
    setMotionVideoDragActive,
    collapsedSteps,
    toggleStep,
    expandIfCollapsed,
    updateKlingMultiPrompt,
    addKlingShot,
    removeKlingShot,
    updateKlingElement,
    addKlingElement,
    removeKlingElement,
    handleFileSelection,
    handlePrimaryFileSelection,
    handlePrimaryDrop,
    handleExtraDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    handleSeedanceElementMediaFileSelection,
    handleSeedanceElementMediaDrop,
    handleSeedanceElementMediaDragEnter,
    handleSeedanceElementMediaDragOver,
    handleSeedanceElementMediaDragLeave,
    acceptPrimaryCanvasTearOutPayload,
    acceptExtraCanvasTearOutPayload,
    acceptSeedanceElementMediaCanvasTearOutPayload,
    acceptMotionVideoCanvasTearOutPayload,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  } = useReferencePropertiesInteractions({
    referenceImageUrl,
    extraImageUrls,
    onPrimaryImageChange,
    onExtraImageChange,
    onPromptTextChange,
    stagePrimaryImageForProviderAccess: shouldStagePrimaryImageForProviderAccess,
    onMotionVideoChange,
    onStageMotionVideoSelection,
    resolvePreviewUrlById,
    resolveMotionVideoUrlById,
    resolveInternalReferenceImageDropSource,
    resolveInternalReferenceVideoDropSource,
    klingMultiPrompts,
    onKlingMultiPromptsChange,
    klingElements,
    onKlingElementsChange,
    seedanceElementSlotCount: klingElementSlotCount,
    onSeedanceElementMediaSlotChange: handleSeedanceElementMediaSlotChange,
  });
  const {
    lipSyncAudioInputRef,
    lipSyncAudioDropzoneRef,
    lipSyncAudioDragActive,
    setLipSyncAudioDragActive,
    lipSyncAudioCanvasTearOutActive,
    setLipSyncAudioCanvasTearOutActive,
    handleLipSyncAudioSelection,
    handleLipSyncAudioDrop,
    canAcceptLipSyncAudioCanvasTearOutPayload,
    acceptLipSyncAudioCanvasTearOutPayload,
    clearLipSyncAudio,
    lipSyncAudioPlaybackUrl,
  } = useVideoLipSyncAudioController({
    lipSyncAudio,
    onLipSyncAudioChange,
    resolvePreviewUrlById,
  });
  const { rememberSavedKlingElementRefreshKey } = useVideoSavedKlingElementRefresh({
    selectedKlingElements,
    onKlingElementsChange,
    commitSelectedKlingElements,
  });

  const openElementPicker = React.useCallback((slotIndex: number) => {
    setElementPickerError(null);
    setElementPickerSlotIndex(slotIndex);
    setIsElementPickerOpen(true);
  }, []);

  const closeElementPicker = React.useCallback(() => {
    setIsElementPickerOpen(false);
    setElementPickerSlotIndex(null);
  }, []);

  const handleElementSelection = React.useCallback(
    async ({
      sourceKind,
      sourceId,
      sourceCharacterLookId = null,
    }: {
      sourceKind: AiStudioKlingSavedEntitySourceKind;
      sourceId: string;
      sourceCharacterLookId?: string | null;
    }) => {
      if (elementPickerSlotIndex == null) return;
      try {
        const selectedElement = await loadSavedKlingEntityBySource({
          sourceKind,
          sourceId,
          sourceCharacterLookId,
        });
        rememberSavedKlingElementRefreshKey(selectedElement, elementPickerSlotIndex);
        const next = Array.from(
          { length: klingElementSlotCount },
          (_, index) => selectedKlingElements[index] ?? null
        );
        next[elementPickerSlotIndex] = { ...selectedElement, slotIndex: elementPickerSlotIndex };
        const limitError = resolveSeedanceElementSlotLimitError(next);
        if (limitError) {
          setSeedanceSlotLimitWarning(limitError);
          return;
        }
        commitSelectedKlingElements(next);
        setElementPickerError(null);
        setSeedanceSlotLimitWarning(null);
      } catch {
        setElementPickerError("Unable to attach that saved element.");
      } finally {
        closeElementPicker();
      }
    },
    [
      commitSelectedKlingElements,
      closeElementPicker,
      elementPickerSlotIndex,
      klingElementSlotCount,
      rememberSavedKlingElementRefreshKey,
      resolveSeedanceElementSlotLimitError,
      selectedKlingElements,
    ]
  );

  const removeSelectedElement = React.useCallback(
    (slotIndex: number) => {
      const next = Array.from(
        { length: klingElementSlotCount },
        (_, index) => selectedKlingElements[index] ?? null
      );
      next[slotIndex] = null;
      commitSelectedKlingElements(next);
    },
    [commitSelectedKlingElements, klingElementSlotCount, selectedKlingElements]
  );

  const {
    activeVideoMode,
    isKling3Mode,
    isKlingPatternMode,
    isKeyframesMode,
    isMotionMode,
    isLipSyncMode,
    isStandardMode,
    isVeoModel,
    referenceStepTitle,
    referenceStepSubtitle,
    promptOrder,
    referenceOrder,
    promptBadge,
    videoSettingsOrder,
    motionAudioOrder,
    klingAdvancedOrder,
    klingAssetsOrder,
    klingGuidanceOrder,
    klingShotSummary,
    klingAssetsSummary,
    klingGuidanceSummary,
    videoDurationValue,
    videoResolutionValue,
    videoGenerateAudioValue,
    modelConfig,
    durationOptions,
    resolutionOptions,
    aspectOptionsForModel,
  } = useReferencePropertiesDerivedState({
    variant: "video",
    videoReferenceMode,
    modelId,
    aspectOptions,
    klingMultiPrompts,
    klingElements,
    klingVoiceIds,
    klingCfgScale,
    klingNegativePrompt,
    videoDurationSeconds,
    videoResolution,
    videoGenerateAudio,
  });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue,
    onVideoDurationChange,
    videoResolutionValue,
    onVideoResolutionChange,
    isVideoVariant: true,
    imageResolution: undefined,
    imageResolutionValue: "model_default",
    onImageResolutionChange: undefined,
  });

  const isKieKlingWorkspace = isKling3Mode && modelId === KIE_KLING_30_MODEL_ID;
  const isKieKlingModelSelected = modelId === KIE_KLING_30_MODEL_ID;
  const isSeedance2FamilyModelSelected = isSeedance2FamilyModelSelectedForSlots;
  const isAnySeedanceModelSelected = isSeedance2FamilyModelSelected;
  const isKlingPatternModelSelected = isKieKlingModelSelected || isSeedance2FamilyModelSelected;
  const isVeo31ModelSelected =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;
  const seedanceReferenceMode =
    isSeedance2FamilyModelSelected && seedance2InputMode === "multimodal"
      ? "elements"
      : "keyframes";

  React.useEffect(() => {
    if (isVeo31ModelSelected && videoAutoFix) {
      onVideoAutoFixChange?.(false);
    }
  }, [isVeo31ModelSelected, onVideoAutoFixChange, videoAutoFix]);

  React.useEffect(() => {
    if (!isMotionMode && isMotionRecorderOpen) {
      setIsMotionRecorderOpen(false);
    }
  }, [isMotionMode, isMotionRecorderOpen]);

  React.useEffect(() => {
    if (!isLipSyncMode || !canvasTearOutTargetRegistry || !lipSyncAudioDropzoneRef.current) {
      return;
    }
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-lip-sync-audio",
      element: lipSyncAudioDropzoneRef.current,
      canAccept: canAcceptLipSyncAudioCanvasTearOutPayload,
      accept: acceptLipSyncAudioCanvasTearOutPayload,
      setActive: setLipSyncAudioCanvasTearOutActive,
    });
  }, [
    acceptLipSyncAudioCanvasTearOutPayload,
    canAcceptLipSyncAudioCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    isLipSyncMode,
    lipSyncAudioDropzoneRef,
    setLipSyncAudioCanvasTearOutActive,
  ]);

  React.useEffect(() => {
    if (
      !isSeedance2FamilyModelSelected ||
      seedanceReferenceMode !== "elements" ||
      !canvasTearOutTargetRegistry
    ) {
      return;
    }

    const unregisterTargets = Array.from({ length: klingElementSlotCount }).flatMap((_, index) => {
      const element = seedanceElementSlotRefs.current[index] ?? null;
      if (!element) return [];
      return [
        canvasTearOutTargetRegistry.registerTarget({
          id: `video-seedance-element-media-${index}`,
          element,
          canAccept: (payload) =>
            payload.kind === "image" || payload.kind === "video" || payload.kind === "audio",
          accept: (payload) => acceptSeedanceElementMediaCanvasTearOutPayload(index, payload),
          setActive: (active) => setSeedanceElementImageDragActiveAt(index, active),
        }),
      ];
    });

    return () => {
      unregisterTargets.forEach((unregister) => unregister());
    };
  }, [
    acceptSeedanceElementMediaCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    isSeedance2FamilyModelSelected,
    klingElementSlotCount,
    seedanceReferenceMode,
    setSeedanceElementImageDragActiveAt,
  ]);

  const visibleVideoMode =
    activeVideoMode === "lip-sync"
      ? "lip-sync"
      : activeVideoMode === "motion"
        ? "motion"
        : "standard";
  const resolvedVideoLane = resolveVideoGenerationLaneFromFrameInputs({
    primary: referenceImageUrl,
    extras: extraImageUrls,
    referenceMode: activeVideoMode,
  });
  const modelPickerContext: ModelModalContext =
    activeVideoMode === "keyframes"
      ? "reference-keyframes"
      : resolvedVideoLane === "text"
        ? "text-video"
        : "reference-video";
  const standardVideoRequiresReferenceImage =
    activeVideoMode === "standard" && modelId === KIE_KLING_30_MODEL_ID;
  const shouldShowKlingReferenceImageWarning =
    standardVideoRequiresReferenceImage && !referenceImageUrl;
  const videoModeIndex =
    visibleVideoMode === "lip-sync" ? 2 : visibleVideoMode === "motion" ? 1 : 0;
  const videoModeTabsStyle = React.useMemo(
    () =>
      ({
        "--video-reference-mode-slots": 3,
        "--video-reference-mode-index": videoModeIndex,
      }) as React.CSSProperties,
    [videoModeIndex]
  );
  const klingMode = klingWorkflowMode;
  const isCustomKlingWorkflow = false;
  const visibleShotMode = klingMode === "custom" ? "multi" : klingMode;
  const shotModeTabCount = 2;
  const customKlingPrompts = React.useMemo(
    () => (isCustomKlingWorkflow ? klingMultiPrompts : []),
    [isCustomKlingWorkflow, klingMultiPrompts]
  );
  const hasAnyPromptText = isCustomKlingWorkflow
    ? customKlingPrompts.some((shot) => shot.prompt.trim().length > 0)
    : Boolean(referenceText?.trim());
  const hasRequiredPromptForGenerate = isMotionMode || isLipSyncMode || hasAnyPromptText;
  const videoModeSummaryLabel =
    visibleVideoMode === "lip-sync"
      ? "Lip Sync"
      : visibleVideoMode === "motion"
        ? "Motion Control"
        : "Standard";
  const shotModeSummaryLabel = !isKlingPatternModelSelected
    ? "Single"
    : visibleShotMode === "multi"
      ? "Multi"
      : "Single";
  const showShotModeSelector = activeVideoMode === "standard";
  const shouldShowShotModeSelector = showShotModeSelector && isKlingPatternModelSelected;
  const shouldShowKlingAdvancedSteps =
    isKlingPatternMode && !isSeedance2FamilyModelSelected && !isMotionMode;
  const shouldShowVideoElementSettings =
    isKlingPatternModelSelected && (!isMotionMode || isKieKlingModelSelected);
  const textareaResizeFrameMapRef = React.useRef(new WeakMap<HTMLTextAreaElement, number>());

  const resizeTextareaToViewport = React.useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const previousFrameId = textareaResizeFrameMapRef.current.get(textarea);
    if (typeof previousFrameId === "number") {
      window.cancelAnimationFrame(previousFrameId);
    }
    const frameId = window.requestAnimationFrame(() => {
      const computedMinHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
      const rect = textarea.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const bottomViewportInset = 150;
      const availableHeight = Math.max(
        viewportHeight - rect.top - bottomViewportInset,
        computedMinHeight
      );
      textarea.style.height = "auto";
      const nextHeight = Math.min(
        Math.max(textarea.scrollHeight, computedMinHeight),
        availableHeight
      );
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > nextHeight + 1 ? "auto" : "hidden";
      textareaResizeFrameMapRef.current.delete(textarea);
    });
    textareaResizeFrameMapRef.current.set(textarea, frameId);
  }, []);

  const handleSetKlingWorkflowMode = (nextMode: "single" | "multi") => {
    onKlingWorkflowModeChange?.(nextMode);
  };
  const handleSetSeedanceReferenceMode = React.useCallback(
    (nextMode: "keyframes" | "elements") => {
      if (!onSeedance2InputModeChange) return;
      if (nextMode === "elements") {
        onSeedance2InputModeChange("multimodal");
        return;
      }
      const hasFirstFrame = Boolean(referenceImageUrl);
      const hasLastFrame = Boolean(extraImageUrls[0]);
      onSeedance2InputModeChange(
        hasFirstFrame && hasLastFrame ? "first-last" : hasFirstFrame ? "first-frame" : "text"
      );
    },
    [extraImageUrls, onSeedance2InputModeChange, referenceImageUrl]
  );
  const lipSyncAudioSlot = React.useMemo(
    () =>
      isLipSyncMode ? (
        <VideoLipSyncAudioDropzone
          lipSyncAudio={lipSyncAudio}
          lipSyncAudioPlaybackUrl={lipSyncAudioPlaybackUrl}
          lipSyncAudioDragActive={lipSyncAudioDragActive}
          lipSyncAudioCanvasTearOutActive={lipSyncAudioCanvasTearOutActive}
          lipSyncAudioInputRef={lipSyncAudioInputRef}
          lipSyncAudioDropzoneRef={lipSyncAudioDropzoneRef}
          setLipSyncAudioDragActive={setLipSyncAudioDragActive}
          handleLipSyncAudioDrop={handleLipSyncAudioDrop}
          clearLipSyncAudio={clearLipSyncAudio}
        />
      ) : null,
    [
      clearLipSyncAudio,
      handleLipSyncAudioDrop,
      isLipSyncMode,
      lipSyncAudio,
      lipSyncAudioCanvasTearOutActive,
      lipSyncAudioDragActive,
      lipSyncAudioPlaybackUrl,
      lipSyncAudioInputRef,
      lipSyncAudioDropzoneRef,
      setLipSyncAudioDragActive,
    ]
  );
  const renderReferenceMediaStep = React.useCallback(
    () => (
      <ReferenceMediaStep
        referenceOrder={referenceOrder}
        collapsedReference={collapsedSteps.reference}
        onExpandReference={() => expandIfCollapsed("reference")}
        onToggleReference={() => toggleStep("reference")}
        isVideoVariant={true}
        referenceStepTitle={referenceStepTitle}
        referenceStepSubtitle={referenceStepSubtitle}
        isMotionMode={isMotionMode}
        isLipSyncMode={isLipSyncMode}
        isKling3Mode={isKlingPatternMode}
        isStandardMode={isStandardMode}
        isKeyframesMode={isKeyframesMode}
        primaryImageRequired={standardVideoRequiresReferenceImage}
        referenceImageUrl={referenceImageUrl}
        extraImageUrls={extraImageUrls}
        motionVideoUrl={motionVideoUrl}
        primaryDragActive={primaryDragActive}
        extraDragActive={extraDragActive}
        primaryImageLoading={primaryImageLoading}
        extraImageLoading={extraImageLoading}
        motionVideoLoading={motionVideoLoading}
        motionVideoError={motionVideoError}
        motionVideoDragActive={motionVideoDragActive}
        setMotionVideoDragActive={setMotionVideoDragActive}
        handlePrimaryDrop={handlePrimaryDrop}
        handlePrimaryDragEnter={handlePrimaryDragEnter}
        handlePrimaryDragOver={handlePrimaryDragOver}
        handlePrimaryDragLeave={handlePrimaryDragLeave}
        handleExtraDrop={handleExtraDrop}
        handleExtraDragEnter={handleExtraDragEnter}
        handleExtraDragOver={handleExtraDragOver}
        handleExtraDragLeave={handleExtraDragLeave}
        allowVideoDrag={allowVideoDrag}
        handleMotionVideoDrop={handleMotionVideoDrop}
        primaryInputRef={primaryInputRef}
        extraOneInputRef={extraOneInputRef}
        extraTwoInputRef={extraTwoInputRef}
        extraThreeInputRef={extraThreeInputRef}
        motionVideoInputRef={motionVideoInputRef}
        onPrimaryImageChange={onPrimaryImageChange}
        onExtraImageChange={onExtraImageChange}
        onMotionVideoChange={onMotionVideoChange}
        onClearMotionVideo={onClearMotionVideo}
        handleFileSelection={handleFileSelection}
        handlePrimaryFileSelection={handlePrimaryFileSelection}
        handleMotionVideoSelection={handleMotionVideoSelection}
        canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
        acceptPrimaryCanvasTearOutPayload={acceptPrimaryCanvasTearOutPayload}
        acceptExtraCanvasTearOutPayload={acceptExtraCanvasTearOutPayload}
        acceptMotionVideoCanvasTearOutPayload={acceptMotionVideoCanvasTearOutPayload}
        lipSyncAudioSlot={lipSyncAudioSlot}
        topContent={
          <div className="video-reference-card-title">
            {isLipSyncMode
              ? "Add Lip Sync Inputs"
              : isMotionMode
                ? "Add Motion Inputs"
                : "Add References"}
          </div>
        }
      />
    ),
    [
      allowVideoDrag,
      acceptExtraCanvasTearOutPayload,
      acceptMotionVideoCanvasTearOutPayload,
      acceptPrimaryCanvasTearOutPayload,
      canvasTearOutTargetRegistry,
      collapsedSteps.reference,
      expandIfCollapsed,
      extraDragActive,
      extraImageLoading,
      extraImageUrls,
      handleExtraDragEnter,
      handleExtraDragLeave,
      handleExtraDragOver,
      handleExtraDrop,
      handleFileSelection,
      handleMotionVideoDrop,
      handleMotionVideoSelection,
      extraOneInputRef,
      extraThreeInputRef,
      extraTwoInputRef,
      handlePrimaryFileSelection,
      handlePrimaryDragEnter,
      handlePrimaryDragLeave,
      handlePrimaryDragOver,
      handlePrimaryDrop,
      isKeyframesMode,
      isKlingPatternMode,
      isLipSyncMode,
      isMotionMode,
      isStandardMode,
      lipSyncAudioSlot,
      motionVideoDragActive,
      motionVideoError,
      motionVideoLoading,
      motionVideoInputRef,
      motionVideoUrl,
      onClearMotionVideo,
      onExtraImageChange,
      onMotionVideoChange,
      onPrimaryImageChange,
      primaryDragActive,
      primaryImageLoading,
      primaryInputRef,
      referenceImageUrl,
      referenceOrder,
      referenceStepSubtitle,
      referenceStepTitle,
      setMotionVideoDragActive,
      standardVideoRequiresReferenceImage,
      toggleStep,
    ]
  );
  const shouldShowAddCustomShotButton = false;
  const isCustomMultiShotWorkspace = shouldShowAddCustomShotButton;
  const handleCustomShotPromptChange = React.useCallback(
    (shotId: string, value: string) => {
      updateKlingMultiPrompt(shotId, "prompt", value);
    },
    [updateKlingMultiPrompt]
  );
  const handlePrimaryPromptChange = React.useCallback(
    (value: string) => {
      if (isCustomKlingWorkflow) {
        const firstShot = klingMultiPrompts[0];
        if (firstShot) {
          updateKlingMultiPrompt(firstShot.id, "prompt", value);
          return;
        }
      }
      onPromptTextChange(value);
    },
    [isCustomKlingWorkflow, klingMultiPrompts, onPromptTextChange, updateKlingMultiPrompt]
  );
  const showShotLabels = shouldShowAddCustomShotButton;
  const totalShotCount = isCustomKlingWorkflow ? Math.max(customKlingPrompts.length, 1) : 1;
  const promptAutoResizeLayoutKey = `${visibleVideoMode}-${klingMode}-${totalShotCount}`;
  const primaryPromptValue = isCustomKlingWorkflow
    ? (customKlingPrompts[0]?.prompt ?? "")
    : (referenceText ?? "");
  const handleOpenMotionRecorder = React.useCallback(() => {
    setIsMotionRecorderOpen(true);
  }, []);
  const handleCloseMotionRecorder = React.useCallback(() => {
    setIsMotionRecorderOpen(false);
  }, []);
  const handleApplyRecordedMotionVideo = React.useCallback(
    async (upload: VideoUploadResult, sourceFile: File) => {
      try {
        if (onRecordedMotionVideoReady) {
          await onRecordedMotionVideoReady(upload, sourceFile);
        } else if (onStageMotionVideoSelection) {
          await onStageMotionVideoSelection({ videoUrl: upload.url });
        } else {
          onMotionVideoChange?.(upload.url);
        }
      } finally {
        setIsMotionRecorderOpen(false);
      }
    },
    [onMotionVideoChange, onRecordedMotionVideoReady, onStageMotionVideoSelection]
  );
  const klingElementDisplayTokens = React.useMemo(
    () => resolveAiStudioKlingElementTokens(selectedKlingElements).map((token) => token.trim()),
    [selectedKlingElements]
  );
  const klingElementCanonicalPromptTokens = React.useMemo(
    () => resolveKieKlingElementTokens(selectedKlingElements).map((token) => token.trim()),
    [selectedKlingElements]
  );
  const populatedKlingPromptTokenSlotIndexes = React.useMemo(
    () =>
      selectedKlingElements.flatMap((element, index) => {
        if (!isPromptTokenEligibleKlingElement(element)) return [];
        const token = klingElementCanonicalPromptTokens[index] ?? "";
        return token ? [index] : [];
      }),
    [klingElementCanonicalPromptTokens, selectedKlingElements]
  );
  const klingPromptAttachedSlots = React.useMemo(
    () =>
      populatedKlingPromptTokenSlotIndexes.map((slotIndex) => {
        const selectedElement = selectedKlingElements[slotIndex];
        return {
          token: klingElementCanonicalPromptTokens[slotIndex] ?? "",
          legacyAliases: selectedElement
            ? resolveAiStudioKlingElementLegacyTokens(
                selectedElement,
                slotIndex,
                selectedKlingElements
              )
            : [],
          sourceKind: selectedElement?.sourceKind ?? null,
        };
      }),
    [klingElementCanonicalPromptTokens, populatedKlingPromptTokenSlotIndexes, selectedKlingElements]
  );
  const primaryPromptPlaceholder = isLipSyncMode
    ? "Optional: describe expression, framing, body movement, or mood."
    : "Describe the shot you want to create: subject, action, camera movement, framing, lighting, and mood.";
  const primaryPromptHelperText = isLipSyncMode
    ? "Optional direction for the speaking character."
    : "Direct the shot: describe the subject, motion, camera movement, and mood you want in the clip.";
  const klingPrimaryPromptCharacterLimit =
    isKieKlingModelSelected && !isSeedance2FamilyModelSelected
      ? isCustomKlingWorkflow
        ? KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS
        : resolveKlingSinglePromptEffectiveVisibleCharacterLimit({
            prompt: primaryPromptValue,
            mode: visibleShotMode === "multi" ? "multi" : "single",
            klingElements: selectedKlingElements.filter(
              (element): element is AiStudioKlingElement =>
                isPromptTokenEligibleKlingElement(element)
            ),
          })
      : null;
  const primaryPromptCharacterCount = primaryPromptValue.length;
  const isPrimaryPromptOverKlingLimit =
    klingPrimaryPromptCharacterLimit != null &&
    primaryPromptCharacterCount > klingPrimaryPromptCharacterLimit;
  const primaryPromptCharacterCounter =
    klingPrimaryPromptCharacterLimit != null ? (
      <KlingPromptCharacterCounter
        count={primaryPromptCharacterCount}
        limit={klingPrimaryPromptCharacterLimit}
        overLimit={isPrimaryPromptOverKlingLimit}
        ariaLabel={`${
          isCustomKlingWorkflow ? "Kling shot prompt" : "Kling prompt"
        } character count: ${primaryPromptCharacterCount.toLocaleString()} / ${klingPrimaryPromptCharacterLimit.toLocaleString()}`}
      />
    ) : null;
  const primaryPromptInlineAction = (
    <div className="video-prompt-inline-action-cluster">
      {primaryPromptCharacterCounter}
      <ComposerPinButton
        text={primaryPromptValue}
        onPinTextReference={onPinPromptReference}
        className="video-prompt-pin-button"
      />
    </div>
  );
  const customKlingPromptOverLimitShots = React.useMemo(
    () =>
      isKieKlingModelSelected && !isSeedance2FamilyModelSelected && isCustomKlingWorkflow
        ? customKlingPrompts.filter(
            (shot) => shot.prompt.length > KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS
          )
        : [],
    [
      customKlingPrompts,
      isCustomKlingWorkflow,
      isKieKlingModelSelected,
      isSeedance2FamilyModelSelected,
    ]
  );
  const klingPromptGuardrailReason = React.useMemo(() => {
    if (!isKieKlingModelSelected || isSeedance2FamilyModelSelected) return null;
    if (isCustomKlingWorkflow) {
      if (!customKlingPromptOverLimitShots.length) return null;
      if (customKlingPromptOverLimitShots.length === 1) {
        return `Shot prompt exceeds Kling's ${KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS.toLocaleString()} character limit.`;
      }
      return `Multiple shot prompts exceed Kling's ${KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS.toLocaleString()} character limit.`;
    }
    if (isPrimaryPromptOverKlingLimit) {
      return `Prompt exceeds Kling's effective ${klingPrimaryPromptCharacterLimit?.toLocaleString()} character limit after hidden shot-mode direction is applied.`;
    }
    return null;
  }, [
    customKlingPromptOverLimitShots.length,
    isCustomKlingWorkflow,
    isKieKlingModelSelected,
    isPrimaryPromptOverKlingLimit,
    isSeedance2FamilyModelSelected,
    klingPrimaryPromptCharacterLimit,
  ]);
  const primaryPromptTokenDiagnostics = React.useMemo(
    () => analyzeKlingPromptTokens(primaryPromptValue, klingPromptAttachedSlots),
    [klingPromptAttachedSlots, primaryPromptValue]
  );
  const primaryPromptHighlightSegments = React.useMemo(
    () => buildKlingPromptHighlightSegments(primaryPromptValue, primaryPromptTokenDiagnostics),
    [primaryPromptTokenDiagnostics, primaryPromptValue]
  );
  const getPromptValueForTarget = React.useCallback(
    (target: KlingPromptTarget): string => {
      if (target === "primary") return primaryPromptValue;
      return customKlingPrompts.find((shot) => shot.id === target)?.prompt ?? "";
    },
    [customKlingPrompts, primaryPromptValue]
  );
  const getPromptTextareaForTarget = React.useCallback((target: KlingPromptTarget) => {
    if (target === "primary") return primaryPromptTextareaRef.current;
    return customPromptTextareaRefs.current[target] ?? null;
  }, []);
  const setActivePromptTarget = React.useCallback((target: KlingPromptTarget) => {
    activePromptTargetRef.current = target;
  }, []);
  const applyPromptUpdateForTarget = React.useCallback(
    (target: KlingPromptTarget, nextPrompt: string, caret?: number | null) => {
      if (typeof caret === "number") {
        pendingPromptCaretRef.current = {
          target,
          caret,
        };
      }
      if (target === "primary") {
        handlePrimaryPromptChange(nextPrompt);
        return;
      }
      handleCustomShotPromptChange(target, nextPrompt);
    },
    [handleCustomShotPromptChange, handlePrimaryPromptChange]
  );
  const closePromptTokenPicker = React.useCallback(() => {
    pendingPromptTokenPickerTriggerRef.current = null;
    setPromptTokenPickerState((previous) =>
      previous.isOpen
        ? {
            ...previous,
            isOpen: false,
            selectedSlotIndex: null,
          }
        : previous
    );
  }, []);
  const resolvePromptTokenPickerToken = React.useCallback(
    (slotIndex: number | null) => {
      if (slotIndex == null) return null;
      const element = selectedKlingElements[slotIndex];
      if (!element) return null;
      return buildKlingElementPromptToken(klingElementCanonicalPromptTokens[slotIndex] ?? "");
    },
    [klingElementCanonicalPromptTokens, selectedKlingElements]
  );
  const resolvePromptTokenPickerDisplayToken = React.useCallback(
    (slotIndex: number | null) => {
      if (slotIndex == null) return null;
      const element = selectedKlingElements[slotIndex];
      if (!element) return null;
      return buildKlingElementPromptToken(klingElementDisplayTokens[slotIndex] ?? "");
    },
    [klingElementDisplayTokens, selectedKlingElements]
  );
  const cyclePromptTokenPickerSelection = React.useCallback(
    (direction: 1 | -1) => {
      if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
      setPromptTokenPickerState((previous) => {
        if (!previous.isOpen) return previous;
        const currentSelection =
          previous.selectedSlotIndex ?? populatedKlingPromptTokenSlotIndexes[0] ?? null;
        const currentIndex = populatedKlingPromptTokenSlotIndexes.indexOf(currentSelection ?? -1);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          (safeCurrentIndex + direction + populatedKlingPromptTokenSlotIndexes.length) %
          populatedKlingPromptTokenSlotIndexes.length;
        return {
          ...previous,
          selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[nextIndex] ?? null,
        };
      });
    },
    [populatedKlingPromptTokenSlotIndexes]
  );
  const openPromptTokenPickerAtSelection = React.useCallback(
    (target: KlingPromptTarget, selectionStart: number, selectionEnd: number) => {
      if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
      const promptValue = getPromptValueForTarget(target);
      const normalizedSelectionStart = Math.max(0, Math.min(promptValue.length, selectionStart));
      const normalizedSelectionEnd = Math.max(0, Math.min(promptValue.length, selectionEnd));
      setPromptTokenPickerState({
        isOpen: true,
        selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
        replaceStart: Math.min(normalizedSelectionStart, normalizedSelectionEnd),
        replaceEnd: Math.max(normalizedSelectionStart, normalizedSelectionEnd),
        target,
      });
    },
    [getPromptValueForTarget, populatedKlingPromptTokenSlotIndexes]
  );
  const insertKlingElementToken = React.useCallback(
    (token: string) => {
      const target = activePromptTargetRef.current;
      const promptValue = getPromptValueForTarget(target);
      const textarea = getPromptTextareaForTarget(target);
      const selectionStart = textarea?.selectionStart ?? promptValue.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const normalizedToken = buildKlingElementPromptToken(token);
      if (!normalizedToken) return;
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token: normalizedToken,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget(target, insertedPrompt.prompt, insertedPrompt.caret);
    },
    [
      applyPromptUpdateForTarget,
      closePromptTokenPicker,
      getPromptTextareaForTarget,
      getPromptValueForTarget,
    ]
  );
  const insertPromptTokenFromPicker = React.useCallback(
    (slotIndex: number) => {
      const token = resolvePromptTokenPickerToken(slotIndex);
      if (!token) return;
      const promptValue = getPromptValueForTarget(promptTokenPickerState.target);
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token,
        selectionStart: promptTokenPickerState.replaceStart,
        selectionEnd: promptTokenPickerState.replaceEnd,
      });
      applyPromptUpdateForTarget(
        promptTokenPickerState.target,
        insertedPrompt.prompt,
        insertedPrompt.caret
      );
      setPromptTokenPickerState((previous) => ({
        ...previous,
        isOpen: false,
        selectedSlotIndex: null,
      }));
    },
    [
      applyPromptUpdateForTarget,
      getPromptValueForTarget,
      promptTokenPickerState.replaceEnd,
      promptTokenPickerState.replaceStart,
      promptTokenPickerState.target,
      resolvePromptTokenPickerToken,
    ]
  );
  const handlePromptDropWithKlingTokenInsert = React.useCallback(
    (
      event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>,
      options?: { shotId?: string; promptValue?: string }
    ) => {
      const target: KlingPromptTarget = options?.shotId ?? "primary";
      setActivePromptTarget(target);
      const droppedToken = extractKlingElementPromptTokenFromTransfer(event.dataTransfer);
      const promptValue = options?.promptValue ?? primaryPromptValue;
      const targetTextarea =
        event.target instanceof HTMLTextAreaElement
          ? event.target
          : options?.shotId
            ? customPromptTextareaRefs.current[options.shotId]
            : primaryPromptTextareaRef.current;
      if (!droppedToken) {
        event.preventDefault();
        const promptText = extractPromptDropText(event.dataTransfer);
        if (!promptText) return;
        closePromptTokenPicker();
        const selectionStart = targetTextarea?.selectionStart ?? promptValue.length;
        const selectionEnd = targetTextarea?.selectionEnd ?? selectionStart;
        const nextPrompt = resolveDroppedPromptTextEdit({
          composerText: promptValue,
          droppedPromptText: promptText,
          selectionStart,
          selectionEnd,
          editMode: resolveDroppedPromptTextEditMode(event),
        });
        applyPromptUpdateForTarget(target, nextPrompt.prompt, nextPrompt.caret);
        return;
      }
      event.preventDefault();
      const selectionStart = targetTextarea?.selectionStart ?? promptValue.length;
      const selectionEnd = targetTextarea?.selectionEnd ?? selectionStart;
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token: droppedToken,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget(target, insertedPrompt.prompt, insertedPrompt.caret);
    },
    [applyPromptUpdateForTarget, closePromptTokenPicker, primaryPromptValue, setActivePromptTarget]
  );
  const [isPromptCanvasTearOutActive, setIsPromptCanvasTearOutActive] = React.useState(false);
  const canAcceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) =>
      payload.kind === "text" && payload.text.trim().length > 0,
    []
  );
  const acceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "text") return;
      const droppedText = payload.text.trim();
      if (!droppedText) return;
      const textarea = primaryPromptTextareaRef.current;
      const shouldUseTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart = shouldUseTextareaSelection
        ? (textarea?.selectionStart ?? primaryPromptValue.length)
        : primaryPromptValue.length;
      const selectionEnd = shouldUseTextareaSelection
        ? (textarea?.selectionEnd ?? primaryPromptValue.length)
        : primaryPromptValue.length;
      const insertedPrompt = insertDroppedPromptTextAtSelection({
        composerText: primaryPromptValue,
        droppedPromptText: droppedText,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget("primary", insertedPrompt.prompt, insertedPrompt.caret);
      const restoreCaret = () => {
        const activeTextarea = primaryPromptTextareaRef.current;
        activeTextarea?.focus();
        activeTextarea?.setSelectionRange(insertedPrompt.caret, insertedPrompt.caret);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreCaret);
      } else {
        restoreCaret();
      }
    },
    [applyPromptUpdateForTarget, closePromptTokenPicker, primaryPromptValue]
  );

  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !primaryPromptShellRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-primary-prompt-composer",
      element: primaryPromptShellRef.current,
      canAccept: canAcceptPromptCanvasTearOutPayload,
      accept: acceptPromptCanvasTearOutPayload,
      setActive: setIsPromptCanvasTearOutActive,
    });
  }, [
    acceptPromptCanvasTearOutPayload,
    canAcceptPromptCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
  ]);
  const handlePromptSelection = React.useCallback(
    (target: KlingPromptTarget) => {
      setActivePromptTarget(target);
    },
    [setActivePromptTarget]
  );
  const handlePromptBlur = React.useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest(".video-kling-prompt-token-picker")) {
        return;
      }
      closePromptTokenPicker();
    },
    [closePromptTokenPicker]
  );
  const handlePromptKeyDown = React.useCallback(
    (
      event: React.KeyboardEvent<HTMLTextAreaElement>,
      options?: { shotId?: string; promptValue?: string }
    ) => {
      const target: KlingPromptTarget = options?.shotId ?? "primary";
      setActivePromptTarget(target);
      const promptValue = options?.promptValue ?? event.currentTarget.value;
      if (promptTokenPickerState.isOpen && promptTokenPickerState.target === target) {
        if (event.key === "Tab") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === "Enter") {
          if (promptTokenPickerState.selectedSlotIndex != null) {
            event.preventDefault();
            insertPromptTokenFromPicker(promptTokenPickerState.selectedSlotIndex);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closePromptTokenPicker();
          return;
        }
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(1);
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(-1);
          return;
        }
        if (
          event.key === "Backspace" ||
          event.key === "Delete" ||
          (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey)
        ) {
          closePromptTokenPicker();
        }
      }

      if (
        event.key === "Tab" &&
        !event.defaultPrevented &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        populatedKlingPromptTokenSlotIndexes.length > 0
      ) {
        event.preventDefault();
        const selectionStart = event.currentTarget.selectionStart ?? promptValue.length;
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
        openPromptTokenPickerAtSelection(target, selectionStart, selectionEnd);
        return;
      }

      if (
        event.key === "@" &&
        !event.defaultPrevented &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        populatedKlingPromptTokenSlotIndexes.length > 0
      ) {
        pendingPromptTokenPickerTriggerRef.current = {
          target,
          selectionStart: event.currentTarget.selectionStart ?? promptValue.length,
          selectionEnd: event.currentTarget.selectionEnd ?? promptValue.length,
        };
      }
    },
    [
      closePromptTokenPicker,
      cyclePromptTokenPickerSelection,
      insertPromptTokenFromPicker,
      openPromptTokenPickerAtSelection,
      populatedKlingPromptTokenSlotIndexes.length,
      promptTokenPickerState.isOpen,
      promptTokenPickerState.selectedSlotIndex,
      promptTokenPickerState.target,
      setActivePromptTarget,
    ]
  );
  const customShotWorkspaceStyle = isCustomMultiShotWorkspace
    ? ({ "--video-shot-count": totalShotCount } as React.CSSProperties)
    : undefined;

  React.useLayoutEffect(() => {
    if (!isCustomMultiShotWorkspace) return;
    const scrollContainer = shotWorkspaceScrollRef.current;
    const stack = shotWorkspaceStackRef.current;
    if (!scrollContainer || !stack) return;

    const scrollToBottom = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    scrollToBottom();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });
    observer.observe(stack);
    return () => observer.disconnect();
  }, [isCustomMultiShotWorkspace]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      shotWorkspaceStackRef.current
        ?.querySelectorAll<HTMLTextAreaElement>(
          ".video-secondary-prompt-shell .enhanced-prompt-input"
        )
        .forEach((textarea) => {
          resizeTextareaToViewport(textarea);
        });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [customKlingPrompts, promptAutoResizeLayoutKey, resizeTextareaToViewport]);

  React.useEffect(() => {
    const handleViewportResize = () => {
      shotWorkspaceStackRef.current
        ?.querySelectorAll<HTMLTextAreaElement>(
          ".video-secondary-prompt-shell .enhanced-prompt-input"
        )
        .forEach((textarea) => {
          resizeTextareaToViewport(textarea);
        });
    };
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, [resizeTextareaToViewport]);

  React.useEffect(() => {
    const pendingCaret = pendingPromptCaretRef.current;
    if (!pendingCaret) return;
    const textarea =
      pendingCaret.target === "primary"
        ? primaryPromptTextareaRef.current
        : customPromptTextareaRefs.current[pendingCaret.target];
    if (!textarea) return;
    const maxCaret = Math.max(0, Math.min(textarea.value.length, pendingCaret.caret));
    textarea.focus();
    textarea.setSelectionRange(maxCaret, maxCaret);
    pendingPromptCaretRef.current = null;
  }, [customKlingPrompts, primaryPromptValue]);

  React.useEffect(() => {
    const pendingTrigger = pendingPromptTokenPickerTriggerRef.current;
    if (!pendingTrigger) return;
    pendingPromptTokenPickerTriggerRef.current = null;
    if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
    const promptValue = getPromptValueForTarget(pendingTrigger.target);
    const replaceStart = Math.max(0, Math.min(promptValue.length, pendingTrigger.selectionStart));
    const replaceEnd = Math.min(promptValue.length, replaceStart + 1);
    if (promptValue.slice(replaceStart, replaceEnd) !== "@") return;
    setPromptTokenPickerState({
      isOpen: true,
      selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
      replaceStart,
      replaceEnd,
      target: pendingTrigger.target,
    });
  }, [
    customKlingPrompts,
    getPromptValueForTarget,
    populatedKlingPromptTokenSlotIndexes,
    primaryPromptValue,
  ]);

  React.useEffect(() => {
    if (!promptTokenPickerState.isOpen) return;
    if (populatedKlingPromptTokenSlotIndexes.length <= 0) {
      closePromptTokenPicker();
      return;
    }
    if (
      promptTokenPickerState.selectedSlotIndex == null ||
      !populatedKlingPromptTokenSlotIndexes.includes(promptTokenPickerState.selectedSlotIndex)
    ) {
      setPromptTokenPickerState((previous) => ({
        ...previous,
        selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
      }));
    }
  }, [
    closePromptTokenPicker,
    populatedKlingPromptTokenSlotIndexes,
    promptTokenPickerState.isOpen,
    promptTokenPickerState.selectedSlotIndex,
  ]);

  const renderPromptTokenPicker = React.useCallback(
    (target: KlingPromptTarget) => {
      if (!promptTokenPickerState.isOpen || promptTokenPickerState.target !== target) {
        return null;
      }

      return (
        <VideoPromptTokenPicker
          slotIndexes={populatedKlingPromptTokenSlotIndexes}
          selectedSlotIndex={promptTokenPickerState.selectedSlotIndex}
          elements={selectedKlingElements}
          resolveDisplayToken={resolvePromptTokenPickerDisplayToken}
          onInsertToken={insertPromptTokenFromPicker}
        />
      );
    },
    [
      insertPromptTokenFromPicker,
      populatedKlingPromptTokenSlotIndexes,
      promptTokenPickerState.isOpen,
      promptTokenPickerState.selectedSlotIndex,
      promptTokenPickerState.target,
      resolvePromptTokenPickerDisplayToken,
      selectedKlingElements,
    ]
  );

  return (
    <div className="tool-properties reference-properties-panel video-properties-panel">
      <div className="video-properties-workspace">
        <div className="reference-drop-layout-inner video-properties-primary-column">
          <div className="video-properties-main-columns">
            <div className="video-properties-main-column video-properties-main-column--left">
              <div className="video-setup-row-shell">
                <div className="video-panel-title">Video Setup</div>
                <div className="video-setup-columns">
                  <div className="video-setup-column video-setup-column--single">
                    <VideoModeTabs
                      visibleVideoMode={visibleVideoMode}
                      videoModeIndex={videoModeIndex}
                      style={videoModeTabsStyle}
                      onVideoReferenceModeChange={onVideoReferenceModeChange}
                    />
                    {!isLipSyncMode ? (
                      <div className="video-setup-settings-slot">
                        <ReferenceVideoSettingsStep
                          isVideoVariant={true}
                          isMotionMode={isMotionMode}
                          multiShotShotCount={0}
                          modelId={modelId}
                          modelLabel={modelLabel}
                          modelLogoSrc={modelLogoSrc}
                          isModelModalOpen={isModelModalOpen}
                          modelModalAnchor={modelModalAnchor}
                          modelModalContext={modelPickerContext}
                          aspect={aspect}
                          aspectOptionsForModel={aspectOptionsForModel}
                          videoSettingsOrder={videoSettingsOrder}
                          motionAudioOrder={motionAudioOrder}
                          videoDurationValue={videoDurationValue}
                          videoResolutionValue={videoResolutionValue}
                          durationOptions={durationOptions}
                          resolutionOptions={resolutionOptions}
                          videoGenerateAudioValue={videoGenerateAudioValue}
                          isVeoModel={isVeoModel}
                          videoAutoFix={videoAutoFix}
                          onAspectChange={onAspectChange}
                          onModelPickerOpen={onModelPickerOpen}
                          onVideoDurationChange={onVideoDurationChange}
                          onVideoResolutionChange={onVideoResolutionChange}
                          onVideoGenerateAudioChange={onVideoGenerateAudioChange}
                          onVideoAutoFixChange={onVideoAutoFixChange}
                        />
                      </div>
                    ) : null}
                    {isMotionMode && !motionVideoUrl ? (
                      <VideoMotionRecorderLaunch onOpenMotionRecorder={handleOpenMotionRecorder} />
                    ) : null}
                    {!isLipSyncMode && (!isSeedance2FamilyModelSelected || isMotionMode) ? (
                      <div className="video-setup-reference-slot">{renderReferenceMediaStep()}</div>
                    ) : null}
                    {isLipSyncMode ? (
                      <VideoLipSyncSetup
                        settingsProps={{
                          title: "Lip Sync Settings",
                          showModelRow: false,
                          showAspectControl: false,
                          showDurationControl: false,
                          showGenerateAudioControl: false,
                          resolutionAriaLabel: "Lip Sync resolution",
                          modelId,
                          modelLabel,
                          modelLogoSrc,
                          isModelModalOpen,
                          modelModalAnchor,
                          modelModalContext: modelPickerContext,
                          aspect,
                          aspectOptionsForModel,
                          videoDurationValue,
                          videoResolutionValue,
                          durationOptions,
                          resolutionOptions,
                          videoGenerateAudioValue,
                          isMotionMode: false,
                          isVeoModel,
                          videoAutoFix,
                          onAspectChange,
                          onModelPickerOpen,
                          onVideoDurationChange,
                          onVideoResolutionChange,
                          onVideoGenerateAudioChange,
                          onVideoAutoFixChange,
                        }}
                        lipSyncAudioInputRef={lipSyncAudioInputRef}
                        handleLipSyncAudioSelection={handleLipSyncAudioSelection}
                        lipSyncTurboMode={lipSyncTurboMode}
                        onLipSyncTurboModeChange={onLipSyncTurboModeChange}
                        showTurboControl={SHOW_LIP_SYNC_TURBO_CONTROL}
                        referenceMediaStep={renderReferenceMediaStep()}
                      />
                    ) : null}
                    <MotionRecorderModal
                      isOpen={isMotionMode && isMotionRecorderOpen}
                      onClose={handleCloseMotionRecorder}
                      onApplyVideo={handleApplyRecordedMotionVideo}
                    />
                    {shouldShowVideoElementSettings ? (
                      <VideoAssetSlotsCard
                        isSeedance2FamilyModelSelected={isSeedance2FamilyModelSelected}
                        shouldShowShotModeSelector={shouldShowShotModeSelector}
                        visibleShotMode={visibleShotMode}
                        shotModeTabCount={shotModeTabCount}
                        handleSetKlingWorkflowMode={handleSetKlingWorkflowMode}
                        seedanceReferenceMode={seedanceReferenceMode}
                        handleSetSeedanceReferenceMode={handleSetSeedanceReferenceMode}
                        referenceMediaStep={renderReferenceMediaStep()}
                        renderPromptTokenPicker={renderPromptTokenPicker}
                        activePromptTarget={activePromptTargetRef.current}
                        seedanceSlotLimitWarning={seedanceSlotLimitWarning}
                        klingElementSlotCount={klingElementSlotCount}
                        modelVisibleKlingElements={modelVisibleKlingElements}
                        klingElementCanonicalPromptTokens={klingElementCanonicalPromptTokens}
                        seedanceElementImageDragActive={seedanceElementImageDragActive}
                        seedanceElementImageLoading={seedanceElementImageLoading}
                        seedanceElementImageInputRefs={seedanceElementImageInputRefs}
                        seedanceElementSlotRefs={seedanceElementSlotRefs}
                        handleSeedanceElementMediaDragEnter={handleSeedanceElementMediaDragEnter}
                        handleSeedanceElementMediaDragOver={handleSeedanceElementMediaDragOver}
                        handleSeedanceElementMediaDragLeave={handleSeedanceElementMediaDragLeave}
                        handleSeedanceElementMediaDrop={handleSeedanceElementMediaDrop}
                        handleSeedanceElementMediaFileSelection={
                          handleSeedanceElementMediaFileSelection
                        }
                        openElementPicker={openElementPicker}
                        removeSelectedElement={removeSelectedElement}
                        elementPickerError={elementPickerError}
                      />
                    ) : null}
                    {!isLipSyncMode && !isKieKlingModelSelected && !isAnySeedanceModelSelected ? (
                      <p className="video-kling-tip">
                        Tip: Switch to the Kling 3.0 model to access multi-shot capability.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="video-properties-main-column video-properties-main-column--right">
              <div
                className={`video-direction-column-shell ${
                  hasAnyPromptText ? "has-active-prompt-content" : ""
                } ${isCustomMultiShotWorkspace ? "is-custom-multishot-workspace" : ""}`}
              >
                {!hasAnyPromptText && !isCustomMultiShotWorkspace ? (
                  <p className="video-panel-hero-text">How will you direct this scene?</p>
                ) : null}
                <div className="video-shot-workspace-shell" style={customShotWorkspaceStyle}>
                  <div className="video-shot-workspace-scroll">
                    <div className="video-shot-scroll-viewport" ref={shotWorkspaceScrollRef}>
                      <div className="video-shot-workspace-stack" ref={shotWorkspaceStackRef}>
                        <div className="video-prompt-generate-row">
                          <div className="video-prompt-generate-main">
                            <div className="video-prompt-stack">
                              <div
                                ref={primaryPromptShellRef}
                                className={`video-primary-prompt-shell ${isPromptCanvasTearOutActive ? "is-dragging" : ""}`.trim()}
                              >
                                {showShotLabels ? (
                                  <div className="video-shot-label-row video-shot-label-row--primary">
                                    <span className="video-shot-label-pill">Shot 1</span>
                                    <span className="video-shot-label-divider" aria-hidden="true" />
                                  </div>
                                ) : null}
                                <ReferencePromptStep
                                  promptBadge={promptBadge}
                                  promptOrder={promptOrder}
                                  referenceText={primaryPromptValue}
                                  onPromptTextChange={handlePrimaryPromptChange}
                                  collapsed={collapsedSteps.prompt}
                                  onToggleCollapse={() => toggleStep("prompt")}
                                  onDrop={handlePromptDropWithKlingTokenInsert}
                                  agentIsSending={false}
                                  showEnhanceButton={false}
                                  hideHeader={true}
                                  autoResize
                                  autoResizeLayoutKey={promptAutoResizeLayoutKey}
                                  promptPlaceholder={primaryPromptPlaceholder}
                                  promptHelperText={primaryPromptHelperText}
                                  promptTextareaRef={primaryPromptTextareaRef}
                                  promptHighlightSegments={primaryPromptHighlightSegments}
                                  promptInlineAction={primaryPromptInlineAction}
                                  promptInlineActionClassName="video-prompt-inline-action-slot"
                                  onPromptFocus={() => handlePromptSelection("primary")}
                                  onPromptBlur={handlePromptBlur}
                                  onPromptSelect={() => handlePromptSelection("primary")}
                                  onPromptKeyDown={handlePromptKeyDown}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        {customKlingPrompts.slice(1).map((shot, index) => {
                          const promptTokenDiagnostics = analyzeKlingPromptTokens(
                            shot.prompt,
                            klingPromptAttachedSlots
                          );
                          const promptHighlightSegments = buildKlingPromptHighlightSegments(
                            shot.prompt,
                            promptTokenDiagnostics
                          );
                          const hasPromptTokenHighlight = promptHighlightSegments.some(
                            (segment) => segment.kind !== "plain"
                          );

                          return (
                            <div className="video-secondary-prompt-shell" key={shot.id}>
                              {showShotLabels ? (
                                <div className="video-shot-label-row">
                                  <span className="video-shot-label-pill">{`Shot ${index + 2}`}</span>
                                  <button
                                    type="button"
                                    className="video-shot-remove-button"
                                    aria-label={`Remove shot ${index + 2}`}
                                    onClick={() => removeKlingShot(shot.id)}
                                  >
                                    <Trash size={14} weight="regular" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : null}
                              <div
                                className={`prompt-enhanced-wrapper ${
                                  hasPromptTokenHighlight ? "has-token-highlight" : ""
                                }`.trim()}
                              >
                                {hasPromptTokenHighlight ? (
                                  <div
                                    className="prompt-token-highlight"
                                    aria-hidden="true"
                                    ref={(node) => {
                                      customPromptHighlightRefs.current[shot.id] = node;
                                    }}
                                  >
                                    {promptHighlightSegments.map((segment, segmentIndex) => (
                                      <span
                                        key={`custom-shot-highlight-${shot.id}-${segmentIndex}-${segment.kind}`}
                                        className={`prompt-token-highlight-segment is-${segment.kind}`}
                                      >
                                        {segment.text}
                                      </span>
                                    ))}
                                    <span className="prompt-token-highlight-segment prompt-token-highlight-segment--buffer">
                                      {"\n"}
                                    </span>
                                  </div>
                                ) : null}
                                <textarea
                                  className="prompt-input agent-step-textarea enhanced-prompt-input"
                                  ref={(node) => {
                                    customPromptTextareaRefs.current[shot.id] = node;
                                  }}
                                  value={shot.prompt}
                                  onFocus={() => handlePromptSelection(shot.id)}
                                  onBlur={handlePromptBlur}
                                  onChange={(event) =>
                                    handleCustomShotPromptChange(shot.id, event.target.value)
                                  }
                                  onKeyDown={(event) =>
                                    handlePromptKeyDown(event, {
                                      shotId: shot.id,
                                      promptValue: shot.prompt,
                                    })
                                  }
                                  onSelect={() => handlePromptSelection(shot.id)}
                                  onInput={(event) =>
                                    resizeTextareaToViewport(
                                      event.currentTarget as HTMLTextAreaElement
                                    )
                                  }
                                  onScroll={(event) =>
                                    syncTextareaMirrorScroll({
                                      textarea: event.currentTarget,
                                      mirror: customPromptHighlightRefs.current[shot.id],
                                    })
                                  }
                                  onDrop={(event) =>
                                    handlePromptDropWithKlingTokenInsert(event, {
                                      shotId: shot.id,
                                      promptValue: shot.prompt,
                                    })
                                  }
                                  onDragOver={(event) => event.preventDefault()}
                                  rows={4}
                                  placeholder={`Describe shot ${index + 2}.`}
                                />
                                <div className="prompt-inline-action-slot video-prompt-character-inline-slot">
                                  <KlingPromptCharacterCounter
                                    count={shot.prompt.length}
                                    limit={KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS}
                                    overLimit={
                                      shot.prompt.length > KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS
                                    }
                                    ariaLabel={`Kling shot prompt character count: ${shot.prompt.length.toLocaleString()} / ${KLING_MULTI_SHOT_PROMPT_MAX_CHARACTERS.toLocaleString()}`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <VideoGenerateFooter
                  visibleVideoMode={visibleVideoMode}
                  videoModeSummaryLabel={videoModeSummaryLabel}
                  shotModeSummaryLabel={shotModeSummaryLabel}
                  shouldShowKlingReferenceImageWarning={shouldShowKlingReferenceImageWarning}
                  referenceImageWarning={referenceImageWarning}
                  klingPromptGuardrailReason={klingPromptGuardrailReason}
                  isGenerateDisabled={isGenerateDisabled}
                  guardrailReason={guardrailReason}
                  hasRequiredPromptForGenerate={hasRequiredPromptForGenerate}
                  isStylesPanelOpen={isStylesPanelOpen}
                  selectedStyleId={selectedStyleId}
                  stylesCatalog={stylesCatalog}
                  onStylesPanelToggle={onStylesPanelToggle}
                  onRegenerate={onRegenerate}
                  costCredits={costCredits}
                  generationAccessCta={generationAccessCta}
                />
              </div>
            </div>
          </div>
          {shouldShowKlingAdvancedSteps ? (
            <ReferenceKlingAdvancedSteps
              isKling3Mode={isKlingPatternMode}
              isKieKlingModel={isKieKlingWorkspace}
              workflowLabel="Kling 3.0"
              assetReferenceNoun="element"
              supportsVoiceControls={!isKieKlingWorkspace}
              supportsNegativePrompt={!isKieKlingWorkspace}
              supportsCfgScale
              klingAdvancedOrder={klingAdvancedOrder}
              klingAssetsOrder={klingAssetsOrder}
              klingGuidanceOrder={klingGuidanceOrder}
              collapsedKlingAdvanced={collapsedSteps.klingAdvanced}
              collapsedKlingAssets={collapsedSteps.klingAssets}
              collapsedKlingGuidance={collapsedSteps.klingGuidance}
              klingShotSummary={klingShotSummary}
              klingAssetsSummary={klingAssetsSummary}
              klingGuidanceSummary={klingGuidanceSummary}
              klingShotType={klingShotType}
              klingMultiPrompts={klingMultiPrompts}
              klingElements={modelVisibleKlingElements}
              klingVoiceIds={klingVoiceIds}
              klingCfgScale={klingCfgScale}
              klingNegativePrompt={klingNegativePrompt}
              onExpandKlingAdvanced={() => expandIfCollapsed("klingAdvanced")}
              onExpandKlingAssets={() => expandIfCollapsed("klingAssets")}
              onExpandKlingGuidance={() => expandIfCollapsed("klingGuidance")}
              onToggleKlingAdvanced={() => toggleStep("klingAdvanced")}
              onToggleKlingAssets={() => toggleStep("klingAssets")}
              onToggleKlingGuidance={() => toggleStep("klingGuidance")}
              onKlingShotTypeChange={onKlingShotTypeChange}
              onKlingVoiceIdChange={onKlingVoiceIdChange}
              onKlingCfgScaleChange={onKlingCfgScaleChange}
              onKlingNegativePromptChange={onKlingNegativePromptChange}
              onInsertKlingElementToken={insertKlingElementToken}
              onOpenKlingElementPicker={openElementPicker}
              addKlingShot={addKlingShot}
              removeKlingShot={removeKlingShot}
              updateKlingMultiPrompt={updateKlingMultiPrompt}
              addKlingElement={addKlingElement}
              removeKlingElement={removeKlingElement}
              updateKlingElement={updateKlingElement}
            />
          ) : null}
        </div>
      </div>
      <ElementPickerModal
        isOpen={isElementPickerOpen}
        onClose={closeElementPicker}
        onCreateCharacter={onCreateCharacter}
        onCreateElement={onCreateElement}
        onSelect={handleElementSelection}
        selectedEntities={selectedKlingElements
          .filter((element): element is NonNullable<(typeof selectedKlingElements)[number]> =>
            isPromptTokenEligibleKlingElement(element)
          )
          .flatMap(
            (
              element
            ): Array<{
              sourceKind: AiStudioKlingSavedEntitySourceKind;
              sourceId: string;
              sourceCharacterLookId?: string | null;
            }> => {
              const sourceKind: AiStudioKlingSavedEntitySourceKind | null =
                element.sourceCharacterId
                  ? "character"
                  : element.sourceElementId
                    ? "element"
                    : null;
              const sourceId = element.sourceCharacterId ?? element.sourceElementId ?? "";
              if (!sourceKind || !sourceId) return [];
              return [
                {
                  sourceKind,
                  sourceId,
                  sourceCharacterLookId:
                    sourceKind === "character" ? (element.sourceCharacterLookId ?? null) : null,
                },
              ];
            }
          )}
        selectedSourceKind={
          elementPickerSlotIndex != null
            ? selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterId
              ? "character"
              : selectedKlingElements[elementPickerSlotIndex]?.sourceElementId
                ? "element"
                : null
            : null
        }
        selectedSourceId={
          elementPickerSlotIndex != null &&
          isPromptTokenEligibleKlingElement(selectedKlingElements[elementPickerSlotIndex])
            ? (selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterId ??
              selectedKlingElements[elementPickerSlotIndex]?.sourceElementId ??
              null)
            : null
        }
        selectedSourceCharacterLookId={
          elementPickerSlotIndex != null &&
          selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterId
            ? (selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterLookId ?? null)
            : null
        }
      />
    </div>
  );
}
