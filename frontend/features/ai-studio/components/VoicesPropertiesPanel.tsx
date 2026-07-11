/**
 * Voices properties panel for AI Studio.
 * Keeps the Voices workflow visually aligned with the TTS layout while remaining fully isolated.
 */
import React from "react";
import { Trash } from "phosphor-react";
import { clampCustomVoiceNameInput } from "../../../lib/customVoiceName";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { AgentEnhanceButton } from "../../../prefabs/agent";
import { useAgentComposerPromptDropModifierTracking } from "./promptStep/agentComposerDrop";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import type { GenerationAccessCta } from "../logic/generationAccessCta";
import {
  handlePromptTextAreaDragOver,
  handlePromptTextAreaDrop,
  insertCanvasPromptTextIntoTextarea,
} from "./shared/promptTextDropHandlers";
import {
  buildVoiceChangerRequestSettings,
  buildVoiceoverRequestConfig,
  hardcodedVoiceChangerInputFormat,
  hardcodedVoiceChangerModel,
  hardcodedVoiceChangerNoiseReductionEnabled,
  hardcodedVoiceOutputFormat,
  hardcodedVoiceoverModelId,
  type ElevenVoiceoverRequestConfig,
} from "../utils/voiceAudioModelConfig";
import { resolvePricingGridBilledCredits } from "../../../lib/model-runtime/pricingGridBilledCredits";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import {
  cloneProviderVoice,
  createDesignedVoice,
  deleteProviderVoice,
  enhanceVoiceoverScript,
  requestVoiceDesignPreviews,
} from "../logic/voiceActionsApiClient";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useVoiceChangerSourceController } from "../hooks/useVoiceChangerSourceController";
import { useVoiceCloneSourceController } from "../hooks/useVoiceCloneSourceController";
import { useVoiceLibraryLoader } from "../hooks/useVoiceLibraryLoader";
import {
  isTransientVoicePreviewNotice,
  useVoicePreviewPlayback,
} from "../hooks/useVoicePreviewPlayback";
import {
  resetSharedVoicesGridStore,
  useSharedVoicesGrid,
  type SharedVoiceOption,
} from "../hooks/useSharedVoicesGrid";
import type { ToolId } from "../types";
import type { VoiceChangerSourceMetadataPatch } from "../logic/voiceChangerSourceTypes";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import { CreateVoiceModal, type CreateVoiceModalPreview } from "./CreateVoiceModal";
import { VoiceLibraryContent } from "./VoiceLibraryContent";
import { resolveGenerateCreditConfidence } from "./shared/generateCreditConfidence";
import {
  VoiceChangerSourceDropzone,
  type ResolveVoiceChangerInternalReferenceSource,
  type VoiceChangerSource,
} from "./VoiceChangerSourceDropzone";
import { VoicesLibraryModal } from "./VoicesLibraryModal";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "./shared/exclusiveSoundPlayback";
import { GenerationAccessCtaButton } from "./shared/GenerationAccessCtaButton";
import {
  buildDesignedPreviewInstanceKey,
  buildVoiceDesignPreviewAudioSrc,
  cloneVoiceSourceDropzoneCopy,
  createVoiceDefaultName,
  fixedVoiceChangerBottomSectionHeightPx,
  getVoiceChipDisplayName,
  loadedVoiceArrowInlineStyle,
  loadedVoiceValueInlineStyle,
  maxVoiceChangerBottomSectionHeightPx,
  maxVoicePromptCharacters,
  maxVoicePromptHeightPx,
  maxVoiceScriptCharacters,
  minVoiceChangerBottomSectionHeightPx,
  minVoiceChangerTopSectionHeightPx,
  minVoiceoverBottomSectionHeightPx,
  minVoiceoverTopSectionHeightPx,
  minVoicePromptCharacters,
  voiceLoadingSkeletonCount,
  voicePromptPlaceholder,
  voiceScriptPlaceholder,
} from "./voicesPropertiesPanelConstants";
import { canSubmitVoiceChangerSource } from "./voiceChangerSourceSubmit";
import styles from "../../../styles/ai-studio-voices-properties.module.css";

export {
  buildVoiceoverRequestConfig,
  hardcodedVoiceDesignModelId,
  hardcodedVoiceGenerationDefaults,
  hardcodedVoiceoverV3Defaults,
  hardcodedVoiceOutputFormat,
  hardcodedVoiceoverLanguageCode,
  hardcodedVoiceoverModelId,
  hardcodedVoiceoverStyleValue,
} from "../utils/voiceAudioModelConfig";

type VoicesSurfaceMode = "create" | "edit";
type CreateVoiceMode = "generate" | "clone";
type VoicesLibrarySection = "default" | "my";

export type VoicesGenerateRequest =
  | {
      mode: "voiceover";
      voice: SharedVoiceOption;
      script: string;
      outputFormat: string;
      config: ElevenVoiceoverRequestConfig;
      displayedBilledCredits?: number | null;
      pricingPolicyReady?: boolean;
    }
  | {
      mode: "voice-changer";
      voice: SharedVoiceOption;
      source: VoiceChangerSource;
      outputFormat: string;
      removeBackgroundNoise: boolean;
      modelId: string;
      voiceSettings: {
        stability: number;
        similarity_boost: number;
        speed: number;
        use_speaker_boost: boolean;
      };
      inputFormat: string;
      displayedBilledCredits?: number | null;
      pricingPolicyReady?: boolean;
    };

export type VoicesPropertiesPanelProps = {
  balanceCredits?: number | null;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
  generationAccessCta?: GenerationAccessCta | null;
  selectedTool?: ToolId | null;
  isGenerating?: boolean;
  onGenerate?: (request: VoicesGenerateRequest) => Promise<void> | void;
  onSelectedVoiceIdChange?: (voiceId: string) => void;
  onVoiceChangerSourceChange?: (source: VoiceChangerSource | null) => void;
  onVoiceChangerSourceMetadataChange?: (
    sourceId: string,
    patch: VoiceChangerSourceMetadataPatch
  ) => void;
  onVoicePromptChange?: (value: string) => void;
  onVoiceScriptChange?: (value: string) => void;
  onActiveVoiceChangerSourceVideoChange?: (source: ActiveVoiceChangerSourceVideo | null) => void;
  resolveVoiceChangerInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  selectedVoiceId?: string | null;
  voiceChangerSource?: VoiceChangerSource | null;
  voicePrompt?: string;
  voiceScript?: string;
};

export type ActiveVoiceChangerSourceVideo = {
  referenceOutputId: string | null;
  referenceMediaId: string | null;
  aspect: string | null;
};

const formatCreditValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const resolveActiveVoiceChangerSourceVideo = ({
  source,
  surfaceMode,
}: {
  source: VoiceChangerSource | null;
  surfaceMode: VoicesSurfaceMode;
}): ActiveVoiceChangerSourceVideo | null => {
  if (surfaceMode !== "edit" || !source) return null;

  const videoSource = source.extractedFrom
    ? source.extractedFrom
    : source.kind === "video"
      ? source
      : null;
  if (!videoSource) return null;

  return {
    referenceOutputId: videoSource.referenceOutputId ?? null,
    referenceMediaId: videoSource.referenceMediaId ?? null,
    aspect: videoSource.aspect ?? null,
  };
};

/**
 * Renders the dedicated Voices workflow panel.
 */
