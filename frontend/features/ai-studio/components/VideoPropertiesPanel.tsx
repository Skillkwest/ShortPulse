/**
 * Dedicated properties panel for the Video workflow.
 */
import React from "react";
import { Trash } from "phosphor-react";
import { AppMessage } from "../../../components/AppMessage";
import type { AspectOption, LipSyncAudioState, VideoReferenceMode } from "../types";
import { modelLogos } from "../constants";
import { AgentGenerateButton } from "../../../prefabs/agent";
import { extractPromptDropText } from "../utils/dragDrop";
import { insertDroppedPromptTextAtSelection } from "./promptStep/agentComposerDrop";
import { ElementPickerModal } from "./ElementPickerModal";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceKlingAdvancedSteps } from "./ReferenceKlingAdvancedSteps";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { AiStudioRecordPanelPrefab } from "./AiStudioRecordPanelPrefab";
import { MotionRecorderModal } from "./MotionRecorderModal";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { ComposerPinButton } from "./shared/ComposerPinButton";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";
import { ReferenceAudioPlayer } from "./shared/ReferenceAudioPlayer";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  createEmptyLipSyncAudioState,
  createFailedLipSyncAudioState,
  createFailedNonDurableLipSyncAudioState,
  createLipSyncAudioStateFromDurableUrl,
  createReadyLipSyncAudioState,
  createUploadingLipSyncAudioState,
  getLipSyncAudioPlaybackUrl,
  isNonDurableLipSyncAudioUrl,
} from "../logic/lipSyncAudioState";
import { uploadAudioAssetToStorage } from "../utils/audioUpload";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";
import { isSeedance2UiEnabled } from "../logic/seedance2Availability";
import {
  getAiStudioKlingElementReferenceUrls,
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  type AiStudioKlingEntitySourceKind,
  type AiStudioKlingElement,
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
  setKlingElementPromptTokenDragData,
} from "../logic/klingPromptReferences";
import { insertPromptTokenAtSelection } from "../logic/promptTokenInsertion";
import { buildElementProfileImageBackgroundStyle } from "../../elements-manager/logic/elementProfileImageTransform";
import { syncTextareaMirrorScroll } from "./edit/expertEditInteractionUtils";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";

const VIDEO_KLING_ELEMENT_SLOT_COUNT = 3;
const VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT = 6;
const VIDEO_KLING_ELEMENT_SLOT_SIZE = 68;

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
  videoCameraFixed?: boolean;
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
  onVideoCameraFixedChange?: (value: boolean) => void;
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
  onRegenerate: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
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
  videoCameraFixed = false,
  videoAutoFix = false,
  seedance2InputMode = "text",
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
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
  onRegenerate,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceImageDropSource,
  canvasTearOutTargetRegistry,
  costCredits,
  isGenerateDisabled = false,
  guardrailReason = null,
  referenceImageWarning = null,
  onCreateCharacter,
  onCreateElement,
}: VideoPropertiesPanelProps) {
  type KlingPromptTarget = "primary" | string;
  const shotWorkspaceScrollRef = React.useRef<HTMLDivElement | null>(null);
  const shotWorkspaceStackRef = React.useRef<HTMLDivElement | null>(null);
  const primaryPromptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const primaryPromptShellRef = React.useRef<HTMLDivElement | null>(null);
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
  const lipSyncAudioInputRef = React.useRef<HTMLInputElement | null>(null);
  const lipSyncAudioDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const [lipSyncAudioDragActive, setLipSyncAudioDragActive] = React.useState(false);
  const [lipSyncAudioCanvasTearOutActive, setLipSyncAudioCanvasTearOutActive] =
    React.useState(false);
  const lipSyncAudioUploadRevisionRef = React.useRef(0);
  const lipSyncAudioObjectUrlsRef = React.useRef<Set<string>>(new Set());
  const [elementPickerError, setElementPickerError] = React.useState<string | null>(null);
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
  const {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    motionVideoInputRef,
    primaryDragActive,
    extraDragActive,
    primaryImageLoading,
    extraImageLoading,
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
    handlePrimaryDrop,
    handleExtraDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    acceptPrimaryCanvasTearOutPayload,
    acceptExtraCanvasTearOutPayload,
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
    onMotionVideoChange,
    onStageMotionVideoSelection,
    resolvePreviewUrlById,
    resolveMotionVideoUrlById,
    resolveInternalReferenceImageDropSource,
    klingMultiPrompts,
    onKlingMultiPromptsChange,
    klingElements,
    onKlingElementsChange,
  });
  const applyLipSyncAudio = React.useCallback(
    (value: LipSyncAudioState) => {
      onLipSyncAudioChange?.(value);
    },
    [onLipSyncAudioChange]
  );
  React.useEffect(
    () => () => {
      lipSyncAudioObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      lipSyncAudioObjectUrlsRef.current.clear();
    },
    []
  );
  const readLipSyncAudioDuration = React.useCallback((audioUrl: string): Promise<number | null> => {
    if (typeof Audio === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const audio = new Audio();
      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
      audio.onloadedmetadata = () => {
        const durationMs = Number.isFinite(audio.duration)
          ? Math.max(0, Math.round(audio.duration * 1000))
          : null;
        cleanup();
        resolve(durationMs);
      };
      audio.onerror = () => {
        cleanup();
        resolve(null);
      };
      audio.src = audioUrl.replace(/#.*$/, "");
    });
  }, []);
  const handleLipSyncAudioFile = React.useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const uploadRevision = lipSyncAudioUploadRevisionRef.current + 1;
      lipSyncAudioUploadRevisionRef.current = uploadRevision;
      const objectUrl = URL.createObjectURL(file);
      lipSyncAudioObjectUrlsRef.current.add(objectUrl);
      const previewUrl = `${objectUrl}#audio=1`;
      const durationMs = await readLipSyncAudioDuration(previewUrl);
      applyLipSyncAudio(
        createUploadingLipSyncAudioState({
          durationMs,
          previewUrl,
          mimeType: file.type || null,
          size: file.size,
        })
      );
      try {
        const uploaded = await uploadAudioAssetToStorage(previewUrl);
        if (lipSyncAudioUploadRevisionRef.current !== uploadRevision) return;
        applyLipSyncAudio(
          createReadyLipSyncAudioState({
            url: uploaded.url,
            durationMs,
            sourceKind: "local",
            storagePath: uploaded.path,
            previewUrl,
            mimeType: uploaded.mimeType ?? file.type ?? null,
            size: uploaded.size,
          })
        );
      } catch (error) {
        if (lipSyncAudioUploadRevisionRef.current !== uploadRevision) return;
        applyLipSyncAudio(
          createFailedLipSyncAudioState({
            durationMs,
            previewUrl,
            error:
              error instanceof Error
                ? error.message
                : "Voice audio upload failed. Re-add the audio file and try again.",
            mimeType: file.type || null,
            size: file.size,
          })
        );
      }
    },
    [applyLipSyncAudio, readLipSyncAudioDuration]
  );
  const handleLipSyncAudioSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void handleLipSyncAudioFile(event.target.files?.[0]);
      event.target.value = "";
    },
    [handleLipSyncAudioFile]
  );
  const handleLipSyncAudioDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setLipSyncAudioDragActive(false);
      const libraryPayload = readMediaLibraryDragPayload(event.dataTransfer);
      if (libraryPayload?.kind === "libraryMedia" && libraryPayload.payload.fileType === "audio") {
        const audioUrl =
          libraryPayload.payload.fullUrl ??
          libraryPayload.payload.previewUrl ??
          libraryPayload.payload.url;
        if (audioUrl) {
          applyLipSyncAudio(
            createLipSyncAudioStateFromDurableUrl({
              url: audioUrl,
              durationMs: libraryPayload.payload.durationMs ?? null,
              sourceKind: "library",
            })
          );
        }
        return;
      }
      void handleLipSyncAudioFile(event.dataTransfer.files?.[0]);
    },
    [applyLipSyncAudio, handleLipSyncAudioFile]
  );
  const canAcceptLipSyncAudioCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "audio",
    []
  );
  const acceptLipSyncAudioCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "audio") return;
      setLipSyncAudioDragActive(false);
      applyLipSyncAudio(
        isNonDurableLipSyncAudioUrl(payload.audioUrl)
          ? createFailedNonDurableLipSyncAudioState()
          : createLipSyncAudioStateFromDurableUrl({
              url: payload.audioUrl,
              durationMs: payload.durationMs ?? null,
              sourceKind: "canvas",
            })
      );
    },
    [applyLipSyncAudio]
  );
  const clearLipSyncAudio = React.useCallback(() => {
    lipSyncAudioUploadRevisionRef.current += 1;
    applyLipSyncAudio(createEmptyLipSyncAudioState());
  }, [applyLipSyncAudio]);
  const lipSyncAudioPlaybackUrl = getLipSyncAudioPlaybackUrl(lipSyncAudio);
  const lipSyncAudioDurationLabel =
    typeof lipSyncAudio.durationMs === "number" && Number.isFinite(lipSyncAudio.durationMs)
      ? `${Math.max(0, Math.round(lipSyncAudio.durationMs / 1000))}s`
      : null;
  const lipSyncAudioStatusLabel =
    lipSyncAudio.status === "uploading"
      ? "Uploading audio..."
      : lipSyncAudio.status === "failed"
        ? (lipSyncAudio.error ?? "Audio upload failed")
        : (lipSyncAudioDurationLabel ?? "Audio required");
  const klingElementSlotCount = isSeedance2FamilyModelId(modelId)
    ? VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT
    : VIDEO_KLING_ELEMENT_SLOT_COUNT;

  const commitSelectedKlingElements = React.useCallback(
    (elements: Array<AiStudioKlingElement | null>) => {
      onKlingElementsChange?.(
        elements
          .filter((item): item is AiStudioKlingElement => Boolean(item))
          .sort((a, b) => {
            const left = a.slotIndex ?? 0;
            const right = b.slotIndex ?? 0;
            return left - right;
          })
      );
    },
    [onKlingElementsChange]
  );

  const selectedKlingElements = React.useMemo(() => {
    const slots = Array.from(
      { length: klingElementSlotCount },
      () => null as AiStudioKlingElement | null
    );
    const legacyElements: AiStudioKlingElement[] = [];

    klingElements.forEach((element) => {
      const slotIndex =
        typeof element.slotIndex === "number" &&
        Number.isInteger(element.slotIndex) &&
        element.slotIndex >= 0 &&
        element.slotIndex < klingElementSlotCount
          ? element.slotIndex
          : null;

      if (slotIndex == null) {
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

  React.useEffect(() => {
    if (!onKlingElementsChange) return;
    if (
      !selectedKlingElements.some(
        (element) => element?.sourceElementId || element?.sourceCharacterId
      )
    ) {
      return;
    }

    let cancelled = false;

    const normalizeAttachedElements = async () => {
      const normalizedSlots = await Promise.all(
        selectedKlingElements.map(async (element, index) => {
          if (!element) return null;
          const slotIndex = element.slotIndex ?? index;

          if (!element.sourceElementId && !element.sourceCharacterId) {
            const hasLocalMedia = Boolean(
              element.videoUrl.trim() ||
              getAiStudioKlingElementReferenceUrls(element).length ||
              element.profileImageUrl?.trim()
            );
            return hasLocalMedia ? { ...element, slotIndex } : null;
          }

          try {
            const sourceKind =
              element.sourceKind ?? (element.sourceCharacterId ? "character" : "element");
            const sourceId = element.sourceCharacterId ?? element.sourceElementId;
            if (!sourceId) return null;
            const refreshedElement = await loadSavedKlingEntityBySource({
              sourceKind,
              sourceId,
            });
            const hasUsableMedia = Boolean(
              refreshedElement.videoUrl.trim() ||
              getAiStudioKlingElementReferenceUrls(refreshedElement).length
            );
            if (!hasUsableMedia) {
              const hasSessionPresence = Boolean(
                element.videoUrl.trim() ||
                getAiStudioKlingElementReferenceUrls(element).length ||
                element.profileImageUrl?.trim() ||
                element.name?.trim() ||
                element.alias?.trim()
              );
              return hasSessionPresence ? { ...element, slotIndex } : null;
            }
            return { ...refreshedElement, slotIndex };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const currentSignature = JSON.stringify(
        selectedKlingElements.map((element, index) =>
          element
            ? {
                slotIndex: element.slotIndex ?? index,
                sourceKind: element.sourceKind ?? null,
                sourceElementId: element.sourceElementId ?? null,
                sourceCharacterId: element.sourceCharacterId ?? null,
                name: element.name ?? "",
                alias: element.alias ?? "",
                description: element.description ?? "",
                profileImageUrl: element.profileImageUrl ?? null,
                profileImageTransform: element.profileImageTransform ?? null,
                frontalImageUrl: element.frontalImageUrl,
                referenceImageUrls: element.referenceImageUrls,
                videoUrl: element.videoUrl,
              }
            : null
        )
      );
      const nextSignature = JSON.stringify(
        normalizedSlots.map((element) =>
          element
            ? {
                slotIndex: element.slotIndex,
                sourceKind: element.sourceKind ?? null,
                sourceElementId: element.sourceElementId ?? null,
                sourceCharacterId: element.sourceCharacterId ?? null,
                name: element.name ?? "",
                alias: element.alias ?? "",
                description: element.description ?? "",
                profileImageUrl: element.profileImageUrl ?? null,
                profileImageTransform: element.profileImageTransform ?? null,
                frontalImageUrl: element.frontalImageUrl,
                referenceImageUrls: element.referenceImageUrls,
                videoUrl: element.videoUrl,
              }
            : null
        )
      );

      if (currentSignature !== nextSignature) {
        commitSelectedKlingElements(normalizedSlots);
      }
    };

    void normalizeAttachedElements();

    return () => {
      cancelled = true;
    };
  }, [commitSelectedKlingElements, onKlingElementsChange, selectedKlingElements]);

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
    }: {
      sourceKind: AiStudioKlingEntitySourceKind;
      sourceId: string;
    }) => {
      if (elementPickerSlotIndex == null) return;
      try {
        const selectedElement = await loadSavedKlingEntityBySource({ sourceKind, sourceId });
        const next = Array.from(
          { length: klingElementSlotCount },
          (_, index) => selectedKlingElements[index] ?? null
        );
        next[elementPickerSlotIndex] = { ...selectedElement, slotIndex: elementPickerSlotIndex };
        commitSelectedKlingElements(next);
        setElementPickerError(null);
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
  const isSeedance2ModelSelected = modelId === KIE_SEEDANCE_2_MODEL_ID;
  const isSeedance2FastModelSelected = modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const isSeedance2FamilyModelSelected =
    isSeedance2UiEnabled() && (isSeedance2ModelSelected || isSeedance2FastModelSelected);
  const isAnySeedanceModelSelected = isSeedance2FamilyModelSelected;
  const isKlingPatternModelSelected = isKieKlingModelSelected || isSeedance2FamilyModelSelected;
  const isVeo31ModelSelected =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;

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
  const seedanceReferenceMode =
    isSeedance2FamilyModelSelected && seedance2InputMode === "multimodal"
      ? "elements"
      : "keyframes";
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
  const shouldShowKlingAdvancedSteps = isKlingPatternMode && !isSeedance2FamilyModelSelected;
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
      textarea.style.overflowY = "hidden";
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
        handleMotionVideoSelection={handleMotionVideoSelection}
        canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
        acceptPrimaryCanvasTearOutPayload={acceptPrimaryCanvasTearOutPayload}
        acceptExtraCanvasTearOutPayload={acceptExtraCanvasTearOutPayload}
        acceptMotionVideoCanvasTearOutPayload={acceptMotionVideoCanvasTearOutPayload}
        topContent={
          <div className="video-reference-card-title">
            {isLipSyncMode
              ? "Character image"
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
      handlePrimaryDragEnter,
      handlePrimaryDragLeave,
      handlePrimaryDragOver,
      handlePrimaryDrop,
      isKeyframesMode,
      isKlingPatternMode,
      isLipSyncMode,
      isMotionMode,
      isStandardMode,
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
    (url: string) => {
      onMotionVideoChange?.(url);
      setIsMotionRecorderOpen(false);
    },
    [onMotionVideoChange]
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
        if (!element) return [];
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
              (element): element is AiStudioKlingElement => Boolean(element)
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
      if (!droppedToken) {
        event.preventDefault();
        const promptText = extractPromptDropText(event.dataTransfer);
        if (!promptText) return;
        closePromptTokenPicker();
        applyPromptUpdateForTarget(target, promptText);
        return;
      }
      event.preventDefault();
      const promptValue = options?.promptValue ?? primaryPromptValue;
      const targetTextarea =
        event.target instanceof HTMLTextAreaElement
          ? event.target
          : options?.shotId
            ? customPromptTextareaRefs.current[options.shotId]
            : primaryPromptTextareaRef.current;
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
        <div
          className="video-kling-prompt-token-picker"
          role="group"
          aria-label="Kling element picker"
        >
          <div className="video-kling-prompt-token-picker-header">
            <p className="video-kling-prompt-token-picker-title">Kling Elements</p>
            <p className="video-kling-prompt-token-picker-hint">Type or click to insert.</p>
          </div>
          <div className="video-kling-prompt-token-picker-grid">
            {populatedKlingPromptTokenSlotIndexes.map((slotIndex) => {
              const element = selectedKlingElements[slotIndex];
              if (!element) return null;
              const displayToken = resolvePromptTokenPickerDisplayToken(slotIndex);
              const previewUrl =
                element.profileImageUrl?.trim() ||
                element.frontalImageUrl.trim() ||
                getAiStudioKlingElementReferenceUrls(element)[0] ||
                "";
              return (
                <button
                  key={`video-kling-token-picker-slot-${slotIndex}`}
                  type="button"
                  className={`video-kling-prompt-token-picker-option ${
                    promptTokenPickerState.selectedSlotIndex === slotIndex ? "is-selected" : ""
                  }`.trim()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertPromptTokenFromPicker(slotIndex)}
                >
                  <span
                    className="video-kling-prompt-token-picker-option-thumb"
                    aria-hidden="true"
                    style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                  />
                  <span className="video-kling-prompt-token-picker-option-copy">
                    <span className="video-kling-prompt-token-picker-option-label">
                      {element.name?.trim() || `Element ${slotIndex + 1}`}
                    </span>
                    <span className="video-kling-prompt-token-picker-option-token">
                      {displayToken}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
                <div className="video-panel-title">Select Video Mode</div>
                <div className="video-setup-columns">
                  <div className="video-setup-column video-setup-column--single">
                    <div
                      className="video-reference-mode-tabs"
                      role="tablist"
                      aria-label="Video reference mode"
                      style={videoModeTabsStyle}
                    >
                      <span className="video-reference-mode-indicator" aria-hidden="true" />
                      <button
                        type="button"
                        role="tab"
                        aria-selected={visibleVideoMode === "standard"}
                        className={`video-reference-mode-tab ${visibleVideoMode === "standard" ? "is-active" : ""}`}
                        onClick={() => onVideoReferenceModeChange?.("standard")}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={visibleVideoMode === "motion"}
                        className={`video-reference-mode-tab ${visibleVideoMode === "motion" ? "is-active" : ""}`}
                        onClick={() => onVideoReferenceModeChange?.("motion")}
                      >
                        Motion Control
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={visibleVideoMode === "lip-sync"}
                        className={`video-reference-mode-tab ${visibleVideoMode === "lip-sync" ? "is-active" : ""}`}
                        onClick={() => onVideoReferenceModeChange?.("lip-sync")}
                      >
                        Lip Sync
                      </button>
                    </div>
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
                          videoCameraFixed={videoCameraFixed}
                          isVeoModel={isVeoModel}
                          videoAutoFix={videoAutoFix}
                          onAspectChange={onAspectChange}
                          onModelPickerOpen={onModelPickerOpen}
                          onVideoDurationChange={onVideoDurationChange}
                          onVideoResolutionChange={onVideoResolutionChange}
                          onVideoGenerateAudioChange={onVideoGenerateAudioChange}
                          onVideoCameraFixedChange={onVideoCameraFixedChange}
                          onVideoAutoFixChange={onVideoAutoFixChange}
                        />
                      </div>
                    ) : null}
                    {isMotionMode && !motionVideoUrl ? (
                      <div className="video-setup-recorder-slot">
                        <div className="reference-dropzone-block motion-recorder-launch-block">
                          <AiStudioRecordPanelPrefab
                            panelAriaLabel="Record optional motion source"
                            title="Need a clip?"
                            helper="If you do not already have a motion video, you can record one here."
                            buttonIdleAriaLabel="Open motion recorder to add a motion clip"
                            buttonRecordingAriaLabel="Open motion recorder to add a motion clip"
                            idleCue="Click to record"
                            isRecording={false}
                            onClick={handleOpenMotionRecorder}
                          />
                        </div>
                      </div>
                    ) : null}
                    {!isSeedance2FamilyModelSelected || isMotionMode || isLipSyncMode ? (
                      <div className="video-setup-reference-slot">{renderReferenceMediaStep()}</div>
                    ) : null}
                    {isLipSyncMode ? (
                      <div className="video-lip-sync-audio-card">
                        <input
                          ref={lipSyncAudioInputRef}
                          className="sr-only"
                          type="file"
                          accept="audio/*"
                          onChange={handleLipSyncAudioSelection}
                        />
                        <div className="video-reference-card-title">Voice audio</div>
                        <div
                          ref={lipSyncAudioDropzoneRef}
                          className={`video-lip-sync-audio-dropzone ${lipSyncAudioDragActive || lipSyncAudioCanvasTearOutActive ? "is-drag-active" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => lipSyncAudioInputRef.current?.click()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              lipSyncAudioInputRef.current?.click();
                            }
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            setLipSyncAudioDragActive(true);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setLipSyncAudioDragActive(true);
                          }}
                          onDragLeave={() => setLipSyncAudioDragActive(false)}
                          onDrop={handleLipSyncAudioDrop}
                        >
                          {lipSyncAudioPlaybackUrl ? (
                            <div
                              className={`video-lip-sync-audio-preview ${lipSyncAudio.status === "failed" ? "is-failed" : ""}`.trim()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <ReferenceAudioPlayer
                                audioId="lip-sync-audio"
                                audioUrl={lipSyncAudioPlaybackUrl}
                                durationMs={lipSyncAudio.durationMs}
                                playLabel="Play voice audio"
                                pauseLabel="Pause voice audio"
                                eagerWaveformDecode={false}
                              />
                              {lipSyncAudio.status === "uploading" ? (
                                <div className="video-lip-sync-audio-state">Uploading</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="video-lip-sync-audio-empty">
                              <span className="video-lip-sync-audio-empty-title">
                                Add voice audio
                              </span>
                              <small className="video-lip-sync-audio-empty-helper">
                                Drop audio here or choose a file
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="video-lip-sync-audio-actions">
                          <span className="video-lip-sync-audio-status">
                            {lipSyncAudioStatusLabel}
                          </span>
                          {lipSyncAudioPlaybackUrl || lipSyncAudio.status === "failed" ? (
                            <button
                              type="button"
                              className="video-lip-sync-clear-button"
                              onClick={clearLipSyncAudio}
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        <div
                          className="video-lip-sync-resolution-row"
                          aria-label="Lip Sync resolution"
                        >
                          {["720p", "1080p"].map((resolution) => (
                            <button
                              key={resolution}
                              type="button"
                              className={
                                videoResolutionValue === resolution
                                  ? "video-lip-sync-resolution-button is-active"
                                  : "video-lip-sync-resolution-button"
                              }
                              aria-pressed={videoResolutionValue === resolution}
                              onClick={() => onVideoResolutionChange?.(resolution)}
                            >
                              {resolution}
                            </button>
                          ))}
                        </div>
                        <label className="video-lip-sync-toggle-row">
                          <span>Faster generation</span>
                          <button
                            type="button"
                            className={`video-lip-sync-switch audio-toggle ${lipSyncTurboMode ? "is-active" : ""}`}
                            role="switch"
                            aria-checked={lipSyncTurboMode}
                            aria-label="Faster generation"
                            onClick={() => onLipSyncTurboModeChange?.(!lipSyncTurboMode)}
                          >
                            <span className="audio-toggle-track" aria-hidden="true">
                              <span className="audio-toggle-dot" />
                            </span>
                          </button>
                        </label>
                      </div>
                    ) : null}
                    <MotionRecorderModal
                      isOpen={isMotionMode && isMotionRecorderOpen}
                      onClose={handleCloseMotionRecorder}
                      onApplyVideo={handleApplyRecordedMotionVideo}
                    />
                    {isKlingPatternModelSelected && !isMotionMode ? (
                      <div className="video-setup-elements-slot">
                        <div className="step-card video-elements-card">
                          <div className="video-elements-card-title video-elements-card-title--large">
                            {isSeedance2FamilyModelSelected
                              ? "Seedance 2.0 Settings"
                              : "Kling 3.0 Settings"}
                          </div>
                          {shouldShowShotModeSelector ? (
                            <div className="video-shot-mode-section video-elements-shot-mode-section">
                              <span className="input-label video-shot-mode-label">Shot mode</span>
                              <div
                                className={`video-shot-mode-tabs ${
                                  isSeedance2FamilyModelSelected
                                    ? "video-shot-mode-tabs--compact"
                                    : ""
                                }`.trim()}
                                role="tablist"
                                aria-label="Shot structure mode"
                                style={
                                  {
                                    "--video-shot-mode-slots": shotModeTabCount,
                                    "--video-shot-mode-index": visibleShotMode === "multi" ? 1 : 0,
                                  } as React.CSSProperties
                                }
                              >
                                <span className="video-shot-mode-indicator" aria-hidden="true" />
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={visibleShotMode === "single"}
                                  aria-label="Single shot"
                                  className={`video-shot-mode-tab ${visibleShotMode === "single" ? "is-active" : ""}`}
                                  onClick={() => handleSetKlingWorkflowMode("single")}
                                >
                                  Single
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={visibleShotMode === "multi"}
                                  aria-label="Multi-shot"
                                  className={`video-shot-mode-tab ${visibleShotMode === "multi" ? "is-active" : ""}`}
                                  onClick={() => handleSetKlingWorkflowMode("multi")}
                                >
                                  Multi
                                </button>
                              </div>
                            </div>
                          ) : null}
                          {isSeedance2FamilyModelSelected ? (
                            <div className="video-shot-mode-section video-elements-shot-mode-section">
                              <span className="input-label video-shot-mode-label">
                                Reference mode
                              </span>
                              <div
                                className="video-shot-mode-tabs video-shot-mode-tabs--compact"
                                role="tablist"
                                aria-label="Seedance reference mode"
                                style={
                                  {
                                    "--video-shot-mode-slots": 2,
                                    "--video-shot-mode-index":
                                      seedanceReferenceMode === "elements" ? 1 : 0,
                                  } as React.CSSProperties
                                }
                              >
                                <span className="video-shot-mode-indicator" aria-hidden="true" />
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={seedanceReferenceMode === "keyframes"}
                                  aria-label="Keyframes"
                                  className={`video-shot-mode-tab ${
                                    seedanceReferenceMode === "keyframes" ? "is-active" : ""
                                  }`}
                                  onClick={() => handleSetSeedanceReferenceMode("keyframes")}
                                >
                                  Keyframes
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={seedanceReferenceMode === "elements"}
                                  aria-label="Elements"
                                  className={`video-shot-mode-tab ${
                                    seedanceReferenceMode === "elements" ? "is-active" : ""
                                  }`}
                                  onClick={() => handleSetSeedanceReferenceMode("elements")}
                                >
                                  Elements
                                </button>
                              </div>
                            </div>
                          ) : null}
                          {isSeedance2FamilyModelSelected &&
                          seedanceReferenceMode === "keyframes" ? (
                            <div className="video-setup-reference-slot video-setup-reference-slot--seedance">
                              {renderReferenceMediaStep()}
                            </div>
                          ) : null}
                          {!isSeedance2FamilyModelSelected ||
                          seedanceReferenceMode === "elements" ? (
                            <div className="video-kling-elements-picker-anchor">
                              {renderPromptTokenPicker(activePromptTargetRef.current)}
                              <div className="video-elements-card-title video-elements-card-title--sub">
                                Add Characters / @Elements
                              </div>
                              <div
                                className="video-elements-placeholder-grid"
                                aria-label="Element reference slots"
                              >
                                {Array.from({ length: klingElementSlotCount }).map((_, index) => {
                                  const selectedElement = selectedKlingElements[index] ?? null;
                                  const previewUrl =
                                    selectedElement?.profileImageUrl ??
                                    getAiStudioKlingElementReferenceUrls(
                                      selectedElement ?? {
                                        frontalImageUrl: "",
                                        referenceImageUrls: "",
                                      }
                                    )[0] ??
                                    null;
                                  const previewAvatarStyle = previewUrl
                                    ? buildElementProfileImageBackgroundStyle(
                                        previewUrl,
                                        selectedElement?.profileImageTransform ?? null,
                                        VIDEO_KLING_ELEMENT_SLOT_SIZE
                                      )
                                    : undefined;
                                  const dragToken = selectedElement
                                    ? (klingElementCanonicalPromptTokens[index] ?? "")
                                    : "";

                                  if (!selectedElement) {
                                    return (
                                      <button
                                        key={`video-element-slot-${index}`}
                                        type="button"
                                        className="video-elements-placeholder-tile"
                                        onClick={() => openElementPicker(index)}
                                        aria-label={`Add element to slot ${index + 1}`}
                                      >
                                        <span
                                          className="video-elements-placeholder-plus"
                                          aria-hidden="true"
                                        >
                                          +
                                        </span>
                                      </button>
                                    );
                                  }

                                  return (
                                    <div
                                      key={`video-element-slot-${index}`}
                                      className={`video-elements-placeholder-tile video-elements-placeholder-tile--filled ${
                                        selectedElement.sourceKind === "character"
                                          ? "video-elements-placeholder-tile--character"
                                          : "video-elements-placeholder-tile--element"
                                      }`}
                                      draggable={Boolean(dragToken)}
                                      onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = "copy";
                                        setKlingElementPromptTokenDragData(
                                          event.dataTransfer,
                                          dragToken
                                        );
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="video-elements-placeholder-select"
                                        onClick={() => openElementPicker(index)}
                                        aria-label={`Replace attached element ${resolveAiStudioKlingElementDisplayLabel(
                                          selectedElement,
                                          index,
                                          selectedKlingElements
                                        )}`}
                                      >
                                        {previewUrl ? (
                                          <span
                                            className="video-elements-slot-avatar-image"
                                            style={previewAvatarStyle}
                                            aria-hidden="true"
                                          />
                                        ) : null}
                                      </button>
                                      <span className="video-elements-slot-actions">
                                        <button
                                          type="button"
                                          className="ghost-btn mini"
                                          aria-label={`Remove attached element ${selectedElement.name || index + 1}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            removeSelectedElement(index);
                                          }}
                                        >
                                          <Trash size={12} />
                                        </button>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {elementPickerError ? (
                            <p className="tiny helper-text">{elementPickerError}</p>
                          ) : null}
                        </div>
                      </div>
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
                className={`video-direction-column-shell ${hasAnyPromptText ? "has-active-prompt-content" : ""} ${isCustomMultiShotWorkspace ? "is-custom-multishot-workspace" : ""}`}
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
                        {customKlingPrompts.slice(1).map((shot, index) => (
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
                            <div className="prompt-enhanced-wrapper has-token-highlight">
                              <div
                                className="prompt-token-highlight"
                                aria-hidden="true"
                                ref={(node) => {
                                  customPromptHighlightRefs.current[shot.id] = node;
                                }}
                              >
                                {buildKlingPromptHighlightSegments(
                                  shot.prompt,
                                  analyzeKlingPromptTokens(shot.prompt, klingPromptAttachedSlots)
                                ).map((segment, segmentIndex) => (
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
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="video-right-generate-slot">
                  <div className="video-generate-summary-panel" aria-label="Current video settings">
                    <div className="video-generate-summary-row">
                      <div className="video-generate-summary-item">
                        <span className="video-generate-summary-label">Mode</span>
                        <span className="video-generate-summary-value">
                          {videoModeSummaryLabel}
                        </span>
                      </div>
                      <div className="video-generate-summary-item">
                        <span className="video-generate-summary-label">Shot</span>
                        <span className="video-generate-summary-value">
                          {visibleVideoMode === "lip-sync"
                            ? "Voice audio"
                            : visibleVideoMode === "motion"
                              ? "Single"
                              : shotModeSummaryLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  {shouldShowKlingReferenceImageWarning ? (
                    <AppMessage
                      className="video-inline-warning-bubble"
                      tone="warning"
                      mode="inline"
                      message="Reference image required for generation"
                      role="status"
                      ariaLive="polite"
                    />
                  ) : null}
                  {!shouldShowKlingReferenceImageWarning && referenceImageWarning ? (
                    <AppMessage
                      className="video-inline-warning-bubble"
                      tone="warning"
                      mode="inline"
                      message={referenceImageWarning}
                      role="status"
                      ariaLive="polite"
                    />
                  ) : null}
                  {!shouldShowKlingReferenceImageWarning &&
                  !referenceImageWarning &&
                  klingPromptGuardrailReason ? (
                    <AppMessage
                      className="video-inline-warning-bubble"
                      tone="warning"
                      mode="inline"
                      message={klingPromptGuardrailReason}
                      role="status"
                      ariaLive="polite"
                    />
                  ) : null}
                  {!shouldShowKlingReferenceImageWarning &&
                  !referenceImageWarning &&
                  !klingPromptGuardrailReason &&
                  isGenerateDisabled &&
                  guardrailReason ? (
                    <AppMessage
                      className="video-inline-warning-bubble"
                      tone="warning"
                      mode="inline"
                      message={guardrailReason}
                      role="status"
                      ariaLive="polite"
                    />
                  ) : null}
                  <div className="video-right-generate-button">
                    <AgentGenerateButton
                      onClick={onRegenerate}
                      disabled={
                        Boolean(klingPromptGuardrailReason) ||
                        isGenerateDisabled ||
                        !hasRequiredPromptForGenerate ||
                        shouldShowKlingReferenceImageWarning
                      }
                      cost={costCredits != null ? costCredits : "—"}
                    />
                  </div>
                </div>
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
              klingElements={klingElements}
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
            Boolean(element)
          )
          .map((element) => {
            const sourceKind =
              element.sourceKind ??
              (element.sourceCharacterId
                ? "character"
                : element.sourceElementId
                  ? "element"
                  : null);
            const sourceId = element.sourceCharacterId ?? element.sourceElementId ?? "";
            if (!sourceKind || !sourceId) return null;
            return { sourceKind, sourceId };
          })
          .filter(
            (
              selection
            ): selection is {
              sourceKind: AiStudioKlingEntitySourceKind;
              sourceId: string;
            } => Boolean(selection)
          )}
        selectedSourceKind={
          elementPickerSlotIndex != null
            ? (selectedKlingElements[elementPickerSlotIndex]?.sourceKind ??
              (selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterId
                ? "character"
                : selectedKlingElements[elementPickerSlotIndex]?.sourceElementId
                  ? "element"
                  : null))
            : null
        }
        selectedSourceId={
          elementPickerSlotIndex != null
            ? (selectedKlingElements[elementPickerSlotIndex]?.sourceCharacterId ??
              selectedKlingElements[elementPickerSlotIndex]?.sourceElementId ??
              null)
            : null
        }
      />
    </div>
  );
}