export const VoicesPropertiesPanel = React.memo(function VoicesPropertiesPanel({
  balanceCredits = null,
  pricingPolicy = null,
  pricingPolicyReady = true,
  generationAccessCta = null,
  selectedTool = null,
  onGenerate,
  onSelectedVoiceIdChange,
  onVoiceChangerSourceChange: onControlledVoiceChangerSourceChange,
  onVoiceChangerSourceMetadataChange: onControlledVoiceChangerSourceMetadataChange,
  onVoicePromptChange: onControlledVoicePromptChange,
  onVoiceScriptChange: onControlledVoiceScriptChange,
  onActiveVoiceChangerSourceVideoChange,
  resolveVoiceChangerInternalReferenceSource,
  canvasTearOutTargetRegistry,
  selectedVoiceId: controlledSelectedVoiceId,
  voiceChangerSource: controlledVoiceChangerSource,
  voicePrompt: controlledVoicePrompt,
  voiceScript: controlledVoiceScript,
}: VoicesPropertiesPanelProps) {
  useAgentComposerPromptDropModifierTracking();

  const sessionSnapshot = useResolvedProtectedSessionState();
  const sessionUserId = sessionSnapshot.user?.id ?? null;
  const {
    voices: libraryVoices,
    selectedVoice: sharedSelectedLibraryVoice,
    setSelectedVoice: setSharedSelectedLibraryVoice,
    replaceVoices,
    upsertVoice: upsertSharedVoice,
  } = useSharedVoicesGrid();
  const controlledSelectedLibraryVoice =
    controlledSelectedVoiceId !== undefined
      ? (libraryVoices.find((voice) => voice.id === controlledSelectedVoiceId) ?? null)
      : null;
  const selectedLibraryVoice =
    controlledSelectedVoiceId !== undefined
      ? controlledSelectedLibraryVoice
      : sharedSelectedLibraryVoice;
  const setSelectedLibraryVoice = React.useCallback(
    (voiceId: string) => {
      setSharedSelectedLibraryVoice(voiceId);
      onSelectedVoiceIdChange?.(voiceId);
    },
    [onSelectedVoiceIdChange, setSharedSelectedLibraryVoice]
  );
  const [surfaceMode, setSurfaceMode] = React.useState<VoicesSurfaceMode>(
    selectedTool === "voice-changer" ? "edit" : "create"
  );
  const [createVoiceMode, setCreateVoiceMode] = React.useState<CreateVoiceMode>("generate");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = React.useState(false);
  const [voiceName, setVoiceName] = React.useState(createVoiceDefaultName);
  const [voicePromptState, setVoicePromptState] = React.useState("");
  const [voiceDesignPreviews, setVoiceDesignPreviews] = React.useState<CreateVoiceModalPreview[]>(
    []
  );
  const [selectedVoiceDesignPreviewId, setSelectedVoiceDesignPreviewId] = React.useState<
    string | null
  >(null);
  const [playedVoiceDesignPreviewIds, setPlayedVoiceDesignPreviewIds] = React.useState<string[]>(
    []
  );
  const [voiceDesignPreviewText, setVoiceDesignPreviewText] = React.useState<string | null>(null);
  const [voiceDesignError, setVoiceDesignError] = React.useState<string | null>(null);
  const [saveVoiceError, setSaveVoiceError] = React.useState<string | null>(null);
  const [isDesigningVoice, setIsDesigningVoice] = React.useState(false);
  const [isSavingDesignedVoice, setIsSavingDesignedVoice] = React.useState(false);
  const [isCloneConsentChecked, setIsCloneConsentChecked] = React.useState(false);
  const [isCloningVoice, setIsCloningVoice] = React.useState(false);
  const [isDeletingSelectedVoice, setIsDeletingSelectedVoice] = React.useState(false);
  const [pendingDeleteVoice, setPendingDeleteVoice] = React.useState<SharedVoiceOption | null>(
    null
  );
  const [isVoicesLibraryModalOpen, setIsVoicesLibraryModalOpen] = React.useState(false);
  const [activeVoicesLibrarySection, setActiveVoicesLibrarySection] =
    React.useState<VoicesLibrarySection>("my");
  const [activeDesignedPreviewId, setActiveDesignedPreviewId] = React.useState<string | null>(null);
  const [voiceScriptState, setVoiceScriptState] = React.useState("");
  const [isEnhancingVoiceover, setIsEnhancingVoiceover] = React.useState(false);
  const [voiceoverEnhanceDraft, setVoiceoverEnhanceDraft] = React.useState<string | null>(null);
  const [voiceoverEnhanceError, setVoiceoverEnhanceError] = React.useState<string | null>(null);
  const {
    voiceChangerSource: uncontrolledVoiceChangerSource,
    handleVoiceChangerSourceChange: handleUncontrolledVoiceChangerSourceChange,
    handleVoiceChangerSourceMetadataChange: handleUncontrolledVoiceChangerSourceMetadataChange,
  } = useVoiceChangerSourceController();
  const {
    cloneVoiceSource,
    cloneVoiceError,
    setCloneVoiceError,
    resetCloneVoiceSource,
    handleCloneVoiceSourceChange,
  } = useVoiceCloneSourceController();
  const handleVoiceNameChange = React.useCallback((nextValue: string) => {
    setVoiceName(clampCustomVoiceNameInput(nextValue));
  }, []);
  const [loadedVoiceCueVoiceId, setLoadedVoiceCueVoiceId] = React.useState<string | null>(null);
  const [pendingLoadedVoiceCueVoiceId, setPendingLoadedVoiceCueVoiceId] = React.useState<
    string | null
  >(null);
  const voicePrompt = controlledVoicePrompt ?? voicePromptState;
  const voiceScript = controlledVoiceScript ?? voiceScriptState;
  const setVoicePrompt = React.useCallback(
    (value: string) => {
      if (onControlledVoicePromptChange) {
        onControlledVoicePromptChange(value);
        return;
      }
      setVoicePromptState(value);
    },
    [onControlledVoicePromptChange]
  );
  const setVoiceScript = React.useCallback(
    (value: string) => {
      if (onControlledVoiceScriptChange) {
        onControlledVoiceScriptChange(value);
        return;
      }
      setVoiceScriptState(value);
    },
    [onControlledVoiceScriptChange]
  );

  const voiceNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const voicePromptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const voiceScriptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const voicesLibraryTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedVoiceTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const voicesLibraryFocusRestoreTargetRef = React.useRef<HTMLButtonElement | null>(null);
  const designedPreviewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const designedPreviewAudioIdRef = React.useRef<string | null>(null);
  const shouldFocusCreateControlsRef = React.useRef(false);
  const shouldRestoreVoicesLibraryTriggerFocusRef = React.useRef(false);
  const shouldRestoreCreateVoiceTriggerFocusRef = React.useRef(false);
  const createVoiceTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const voiceChangerSource =
    controlledVoiceChangerSource !== undefined
      ? controlledVoiceChangerSource
      : uncontrolledVoiceChangerSource;
  const loadedVoiceCueTimeoutRef = React.useRef<number | null>(null);
  const requiresProviderVoice = Boolean(onGenerate);
  const shouldLoadVoiceLibrary = requiresProviderVoice && Boolean(sessionUserId);
  const {
    isVoicesLoading,
    voicesLoadError,
    setVoicesLoadError,
    voicesLoadNotice,
    setVoicesLoadNotice,
  } = useVoiceLibraryLoader({
    replaceVoices,
    sessionUserId,
    setActiveVoicesLibrarySection,
    shouldLoadVoiceLibrary,
  });
  const { activePreviewVoiceId, stopActiveVoicePreview, handleVoicePreviewPlay } =
    useVoicePreviewPlayback({
      setVoicesLoadError,
      setVoicesLoadNotice,
    });
  const isCreateVoiceModalOpen = isCreatePanelOpen;
  const isSelectedVoiceProviderReady =
    selectedLibraryVoice?.provider === "elevenlabs" && !selectedLibraryVoice?.isFallback;
  const normalizedVoicePromptLength = voicePrompt.trim().length;
  const isVoicePromptWithinLimit = voicePrompt.length <= maxVoicePromptCharacters;
  const isVoiceScriptWithinLimit = voiceScript.length <= maxVoiceScriptCharacters;
  const estimatedCredits =
    surfaceMode === "create"
      ? ((pricingPolicyReady
          ? resolvePricingGridBilledCredits({
              modelId: hardcodedVoiceoverModelId,
              params: {
                textCharacters: voiceScript.trim().length,
              },
              pricingPolicy,
            })
          : null) ?? null)
      : ((pricingPolicyReady
          ? resolvePricingGridBilledCredits({
              modelId: hardcodedVoiceChangerModel,
              params: {
                sourceDurationSeconds:
                  voiceChangerSource?.durationMs != null
                    ? voiceChangerSource.durationMs / 1000
                    : undefined,
              },
              pricingPolicy,
            })
          : null) ?? null);
  const generateCreditConfidence = resolveGenerateCreditConfidence({
    actionLabel: surfaceMode === "create" ? "Generate voiceover" : "Generate voice changer",
    estimatedCredits,
    balanceCredits,
    formatCredits: formatCreditValue,
  });
  const hasKnownEstimatedCredits = estimatedCredits != null;
  const generateCostLabel = hasKnownEstimatedCredits
    ? formatCreditValue(estimatedCredits)
    : "Pending";
  const isGenerateEnabled =
    Boolean(selectedLibraryVoice?.id) &&
    (!requiresProviderVoice || isSelectedVoiceProviderReady) &&
    hasKnownEstimatedCredits &&
    (surfaceMode === "create"
      ? voiceScript.trim().length > 0 && isVoiceScriptWithinLimit
      : canSubmitVoiceChangerSource(voiceChangerSource));
  const isVoiceoverEnhanceEnabled =
    surfaceMode === "create" && voiceScript.trim().length > 0 && !isEnhancingVoiceover;
  const isCreateVoiceEnabled =
    voiceName.trim().length > 0 &&
    normalizedVoicePromptLength >= minVoicePromptCharacters &&
    isVoicePromptWithinLimit &&
    !isSavingDesignedVoice;
  const isSaveVoiceEnabled =
    voiceName.trim().length > 0 &&
    normalizedVoicePromptLength >= minVoicePromptCharacters &&
    isVoicePromptWithinLimit &&
    selectedVoiceDesignPreviewId !== null &&
    !isDesigningVoice &&
    !isSavingDesignedVoice;
  // Voice Clone intentionally has no app-enforced minimum duration. Once the sample
  // is staged successfully, short clips should still be allowed to reach Instant Voice Cloning.
  const isCloneVoiceEnabled =
    createVoiceMode === "clone" &&
    voiceName.trim().length > 0 &&
    cloneVoiceSource?.status === "ready" &&
    Boolean(cloneVoiceSource.storagePath) &&
    isCloneConsentChecked &&
    !isCloningVoice;
  const isSelectedVoiceVisibleInActiveLibrarySection =
    selectedLibraryVoice?.librarySection === activeVoicesLibrarySection;
  const canDeleteSelectedVoice =
    Boolean(selectedLibraryVoice?.id) &&
    selectedLibraryVoice?.destructiveAction !== "none" &&
    isSelectedVoiceVisibleInActiveLibrarySection;
  const selectedVoiceDestructiveLabel =
    selectedLibraryVoice?.destructiveActionLabel ??
    (selectedLibraryVoice?.destructiveAction === "remove" ? "Remove" : "Delete");
  const selectedVoiceDestructiveReason =
    selectedLibraryVoice?.destructiveActionDisabledReason ?? "Select a voice to delete.";
  const selectedGenerateVoiceName = selectedLibraryVoice
    ? getVoiceChipDisplayName(selectedLibraryVoice.name)
    : "Select a voice";
  const isSelectedVoiceFreshlyLoaded =
    Boolean(selectedLibraryVoice?.id) && selectedLibraryVoice?.id === loadedVoiceCueVoiceId;
  const isVoiceoverSurface = surfaceMode === "create";
  const { topSectionStyle, bottomSectionStyle, dividerProps } = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef,
    defaultTopRatio: 0.22,
    minTopSectionHeightPx: isVoiceoverSurface
      ? minVoiceoverTopSectionHeightPx
      : minVoiceChangerTopSectionHeightPx,
    minBottomSectionHeightPx: isVoiceoverSurface
      ? minVoiceoverBottomSectionHeightPx
      : minVoiceChangerBottomSectionHeightPx,
    maxBottomSectionHeightPx: isVoiceoverSurface ? undefined : maxVoiceChangerBottomSectionHeightPx,
    ariaLabel: "Resize voices mode and composition sections",
  });
  const fixedVoiceChangerBottomSectionStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...bottomSectionStyle,
      height: `${fixedVoiceChangerBottomSectionHeightPx}px`,
      minHeight: `${fixedVoiceChangerBottomSectionHeightPx}px`,
      maxHeight: `${fixedVoiceChangerBottomSectionHeightPx}px`,
      flexBasis: `${fixedVoiceChangerBottomSectionHeightPx}px`,
      flexGrow: 0,
      flexShrink: 0,
    }),
    [bottomSectionStyle]
  );
  const composeAreaStyle = isVoiceoverSurface
    ? bottomSectionStyle
    : fixedVoiceChangerBottomSectionStyle;

  const triggerLoadedVoiceCue = React.useCallback((voiceId: string) => {
    const normalizedVoiceId = voiceId.trim();
    if (!normalizedVoiceId) {
      return;
    }

    if (loadedVoiceCueTimeoutRef.current !== null) {
      window.clearTimeout(loadedVoiceCueTimeoutRef.current);
    }

    setLoadedVoiceCueVoiceId(normalizedVoiceId);
    loadedVoiceCueTimeoutRef.current = window.setTimeout(() => {
      setLoadedVoiceCueVoiceId((currentVoiceId) =>
        currentVoiceId === normalizedVoiceId ? null : currentVoiceId
      );
      loadedVoiceCueTimeoutRef.current = null;
    }, 6500);
  }, []);

  React.useEffect(() => {
    return () => {
      if (loadedVoiceCueTimeoutRef.current !== null) {
        window.clearTimeout(loadedVoiceCueTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isCreateVoiceModalOpen) {
      return;
    }

    const pendingVoiceId = pendingLoadedVoiceCueVoiceId?.trim() ?? "";
    const selectedVoiceId = selectedLibraryVoice?.id?.trim() ?? "";
    if (!pendingVoiceId || pendingVoiceId !== selectedVoiceId) {
      return;
    }

    triggerLoadedVoiceCue(pendingVoiceId);
    setPendingLoadedVoiceCueVoiceId(null);
  }, [
    isCreateVoiceModalOpen,
    pendingLoadedVoiceCueVoiceId,
    selectedLibraryVoice?.id,
    triggerLoadedVoiceCue,
  ]);

  React.useLayoutEffect(() => {
    const textarea = voicePromptRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(112, textarea.scrollHeight), maxVoicePromptHeightPx);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxVoicePromptHeightPx ? "auto" : "hidden";
  }, [isCreateVoiceModalOpen, voicePrompt]);

  React.useLayoutEffect(() => {
    const textarea = voiceScriptRef.current;
    if (!textarea) {
      return;
    }

    if (surfaceMode !== "create") {
      textarea.style.overflowY = "auto";
      return;
    }

    textarea.style.overflowY =
      textarea.scrollHeight > textarea.clientHeight + 1 ? "auto" : "hidden";
  }, [surfaceMode, voiceScript]);

  React.useEffect(() => {
    if (!isCreateVoiceModalOpen || !shouldFocusCreateControlsRef.current) {
      return;
    }

    voiceNameInputRef.current?.focus();
    shouldFocusCreateControlsRef.current = false;
  }, [isCreateVoiceModalOpen]);

  React.useEffect(() => {
    if (isVoicesLibraryModalOpen) {
      return;
    }
    if (!shouldRestoreVoicesLibraryTriggerFocusRef.current) {
      return;
    }
    queueMicrotask(() => {
      (voicesLibraryFocusRestoreTargetRef.current ?? voicesLibraryTriggerRef.current)?.focus();
      voicesLibraryFocusRestoreTargetRef.current = null;
    });
    shouldRestoreVoicesLibraryTriggerFocusRef.current = false;
  }, [isVoicesLibraryModalOpen]);

  React.useEffect(() => {
    if (isVoicesLibraryModalOpen) {
      return;
    }
    if (!selectedLibraryVoice) {
      return;
    }
    setActiveVoicesLibrarySection(selectedLibraryVoice.librarySection);
  }, [isVoicesLibraryModalOpen, selectedLibraryVoice]);

  React.useEffect(() => {
    if (isCreateVoiceModalOpen) {
      return;
    }
    if (!shouldRestoreCreateVoiceTriggerFocusRef.current) {
      return;
    }
    queueMicrotask(() => {
      createVoiceTriggerRef.current?.focus();
      createVoiceTriggerRef.current = null;
    });
    shouldRestoreCreateVoiceTriggerFocusRef.current = false;
  }, [isCreateVoiceModalOpen]);

  const stopActiveDesignedPreview = React.useCallback(() => {
    const activeAudio = designedPreviewAudioRef.current;
    const activeInstanceKey = designedPreviewAudioIdRef.current
      ? buildDesignedPreviewInstanceKey(designedPreviewAudioIdRef.current)
      : null;
    if (!activeAudio) {
      if (activeInstanceKey) {
        clearExclusiveSoundPlayback(activeInstanceKey);
      }
      designedPreviewAudioIdRef.current = null;
      setActiveDesignedPreviewId(null);
      return;
    }
    activeAudio.onplay = null;
    activeAudio.onpause = null;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.src = "";
    if (activeInstanceKey) {
      clearExclusiveSoundPlayback(activeInstanceKey);
    }
    designedPreviewAudioRef.current = null;
    designedPreviewAudioIdRef.current = null;
    setActiveDesignedPreviewId(null);
  }, []);

  const resetCreateVoiceModalState = React.useCallback(
    (nextMode: CreateVoiceMode = "generate") => {
      stopActiveDesignedPreview();
      setVoiceName(createVoiceDefaultName);
      setVoicePrompt("");
      setCreateVoiceMode(nextMode);
      setVoiceDesignPreviews([]);
      setSelectedVoiceDesignPreviewId(null);
      setPlayedVoiceDesignPreviewIds([]);
      setVoiceDesignPreviewText(null);
      setVoiceDesignError(null);
      setSaveVoiceError(null);
      setIsDesigningVoice(false);
      setIsSavingDesignedVoice(false);
      resetCloneVoiceSource();
      setIsCloneConsentChecked(false);
      setIsCloningVoice(false);
    },
    [resetCloneVoiceSource, setVoicePrompt, stopActiveDesignedPreview]
  );

  const handleVoiceChangerSourceChange = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      if (onControlledVoiceChangerSourceChange) {
        onControlledVoiceChangerSourceChange(nextSource);
        return;
      }
      handleUncontrolledVoiceChangerSourceChange(nextSource);
    },
    [handleUncontrolledVoiceChangerSourceChange, onControlledVoiceChangerSourceChange]
  );

  React.useEffect(() => {
    onActiveVoiceChangerSourceVideoChange?.(
      resolveActiveVoiceChangerSourceVideo({
        source: voiceChangerSource,
        surfaceMode,
      })
    );
  }, [onActiveVoiceChangerSourceVideoChange, surfaceMode, voiceChangerSource]);

  React.useEffect(() => {
    return () => {
      const designedPreviewAudio = designedPreviewAudioRef.current;
      if (designedPreviewAudio) {
        designedPreviewAudio.pause();
        designedPreviewAudio.src = "";
      }
      if (designedPreviewAudioIdRef.current) {
        clearExclusiveSoundPlayback(
          buildDesignedPreviewInstanceKey(designedPreviewAudioIdRef.current)
        );
      }
      designedPreviewAudioRef.current = null;
      designedPreviewAudioIdRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (selectedTool === "voice-changer") {
      setSurfaceMode("edit");
      setIsCreatePanelOpen(false);
      return;
    }
    if (selectedTool === "text-to-speech" || selectedTool === "voices") {
      setSurfaceMode("create");
    }
  }, [selectedTool]);

  const handleSurfaceModeChange = React.useCallback((nextMode: VoicesSurfaceMode) => {
    setSurfaceMode(nextMode);
    if (nextMode !== "create") {
      setIsCreatePanelOpen(false);
    }
  }, []);

  const handleCreateVoiceModeChange = React.useCallback(
    (nextMode: CreateVoiceMode) => {
      setCreateVoiceMode(nextMode);
      setVoiceDesignError(null);
      setSaveVoiceError(null);
      setCloneVoiceError(null);
    },
    [setCloneVoiceError]
  );

  const handleCreateVoicePreviewGeneration = React.useCallback(async () => {
    const nextVoiceName = voiceName.trim();
    const nextVoiceDescription = voicePrompt.trim();
    if (
      !nextVoiceName ||
      nextVoiceDescription.length < minVoicePromptCharacters ||
      !isVoicePromptWithinLimit
    ) {
      return;
    }

    stopActiveDesignedPreview();
    setVoiceDesignError(null);
    setSaveVoiceError(null);
    setIsDesigningVoice(true);
    setVoiceDesignPreviews([]);
    setVoiceDesignPreviewText(null);
    setSelectedVoiceDesignPreviewId(null);
    setPlayedVoiceDesignPreviewIds([]);
    try {
      const payload = await requestVoiceDesignPreviews({
        voiceName: nextVoiceName,
        voiceDescription: nextVoiceDescription,
      });

      const nextPreviews = (payload?.previews ?? []).map((preview) => ({
        ...preview,
        audioSrc: buildVoiceDesignPreviewAudioSrc(preview.audioBase64, preview.mediaType),
      }));

      if (nextPreviews.length === 0) {
        throw new Error("No voice previews were returned.");
      }

      setVoiceDesignPreviews(nextPreviews);
      setVoiceDesignPreviewText(payload?.previewText?.trim() || null);
      setSelectedVoiceDesignPreviewId(nextPreviews[0]?.generatedVoiceId ?? null);
    } catch (error) {
      setVoiceDesignPreviews([]);
      setVoiceDesignPreviewText(null);
      setSelectedVoiceDesignPreviewId(null);
      setVoiceDesignError(
        sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Unable to generate voice previews."
        )
      );
    } finally {
      setIsDesigningVoice(false);
    }
  }, [isVoicePromptWithinLimit, stopActiveDesignedPreview, voiceName, voicePrompt]);

  const canAcceptVoiceCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) =>
      payload.kind === "text" && payload.text.trim().length > 0,
    []
  );
  const acceptVoiceoverScriptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (!canAcceptVoiceCanvasTearOutPayload(payload) || payload.kind !== "text") return;
      insertCanvasPromptTextIntoTextarea({
        composerText: voiceScript,
        droppedPromptText: payload.text,
        onChange: setVoiceScript,
        textarea: voiceScriptRef.current,
      });
      setVoiceoverEnhanceDraft(null);
      setVoiceoverEnhanceError(null);
    },
    [canAcceptVoiceCanvasTearOutPayload, setVoiceScript, voiceScript]
  );
  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !voiceScriptRef.current || surfaceMode !== "create") return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "voiceover-script-composer",
      element: voiceScriptRef.current,
      canAccept: canAcceptVoiceCanvasTearOutPayload,
      accept: acceptVoiceoverScriptCanvasTearOutPayload,
    });
  }, [
    acceptVoiceoverScriptCanvasTearOutPayload,
    canAcceptVoiceCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    surfaceMode,
  ]);

  const handleVoicePromptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    handlePromptTextAreaDrop({
      event,
      composerText: voicePrompt,
      onChange: setVoicePrompt,
      textareaRef: voicePromptRef,
    });
  };

  const handleVoiceScriptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const handled = handlePromptTextAreaDrop({
      event,
      composerText: voiceScript,
      onChange: setVoiceScript,
      textareaRef: voiceScriptRef,
    });
    if (!handled) return;
    setVoiceoverEnhanceDraft(null);
    setVoiceoverEnhanceError(null);
  };

  const openCreateVoiceModal = React.useCallback(
    (
      initialMode: CreateVoiceMode,
      options?: {
        nextSurfaceMode?: VoicesSurfaceMode | null;
        restoreFocusTo?: HTMLButtonElement | null;
      }
    ) => {
      const nextSurfaceMode = options?.nextSurfaceMode ?? null;
      const restoreFocusTo = options?.restoreFocusTo ?? null;

      shouldFocusCreateControlsRef.current = true;
      shouldRestoreVoicesLibraryTriggerFocusRef.current = false;
      shouldRestoreCreateVoiceTriggerFocusRef.current = restoreFocusTo !== null;
      createVoiceTriggerRef.current = restoreFocusTo;
      setIsVoicesLibraryModalOpen(false);
      if (nextSurfaceMode) {
        handleSurfaceModeChange(nextSurfaceMode);
      }
      resetCreateVoiceModalState(initialMode);
      setIsCreatePanelOpen(true);
    },
    [handleSurfaceModeChange, resetCreateVoiceModalState]
  );

  const handleCreateVoiceEntry = React.useCallback(() => {
    openCreateVoiceModal("generate", {
      nextSurfaceMode: "create",
      restoreFocusTo: voicesLibraryTriggerRef.current,
    });
  }, [openCreateVoiceModal]);

  const handleCloseCreatePanel = React.useCallback(() => {
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(false);
  }, [resetCreateVoiceModalState]);

  useAiStudioModalActivity("voices-create-modal", isCreateVoiceModalOpen);

  const handleOpenVoicesLibraryModal = React.useCallback(
    (restoreFocusTo?: HTMLButtonElement | null) => {
      voicesLibraryFocusRestoreTargetRef.current =
        restoreFocusTo ?? voicesLibraryTriggerRef.current;
      shouldRestoreVoicesLibraryTriggerFocusRef.current = true;
      setActiveVoicesLibrarySection("my");
      setVoicesLoadNotice((current) => (isTransientVoicePreviewNotice(current) ? null : current));
      setIsVoicesLibraryModalOpen(true);
    },
    [setVoicesLoadNotice]
  );

  React.useEffect(() => {
    if (!isCreateVoiceModalOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      handleCloseCreatePanel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleCloseCreatePanel, isCreateVoiceModalOpen]);

  React.useEffect(() => {
    resetSharedVoicesGridStore();
    stopActiveVoicePreview();
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(false);
    setIsVoicesLibraryModalOpen(false);
    setVoicesLoadError(null);
    setVoicesLoadNotice(null);
    setPendingDeleteVoice(null);
    setIsDeletingSelectedVoice(false);
    setActiveVoicesLibrarySection("my");
    setPendingLoadedVoiceCueVoiceId(null);
    setLoadedVoiceCueVoiceId(null);
  }, [
    resetCreateVoiceModalState,
    sessionUserId,
    setVoicesLoadError,
    setVoicesLoadNotice,
    stopActiveVoicePreview,
  ]);

  const handleCloseVoicesLibraryModal = React.useCallback(() => {
    stopActiveVoicePreview();
    setIsVoicesLibraryModalOpen(false);
  }, [stopActiveVoicePreview]);

  React.useEffect(() => {
    if (!isVoicesLibraryModalOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      handleCloseVoicesLibraryModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleCloseVoicesLibraryModal, isVoicesLibraryModalOpen]);

  const handleDesignedPreviewPlay = React.useCallback(
    (previewId: string, previewUrl: string) => {
      if (!previewUrl || typeof Audio === "undefined") return;
      setPlayedVoiceDesignPreviewIds((currentIds) =>
        currentIds.includes(previewId) ? currentIds : [...currentIds, previewId]
      );
      const activeAudio = designedPreviewAudioRef.current;
      const isSamePreview = designedPreviewAudioIdRef.current === previewId;
      if (activeAudio && isSamePreview) {
        stopActiveDesignedPreview();
        return;
      }

      stopActiveVoicePreview();
      if (activeAudio) {
        stopActiveDesignedPreview();
      }

      const nextAudio = new Audio(previewUrl);
      const nextInstanceKey = buildDesignedPreviewInstanceKey(previewId);
      nextAudio.preload = "none";
      nextAudio.onplay = () => {
        if (designedPreviewAudioRef.current !== nextAudio) return;
        markExclusiveSoundPlaying({
          instanceKey: nextInstanceKey,
          pause: () => {
            nextAudio.pause();
          },
        });
        setActiveDesignedPreviewId(previewId);
      };
      nextAudio.onpause = () => {
        if (designedPreviewAudioRef.current !== nextAudio) return;
        if (nextAudio.ended || nextAudio.currentTime <= 0) {
          stopActiveDesignedPreview();
        }
      };
      nextAudio.onended = () => {
        if (designedPreviewAudioRef.current !== nextAudio) return;
        stopActiveDesignedPreview();
      };
      nextAudio.onerror = () => {
        if (designedPreviewAudioRef.current !== nextAudio) return;
        stopActiveDesignedPreview();
      };
      designedPreviewAudioRef.current = nextAudio;
      designedPreviewAudioIdRef.current = previewId;
      requestExclusiveSoundPlayback({
        instanceKey: nextInstanceKey,
        pause: () => {
          nextAudio.pause();
        },
      });
      const playResult = nextAudio.play();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch(() => {
          if (designedPreviewAudioRef.current === nextAudio) {
            stopActiveDesignedPreview();
          }
        });
      }
    },
    [stopActiveDesignedPreview, stopActiveVoicePreview]
  );

  const handleSaveDesignedVoice = React.useCallback(async () => {
    const nextVoiceName = voiceName.trim();
    const nextVoiceDescription = voicePrompt.trim();
    if (
      !nextVoiceName ||
      nextVoiceDescription.length < minVoicePromptCharacters ||
      !selectedVoiceDesignPreviewId ||
      !isVoicePromptWithinLimit
    ) {
      return;
    }

    setSaveVoiceError(null);
    setIsSavingDesignedVoice(true);
    try {
      const playedNotSelectedPreviews = playedVoiceDesignPreviewIds
        .filter((previewId) => previewId !== selectedVoiceDesignPreviewId)
        .map((previewId) =>
          voiceDesignPreviews.find((preview) => preview.generatedVoiceId === previewId)
        )
        .filter(
          (preview): preview is CreateVoiceModalPreview =>
            Boolean(preview?.generatedVoiceId) && Boolean(preview?.previewToken)
        );
      const payload = await createDesignedVoice({
        voiceName: nextVoiceName,
        voiceDescription: nextVoiceDescription,
        generatedVoiceId: selectedVoiceDesignPreviewId,
        generatedVoiceToken:
          voiceDesignPreviews.find(
            (preview) => preview.generatedVoiceId === selectedVoiceDesignPreviewId
          )?.previewToken ?? null,
        playedNotSelectedVoiceIds: playedNotSelectedPreviews.map(
          (preview) => preview.generatedVoiceId
        ),
        playedNotSelectedVoiceTokens: playedNotSelectedPreviews.map(
          (preview) => preview.previewToken
        ),
      });

      const createdVoiceId = payload?.voice?.voiceId?.trim() ?? "";
      const createdVoiceName = payload?.voice?.name?.trim() ?? "";
      if (!createdVoiceId || !createdVoiceName) {
        throw new Error("The created voice response was invalid.");
      }

      upsertSharedVoice({
        id: createdVoiceId,
        name: createdVoiceName,
        previewUrl: payload?.voice?.previewUrl?.trim() || null,
        description: payload?.voice?.description?.trim() || nextVoiceDescription,
        isFallback: false,
        librarySection: "my",
        provider: "elevenlabs",
      });
      setPendingLoadedVoiceCueVoiceId(createdVoiceId);
      setActiveVoicesLibrarySection("my");
      resetCreateVoiceModalState();
      setIsCreatePanelOpen(false);
    } catch (error) {
      setSaveVoiceError(
        sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Unable to create voice."
        )
      );
    } finally {
      setIsSavingDesignedVoice(false);
    }
  }, [
    resetCreateVoiceModalState,
    isVoicePromptWithinLimit,
    playedVoiceDesignPreviewIds,
    selectedVoiceDesignPreviewId,
    upsertSharedVoice,
    voiceDesignPreviews,
    voiceName,
    voicePrompt,
  ]);

  const handleCloneVoice = React.useCallback(async () => {
    const nextVoiceName = voiceName.trim();
    const sourceStoragePath = cloneVoiceSource?.storagePath?.trim() ?? "";
    if (
      !nextVoiceName ||
      cloneVoiceSource?.status !== "ready" ||
      !sourceStoragePath ||
      !isCloneConsentChecked
    ) {
      return;
    }

    setCloneVoiceError(null);
    setIsCloningVoice(true);
    try {
      const payload = await cloneProviderVoice({
        voiceName: nextVoiceName,
        sourceStoragePath,
        sourceName: cloneVoiceSource.name,
      });

      const clonedVoiceId = payload?.voice?.voiceId?.trim() ?? "";
      const clonedVoiceName = payload?.voice?.name?.trim() ?? "";
      if (!clonedVoiceId || !clonedVoiceName) {
        throw new Error("The cloned voice response was invalid.");
      }

      upsertSharedVoice({
        id: clonedVoiceId,
        name: clonedVoiceName,
        previewUrl: payload?.voice?.previewUrl?.trim() || null,
        description: payload?.voice?.description?.trim() || null,
        isFallback: false,
        librarySection: "my",
        provider: "elevenlabs",
      });
      setPendingLoadedVoiceCueVoiceId(clonedVoiceId);
      setActiveVoicesLibrarySection("my");
      resetCreateVoiceModalState();
      setIsCreatePanelOpen(false);
    } catch (error) {
      setCloneVoiceError(
        sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Unable to clone voice."
        )
      );
    } finally {
      setIsCloningVoice(false);
    }
  }, [
    cloneVoiceSource,
    isCloneConsentChecked,
    resetCreateVoiceModalState,
    setCloneVoiceError,
    upsertSharedVoice,
    voiceName,
  ]);

  const handleDeleteSelectedVoice = React.useCallback(() => {
    if (!selectedLibraryVoice) {
      return;
    }
    if (selectedLibraryVoice.destructiveAction === "none") {
      setVoicesLoadError(
        selectedLibraryVoice.destructiveActionDisabledReason || "This voice can't be deleted here."
      );
      return;
    }

    setPendingDeleteVoice(selectedLibraryVoice);
  }, [selectedLibraryVoice, setVoicesLoadError]);

  const closeDeleteVoiceConfirm = React.useCallback(() => {
    if (isDeletingSelectedVoice) {
      return;
    }
    setPendingDeleteVoice(null);
  }, [isDeletingSelectedVoice]);

  const handleConfirmDeleteSelectedVoice = React.useCallback(async () => {
    if (!pendingDeleteVoice) {
      return;
    }

    setVoicesLoadError(null);
    setVoicesLoadNotice(null);
    setIsDeletingSelectedVoice(true);
    try {
      await deleteProviderVoice(pendingDeleteVoice.id);

      if (activePreviewVoiceId === pendingDeleteVoice.id) {
        stopActiveVoicePreview();
      }

      replaceVoices(libraryVoices.filter((voice) => voice.id !== pendingDeleteVoice.id));
      setPendingDeleteVoice(null);
    } catch (error) {
      setVoicesLoadError(
        sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Unable to delete voice."
        )
      );
    } finally {
      setIsDeletingSelectedVoice(false);
    }
  }, [
    activePreviewVoiceId,
    libraryVoices,
    pendingDeleteVoice,
    replaceVoices,
    setVoicesLoadError,
    setVoicesLoadNotice,
    stopActiveVoicePreview,
  ]);

  const handleGenerate = React.useCallback(() => {
    if (
      !selectedLibraryVoice ||
      selectedLibraryVoice.provider !== "elevenlabs" ||
      selectedLibraryVoice.isFallback ||
      !onGenerate
    ) {
      return;
    }
    if (surfaceMode === "create") {
      if (!voiceScript.trim() || !isVoiceScriptWithinLimit || estimatedCredits == null) return;
      void onGenerate({
        mode: "voiceover",
        voice: selectedLibraryVoice,
        script: voiceScript.trim(),
        outputFormat: hardcodedVoiceOutputFormat,
        config: buildVoiceoverRequestConfig(),
        displayedBilledCredits: estimatedCredits,
        pricingPolicyReady,
      });
      return;
    }
    if (
      !voiceChangerSource ||
      !canSubmitVoiceChangerSource(voiceChangerSource) ||
      estimatedCredits == null
    ) {
      return;
    }
    void onGenerate({
      mode: "voice-changer",
      voice: selectedLibraryVoice,
      source: voiceChangerSource,
      outputFormat: hardcodedVoiceOutputFormat,
      removeBackgroundNoise: hardcodedVoiceChangerNoiseReductionEnabled,
      modelId: hardcodedVoiceChangerModel,
      inputFormat: hardcodedVoiceChangerInputFormat,
      displayedBilledCredits: estimatedCredits,
      pricingPolicyReady,
      voiceSettings: buildVoiceChangerRequestSettings(),
    });
  }, [
    onGenerate,
    selectedLibraryVoice,
    surfaceMode,
    estimatedCredits,
    isVoiceScriptWithinLimit,
    pricingPolicyReady,
    voiceChangerSource,
    voiceScript,
  ]);

  const handleEnhanceVoiceoverScript = React.useCallback(async () => {
    const script = voiceScript.trim();
    if (!script || isEnhancingVoiceover) return;
    setVoiceoverEnhanceError(null);
    setVoiceoverEnhanceDraft(null);
    setIsEnhancingVoiceover(true);
    try {
      const enhancedScript = await enhanceVoiceoverScript(script);
      setVoiceoverEnhanceDraft(enhancedScript);
      const restoreFocus = () => {
        voiceScriptRef.current?.focus();
      };
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(restoreFocus);
      } else {
        restoreFocus();
      }
    } catch (error) {
      setVoiceoverEnhanceError(
        sanitizeCustomerFacingProviderText(
          error instanceof Error ? error.message : null,
          "Unable to enhance voiceover."
        )
      );
    } finally {
      setIsEnhancingVoiceover(false);
    }
  }, [isEnhancingVoiceover, voiceScript]);

  const handleApplyVoiceoverEnhanceDraft = React.useCallback(() => {
    if (!voiceoverEnhanceDraft) return;
    setVoiceScript(voiceoverEnhanceDraft);
    setVoiceoverEnhanceDraft(null);
    voiceScriptRef.current?.focus();
  }, [setVoiceScript, voiceoverEnhanceDraft]);

  const handleDismissVoiceoverEnhanceDraft = React.useCallback(() => {
    setVoiceoverEnhanceDraft(null);
    voiceScriptRef.current?.focus();
  }, []);

  const cloneSourceIntake = (
    <VoiceChangerSourceDropzone
      source={cloneVoiceSource}
      onSourceChange={handleCloneVoiceSourceChange}
      resolveInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
      acceptedKinds={["audio"]}
      copy={cloneVoiceSourceDropzoneCopy}
    />
  );
  const voiceModeTabsStyle = React.useMemo(
    () =>
      ({
        ["--voices-properties-mode-index" as string]: surfaceMode === "edit" ? 1 : 0,
      }) as React.CSSProperties,
    [surfaceMode]
  );

  return (
    <section
      className={`voices-properties-panel tool-properties ${styles.bootstrapStyleScope}`}
      aria-label="Voices properties"
    >
      <div className="voices-properties-shell">
        <div className="voices-properties-column-shell">
          <div ref={splitContainerRef} className="voices-properties-main">
            <section className="voices-properties-topbar" style={topSectionStyle}>
              <div className="voices-properties-panel-header">
                <div className="voices-properties-compose-mode-switcher">
                  <div className="voices-properties-mode-switcher">
                    <span className="voices-properties-mode-switcher-label">Voice Mode</span>
                    <div className="voices-properties-mode-control-row" style={voiceModeTabsStyle}>
                      <span className="voices-properties-mode-indicator" aria-hidden="true" />
                      <div
                        className="voices-properties-mode-tabs"
                        role="tablist"
                        aria-label="Voice mode"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={surfaceMode === "create"}
                          data-voice-mode="voiceover"
                          className={`voices-properties-mode-tab ${
                            surfaceMode === "create" ? "is-active" : ""
                          }`}
                          onClick={() => handleSurfaceModeChange("create")}
                        >
                          Voiceover
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={surfaceMode === "edit"}
                          data-voice-mode="voice-changer"
                          className={`voices-properties-mode-tab ${
                            surfaceMode === "edit" ? "is-active" : ""
                          }`}
                          onClick={() => {
                            handleSurfaceModeChange("edit");
                            setIsCreatePanelOpen(false);
                          }}
                        >
                          Voice Changer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div
              className="voices-properties-divider-wrap reference-grid-horizontal-divider-wrap"
              {...dividerProps}
            >
              <div
                className="voices-properties-divider reference-grid-horizontal-divider"
                aria-hidden="true"
              />
            </div>

            <section className="voices-properties-compose-area" style={composeAreaStyle}>
              {surfaceMode === "create" ? (
                <div className="voices-properties-script-input-shell">
                  <div className="voices-properties-script-editor">
                    <textarea
                      ref={voiceScriptRef}
                      className="voices-properties-script-input"
                      value={voiceScript}
                      onChange={(event) => {
                        setVoiceScript(event.target.value);
                        setVoiceoverEnhanceDraft(null);
                        setVoiceoverEnhanceError(null);
                      }}
                      onDrop={handleVoiceScriptDrop}
                      onDragOver={handlePromptTextAreaDragOver}
                      placeholder={voiceScriptPlaceholder}
                      aria-label="Voice script"
                    />
                  </div>
                  <div className="voices-properties-script-meta-row">
                    <div className="voices-properties-script-meta-status">
                      {surfaceMode === "create" && voiceoverEnhanceError ? (
                        <p className="voices-properties-script-error" role="alert">
                          {voiceoverEnhanceError}
                        </p>
                      ) : surfaceMode === "create" && isEnhancingVoiceover ? (
                        <p className="voices-properties-script-processing" role="status">
                          Enhancing script...
                        </p>
                      ) : null}
                    </div>
                    <div className="voices-properties-script-meta-actions">
                      {surfaceMode === "create" ? (
                        <AgentEnhanceButton
                          onClick={handleEnhanceVoiceoverScript}
                          disabled={!isVoiceoverEnhanceEnabled}
                          loading={isEnhancingVoiceover}
                          ariaLabel={
                            isEnhancingVoiceover
                              ? "Enhancing voiceover script"
                              : "Enhance voiceover script"
                          }
                          loadingLabel="Enhancing"
                          className="voices-properties-enhance-btn"
                        />
                      ) : null}
                      <p className="voices-properties-script-count" aria-live="polite">
                        {`${voiceScript.length.toLocaleString()} / ${maxVoiceScriptCharacters.toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  {voiceoverEnhanceDraft ? (
                    <div className="voices-properties-enhance-review" role="status">
                      <div className="voices-properties-enhance-review-copy">
                        <p className="voices-properties-enhance-review-label">
                          Enhanced version ready
                        </p>
                        <p className="voices-properties-enhance-review-preview">
                          {voiceoverEnhanceDraft}
                        </p>
                      </div>
                      <div className="voices-properties-enhance-review-actions">
                        <button
                          type="button"
                          className="voices-properties-enhance-review-btn voices-properties-enhance-review-btn--primary"
                          onClick={handleApplyVoiceoverEnhanceDraft}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="voices-properties-enhance-review-btn"
                          onClick={handleDismissVoiceoverEnhanceDraft}
                        >
                          Keep original
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <VoiceChangerSourceDropzone
                  source={voiceChangerSource}
                  onSourceChange={handleVoiceChangerSourceChange}
                  onSourceMetadataChange={
                    onControlledVoiceChangerSourceMetadataChange ??
                    handleUncontrolledVoiceChangerSourceMetadataChange
                  }
                  resolveInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
                />
              )}

              <div className="voices-properties-script-divider" aria-hidden="true" />

              <div className="voices-properties-script-actions">
                <div className="voices-properties-library-selector voices-properties-library-selector--footer">
                  <button
                    ref={voicesLibraryTriggerRef}
                    type="button"
                    className="voices-properties-library-open-btn"
                    style={{
                      width: "144px",
                      minWidth: "144px",
                      maxWidth: "144px",
                      height: "42px",
                      minHeight: "42px",
                      maxHeight: "42px",
                      padding: "0 24px",
                      borderRadius: "12px",
                      fontSize: "0.98rem",
                    }}
                    aria-label="Voices"
                    onClick={() => handleOpenVoicesLibraryModal(voicesLibraryTriggerRef.current)}
                  >
                    <span>Voices</span>
                  </button>
                  <h2 className="voices-properties-library-label">Select or create new voice</h2>
                </div>
                <div className="voices-properties-generate-context is-align-end" aria-live="polite">
                  <span className="voices-properties-generate-context-value-row">
                    {isSelectedVoiceFreshlyLoaded ? (
                      <span
                        data-testid="selected-voice-loaded-arrow"
                        aria-hidden="true"
                        style={loadedVoiceArrowInlineStyle}
                      >
                        →
                      </span>
                    ) : null}
                    <button
                      ref={selectedVoiceTriggerRef}
                      type="button"
                      className="voices-properties-generate-context-copy voices-properties-selected-voice-trigger"
                      aria-label={`Open voices modal for selected voice ${selectedGenerateVoiceName}`}
                      onClick={() => handleOpenVoicesLibraryModal(selectedVoiceTriggerRef.current)}
                    >
                      <span className="voices-properties-generate-context-label">
                        Selected voice
                      </span>
                      <span
                        className="voices-properties-generate-context-value"
                        style={
                          isSelectedVoiceFreshlyLoaded ? loadedVoiceValueInlineStyle : undefined
                        }
                      >
                        {selectedGenerateVoiceName}
                      </span>
                    </button>
                  </span>
                </div>
                {generationAccessCta ? (
                  <GenerationAccessCtaButton
                    cta={generationAccessCta}
                    className="ai-generation-access-cta--audio"
                  />
                ) : (
                  <button
                    type="button"
                    className="voices-properties-generate-btn"
                    data-credit-confidence={generateCreditConfidence.status}
                    disabled={!isGenerateEnabled}
                    aria-label="Generate"
                    title={generateCreditConfidence.title}
                    onClick={handleGenerate}
                  >
                    <span className="voices-properties-generate-label">Generate</span>
                    <span className="voices-properties-generate-pill" aria-hidden="true">
                      <span className="voices-properties-generate-cost-icon">✦</span>
                      <span className="voices-properties-generate-cost-value">
                        {generateCostLabel}
                        <span className="voices-properties-generate-cost-label">credits</span>
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
      <VoicesLibraryModal
        isOpen={isVoicesLibraryModalOpen}
        onClose={handleCloseVoicesLibraryModal}
        title="Voices"
        subtitle="Choose the voice used for voiceover and voice changer output."
        headerActions={
          <>
            {selectedLibraryVoice ? (
              <button
                type="button"
                className="voices-properties-library-delete-btn"
                onClick={handleDeleteSelectedVoice}
                aria-label={selectedVoiceDestructiveLabel}
                disabled={!canDeleteSelectedVoice || isDeletingSelectedVoice}
                title={canDeleteSelectedVoice ? undefined : selectedVoiceDestructiveReason}
              >
                <Trash size={14} weight="bold" aria-hidden="true" />
                <span>
                  {isDeletingSelectedVoice
                    ? selectedLibraryVoice.destructiveAction === "remove"
                      ? "Removing…"
                      : "Deleting…"
                    : selectedVoiceDestructiveLabel}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="voices-properties-library-create-btn"
              onClick={handleCreateVoiceEntry}
              aria-label="+ Create New Voice"
            >
              <span className="voices-properties-library-create-btn-icon" aria-hidden="true">
                +
              </span>
              <span>Create New Voice</span>
            </button>
          </>
        }
      >
        <section className="voices-library-modal-content" aria-label="Available voices">
          <VoiceLibraryContent
            libraryVoices={libraryVoices}
            selectedLibraryVoice={selectedLibraryVoice}
            activeLibrarySection={activeVoicesLibrarySection}
            activePreviewVoiceId={activePreviewVoiceId}
            isVoicesLoading={isVoicesLoading}
            voicesLoadError={voicesLoadError}
            voicesLoadNotice={voicesLoadNotice}
            voiceLoadingSkeletonCount={voiceLoadingSkeletonCount}
            getVoiceChipDisplayName={getVoiceChipDisplayName}
            onActiveLibrarySectionChange={setActiveVoicesLibrarySection}
            onSelectVoice={setSelectedLibraryVoice}
            onPreviewVoice={handleVoicePreviewPlay}
            primaryAction={
              <button
                type="button"
                className="voices-properties-save-btn voices-library-modal-select-btn"
                onClick={handleCloseVoicesLibraryModal}
                disabled={!isSelectedVoiceVisibleInActiveLibrarySection}
              >
                Select voice
              </button>
            }
          />
        </section>
      </VoicesLibraryModal>
      {pendingDeleteVoice ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title={
              pendingDeleteVoice.destructiveAction === "remove"
                ? "Remove this voice?"
                : "Delete this voice?"
            }
            body={
              <p>
                <strong>
                  {getVoiceChipDisplayName(pendingDeleteVoice.name) || pendingDeleteVoice.name}
                </strong>{" "}
                {pendingDeleteVoice.destructiveAction === "remove"
                  ? "will be removed from your ShortPulse saved voices."
                  : "will be deleted from your ShortPulse voice library and removed from saved voices."}
              </p>
            }
            confirmLabel={pendingDeleteVoice.destructiveAction === "remove" ? "Remove" : "Delete"}
            confirmBusyLabel={
              isDeletingSelectedVoice
                ? pendingDeleteVoice.destructiveAction === "remove"
                  ? "Removing..."
                  : "Deleting..."
                : undefined
            }
            confirmDisabled={isDeletingSelectedVoice}
            cancelDisabled={isDeletingSelectedVoice}
            tone={pendingDeleteVoice.destructiveAction === "remove" ? "primary" : "danger"}
            onCancel={closeDeleteVoiceConfirm}
            onConfirm={() => {
              void handleConfirmDeleteSelectedVoice();
            }}
          />
        </AiStudioModalLayer>
      ) : null}
      {isCreateVoiceModalOpen ? (
        <AiStudioModalLayer>
          <CreateVoiceModal
            createMode={createVoiceMode}
            voiceName={voiceName}
            voicePrompt={voicePrompt}
            voiceNameInputRef={voiceNameInputRef}
            voicePromptRef={voicePromptRef}
            normalizedVoicePromptLength={normalizedVoicePromptLength}
            minVoicePromptCharacters={minVoicePromptCharacters}
            voicePromptPlaceholder={voicePromptPlaceholder}
            isCreateVoiceEnabled={isCreateVoiceEnabled}
            isDesigningVoice={isDesigningVoice}
            isSaveVoiceEnabled={isSaveVoiceEnabled}
            isSavingDesignedVoice={isSavingDesignedVoice}
            cloneSourceIntake={cloneSourceIntake}
            isCloneConsentChecked={isCloneConsentChecked}
            isCloneVoiceEnabled={isCloneVoiceEnabled}
            isCloningVoice={isCloningVoice}
            voiceDesignPreviewText={voiceDesignPreviewText}
            voiceDesignPreviews={voiceDesignPreviews}
            selectedVoiceDesignPreviewId={selectedVoiceDesignPreviewId}
            activeDesignedPreviewId={activeDesignedPreviewId}
            voiceDesignError={voiceDesignError}
            saveVoiceError={saveVoiceError}
            cloneVoiceError={cloneVoiceError}
            onClose={handleCloseCreatePanel}
            onCreateModeChange={handleCreateVoiceModeChange}
            onVoiceNameChange={handleVoiceNameChange}
            onVoicePromptChange={setVoicePrompt}
            onCloneConsentChange={setIsCloneConsentChecked}
            onVoicePromptDrop={handleVoicePromptDrop}
            onVoicePromptDragOver={handlePromptTextAreaDragOver}
            onGenerateVoicePreviews={() => {
              void handleCreateVoicePreviewGeneration();
            }}
            onSaveVoice={() => {
              void (createVoiceMode === "clone" ? handleCloneVoice() : handleSaveDesignedVoice());
            }}
            onCloneVoice={() => {
              void handleCloneVoice();
            }}
            onSelectPreview={setSelectedVoiceDesignPreviewId}
            onPlayPreview={handleDesignedPreviewPlay}
          />
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
});
