/**
 * Voices properties panel for AI Studio.
 * Keeps the Voices workflow visually aligned with the TTS layout while remaining fully isolated.
 */
import React from "react";
import { Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { clampCustomVoiceNameInput } from "../../../lib/customVoiceName";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import {
  resolveRequiredAudioVoiceChangerModelId,
  resolveRequiredAudioVoiceDesignModelId,
  resolveRequiredAudioVoiceoverModelId,
} from "../../../lib/model-runtime/modelCatalog";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useVoiceChangerSourceController } from "../hooks/useVoiceChangerSourceController";
import {
  resetSharedVoicesGridStore,
  useSharedVoicesGrid,
  type SharedVoiceOption,
} from "../hooks/useSharedVoicesGrid";
import { resolveClientBilledCredits } from "../logic/clientPricingDisplay";
import type { ToolId } from "../types";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import { CreateVoiceModal, type CreateVoiceModalPreview } from "./CreateVoiceModal";
import { VoiceLibraryContent } from "./VoiceLibraryContent";
import {
  releaseVoiceChangerSource,
  VoiceChangerSourceDropzone,
  type ResolveVoiceChangerInternalReferenceSource,
  type VoiceChangerSource,
} from "./VoiceChangerSourceDropzone";
import { VoicesLibraryModal } from "./VoicesLibraryModal";
import {
  resolveVoiceChangerMediaDurationMs,
  resolveVoiceChangerSourceStoragePath,
  signVoiceSourceStoragePath,
  uploadVoiceCloneSourceFile,
} from "../utils/voiceChangerSourceAsset";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "./shared/exclusiveSoundPlayback";

type VoicesSurfaceMode = "create" | "edit";
type CreateVoiceMode = "generate" | "clone";
type VoicesLibrarySection = "default" | "my";

type ElevenVoiceoverRequestConfig = {
  model_id: string;
  language_code: null;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    speed: number;
    style: 0;
    use_speaker_boost: boolean;
  };
};

const voicePromptPlaceholder =
  "Enter the prompt used to generate this voice: tone, age, and delivery.";
const voiceScriptPlaceholder = "Paste or write the script that will be spoken with this voice.";
const createVoiceDefaultName = "";

const maxVoicePromptCharacters = 1000;
const minVoicePromptCharacters = 20;
const maxVoiceScriptCharacters = 5000;
const voiceLoadingSkeletonCount = 12;
const maxVoicePromptHeightPx = 264;
const minVoiceoverTopSectionHeightPx = 72;
const minVoiceoverBottomSectionHeightPx = 240;
const minVoiceChangerTopSectionHeightPx = 120;
const minVoiceChangerBottomSectionHeightPx = 600;
const maxVoiceChangerBottomSectionHeightPx = 600;
const fixedVoiceChangerBottomSectionHeightPx = 600;
const droppedImageUrlPattern = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$/i;
const droppedVideoUrlPattern = /^https?:\/\/\S+\.(?:mp4|mov|webm|m4v)(?:\?.*)?$/i;
const cloneVoiceSourceDropzoneCopy = {
  inputAriaLabel: "Voice clone source file input",
  dropzoneAriaLabel: "Voice clone source drop zone",
  dropzoneCaptionId: "voice-clone-dropzone-caption",
  recordPanelAriaLabel: "Record voice sample",
  recordTitle: "Record",
  recordHelper: "Record a voice sample to create a cloned voice.",
  recordButtonIdleAriaLabel: "Record your voice sample",
  recordButtonRecordingAriaLabel: "Stop recording your voice sample",
  dropTitle: "Drop a voice sample",
  dropHelper: "Drag one audio file from your computer or the Reference Grid. Click to browse.",
  caption: "Accepts MP3, WAV, M4A, AAC, FLAC, OGG, and WEBM.",
  unableReferenceError: "Unable to use this reference as a voice clone sample.",
  readyTitle: "Ready to clone",
  uploadingAudioDetail: "Staging the voice sample so it is ready for cloning.",
  failedFallbackDetail: "Unable to prepare the selected voice sample.",
};
export const hardcodedVoiceoverModelId = resolveRequiredAudioVoiceoverModelId();
export const hardcodedVoiceoverLanguageCode = null;
export const hardcodedVoiceoverStyleValue = 0 as const;
export const hardcodedVoiceDesignModelId = resolveRequiredAudioVoiceDesignModelId();
export const hardcodedVoiceGenerationDefaults = {
  stability: 1,
  similarity_boost: 1,
  speed: 1,
  style: 0,
  use_speaker_boost: true,
} as const;
export const hardcodedVoiceOutputFormat = "mp3_44100_128";
const hardcodedVoiceChangerNoiseReductionEnabled = false;

export const buildVoiceoverElevenV3RequestConfig = (): ElevenVoiceoverRequestConfig => ({
  model_id: hardcodedVoiceoverModelId,
  language_code: hardcodedVoiceoverLanguageCode,
  voice_settings: {
    stability: hardcodedVoiceGenerationDefaults.stability,
    similarity_boost: hardcodedVoiceGenerationDefaults.similarity_boost,
    speed: hardcodedVoiceGenerationDefaults.speed,
    style: hardcodedVoiceoverStyleValue,
    use_speaker_boost: hardcodedVoiceGenerationDefaults.use_speaker_boost,
  },
});

const hardcodedVoiceChangerModel = resolveRequiredAudioVoiceChangerModelId();
const hardcodedVoiceChangerSpeakerBoostEnabled = true;
const hardcodedVoiceChangerInputFormat = "other";
const voicePreviewUnavailableNotice = "This voice does not have a preview sample yet.";
const voicePreviewBrowserUnavailableNotice = "Audio previews are not available in this browser.";
const voicePreviewPlaybackErrorNotice = "Unable to play this voice sample right now.";
const loadedVoiceArrowInlineStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "54px",
  flexShrink: 0,
  alignSelf: "center",
  color: "rgba(114, 243, 217, 0.98)",
  fontSize: "44px",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.08em",
  textShadow: "0 0 18px rgba(80, 226, 205, 0.3), 0 0 32px rgba(80, 226, 205, 0.18)",
  transform: "translateY(1px)",
};

const loadedVoiceValueInlineStyle: React.CSSProperties = {
  color: "rgba(239, 255, 252, 1)",
  textShadow: "0 0 16px rgba(105, 220, 203, 0.28)",
};
const isTransientVoicePreviewNotice = (value: string | null): boolean =>
  value === voicePreviewUnavailableNotice ||
  value === voicePreviewBrowserUnavailableNotice ||
  value === voicePreviewPlaybackErrorNotice;

const extractDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  if (!promptText) return null;
  if (/^data:(image|video)\//i.test(promptText)) return null;
  if (droppedImageUrlPattern.test(promptText) || droppedVideoUrlPattern.test(promptText)) {
    return null;
  }
  return promptText.slice(0, maxVoiceScriptCharacters);
};

const isPromptTextDrag = (transfer: DataTransfer): boolean => {
  const normalizedTypes = Array.from(transfer.types ?? [], (type) => type.toLowerCase());
  if (
    normalizedTypes.some(
      (type) =>
        type.includes("text") ||
        type.includes("plain") ||
        type.includes("prompt") ||
        type.includes("utf8")
    )
  ) {
    return true;
  }
  return Boolean(extractDroppedPromptText(transfer));
};

const buildVoiceChangerRequestSettings = (): {
  stability: number;
  similarity_boost: number;
  speed: number;
  use_speaker_boost: boolean;
} => ({
  stability: hardcodedVoiceGenerationDefaults.stability,
  similarity_boost: hardcodedVoiceGenerationDefaults.similarity_boost,
  speed: hardcodedVoiceGenerationDefaults.speed,
  use_speaker_boost: hardcodedVoiceChangerSpeakerBoostEnabled,
});

const buildVoiceDesignPreviewAudioSrc = (
  audioBase64: string,
  mediaType: string | null | undefined
): string => `data:${mediaType?.trim() || "audio/mpeg"};base64,${audioBase64}`;

const buildVoicePreviewInstanceKey = (voiceId: string): string => `voices:voice-preview:${voiceId}`;

const buildDesignedPreviewInstanceKey = (previewId: string): string =>
  `voices:designed-preview:${previewId}`;

const getVoiceChipDisplayName = (voiceName: string): string => {
  const trimmedName = voiceName.trim();
  if (!trimmedName) return "";
  return trimmedName.split(/\s*(?::|[—–-])\s*/u, 1)[0] ?? trimmedName;
};

type VoicesListResponse = {
  voices?: Array<{
    voiceId?: string;
    name?: string;
    previewUrl?: string | null;
    description?: string | null;
    isFallback?: boolean;
    librarySection?: "default" | "my";
    providerCategory?: string | null;
    providerVoiceType?: string | null;
    originKind?:
      | "fallback-default"
      | "provider-default"
      | "provider-saved"
      | "provider-user-created"
      | "legacy-saved";
    canRemoveFromLibrary?: boolean;
    canDeleteFromProvider?: boolean;
    destructiveAction?: "none" | "remove" | "delete";
    destructiveActionLabel?: "Remove" | "Delete" | null;
    destructiveActionDescription?: string | null;
    destructiveActionDisabledReason?: string | null;
  }>;
  source?: "api" | "fallback";
  warning?: string;
};

type VoiceDesignPreview = {
  generatedVoiceId: string;
  previewToken: string;
  audioBase64: string;
  mediaType: string | null;
  durationSecs: number | null;
  language: string | null;
};

type VoiceDesignResponse = {
  previews?: VoiceDesignPreview[];
  previewText?: string | null;
  modelId?: string;
  error?: string;
  details?: string;
};

type CreatedVoiceResponse = {
  voice?: {
    voiceId?: string;
    name?: string;
    previewUrl?: string | null;
    description?: string | null;
    isFallback?: boolean;
  };
  error?: string;
  details?: string;
};

type DeleteVoiceResponse = {
  status?: "ok";
  voiceId?: string;
  action?: "remove" | "delete";
  error?: string;
  details?: string;
};

export type VoicesGenerateRequest =
  | {
      mode: "voiceover";
      voice: SharedVoiceOption;
      script: string;
      outputFormat: string;
      config: ElevenVoiceoverRequestConfig;
      displayedBilledCredits?: number | null;
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
    };

export type VoicesPropertiesPanelProps = {
  balanceCredits?: number | null;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
  selectedTool?: ToolId | null;
  isGenerating?: boolean;
  onGenerate?: (request: VoicesGenerateRequest) => Promise<void> | void;
  onVoiceChangerSourceChange?: (source: VoiceChangerSource | null) => void;
  onVoicePromptChange?: (value: string) => void;
  onVoiceScriptChange?: (value: string) => void;
  onActiveVoiceChangerSourceVideoChange?: (source: ActiveVoiceChangerSourceVideo | null) => void;
  resolveVoiceChangerInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
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
  balanceCredits: _balanceCredits = null,
  pricingPolicy = null,
  pricingPolicyReady = true,
  selectedTool = null,
  onGenerate,
  onVoiceChangerSourceChange: onControlledVoiceChangerSourceChange,
  onVoicePromptChange: onControlledVoicePromptChange,
  onVoiceScriptChange: onControlledVoiceScriptChange,
  onActiveVoiceChangerSourceVideoChange,
  resolveVoiceChangerInternalReferenceSource,
  voiceChangerSource: controlledVoiceChangerSource,
  voicePrompt: controlledVoicePrompt,
  voiceScript: controlledVoiceScript,
}: VoicesPropertiesPanelProps) {
  const sessionSnapshot = useSupabaseSessionState();
  const sessionUserId = sessionSnapshot.user?.id ?? null;
  void _balanceCredits;
  const {
    voices: libraryVoices,
    selectedVoice: selectedLibraryVoice,
    setSelectedVoice: setSelectedLibraryVoice,
    replaceVoices,
    upsertVoice: upsertSharedVoice,
  } = useSharedVoicesGrid();
  const [surfaceMode, setSurfaceMode] = React.useState<VoicesSurfaceMode>(
    selectedTool === "voice-changer" ? "edit" : "create"
  );
  const [createVoiceMode, setCreateVoiceMode] = React.useState<CreateVoiceMode>("generate");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = React.useState(false);
  const [isVoicesLoading, setIsVoicesLoading] = React.useState(false);
  const [voicesLoadError, setVoicesLoadError] = React.useState<string | null>(null);
  const [voicesLoadNotice, setVoicesLoadNotice] = React.useState<string | null>(null);
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
  const [cloneVoiceSource, setCloneVoiceSource] = React.useState<VoiceChangerSource | null>(null);
  const [isCloneConsentChecked, setIsCloneConsentChecked] = React.useState(false);
  const [cloneVoiceError, setCloneVoiceError] = React.useState<string | null>(null);
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
  const [activePreviewVoiceId, setActivePreviewVoiceId] = React.useState<string | null>(null);
  const {
    voiceChangerSource: uncontrolledVoiceChangerSource,
    handleVoiceChangerSourceChange: handleUncontrolledVoiceChangerSourceChange,
  } = useVoiceChangerSourceController();
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
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewAudioVoiceIdRef = React.useRef<string | null>(null);
  const designedPreviewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const designedPreviewAudioIdRef = React.useRef<string | null>(null);
  const previousCloneVoiceSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const shouldFocusCreateControlsRef = React.useRef(false);
  const shouldRestoreVoicesLibraryTriggerFocusRef = React.useRef(false);
  const shouldRestoreCreateVoiceTriggerFocusRef = React.useRef(false);
  const createVoiceTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const cloneVoiceSourceRequestIdRef = React.useRef(0);
  const voiceChangerSource =
    controlledVoiceChangerSource !== undefined
      ? controlledVoiceChangerSource
      : uncontrolledVoiceChangerSource;
  const loadedVoiceCueTimeoutRef = React.useRef<number | null>(null);
  const requiresProviderVoice = Boolean(onGenerate);
  const isCreateVoiceModalOpen = isCreatePanelOpen;
  const isSelectedVoiceProviderReady =
    selectedLibraryVoice?.provider === "elevenlabs" && !selectedLibraryVoice?.isFallback;
  const normalizedVoicePromptLength = voicePrompt.trim().length;
  const estimatedCredits =
    surfaceMode === "create"
      ? (resolveClientBilledCredits({
          modelId: hardcodedVoiceoverModelId,
          params: {
            textCharacters: voiceScript.trim().length,
          },
          pricingPolicy,
          pricingPolicyReady,
        }) ?? null)
      : (resolveClientBilledCredits({
          modelId: hardcodedVoiceChangerModel,
          params: {
            sourceDurationSeconds:
              voiceChangerSource?.durationMs != null
                ? voiceChangerSource.durationMs / 1000
                : undefined,
          },
          pricingPolicy,
          pricingPolicyReady,
        }) ?? null);
  const isGenerateEnabled =
    Boolean(selectedLibraryVoice?.id) &&
    (!requiresProviderVoice || isSelectedVoiceProviderReady) &&
    (surfaceMode === "create"
      ? voiceScript.trim().length > 0
      : voiceChangerSource?.status === "ready");
  const isCreateVoiceEnabled =
    voiceName.trim().length > 0 &&
    normalizedVoicePromptLength >= minVoicePromptCharacters &&
    !isSavingDesignedVoice;
  const isSaveVoiceEnabled =
    voiceName.trim().length > 0 &&
    normalizedVoicePromptLength >= minVoicePromptCharacters &&
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
  }, [voicePrompt]);

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
      voicesLibraryTriggerRef.current?.focus();
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
      releaseVoiceChangerSource(previousCloneVoiceSourceRef.current);
      previousCloneVoiceSourceRef.current = null;
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
      setCloneVoiceSource(null);
      setIsCloneConsentChecked(false);
      setCloneVoiceError(null);
      setIsCloningVoice(false);
    },
    [setVoicePrompt, stopActiveDesignedPreview]
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

  const handleCloneVoiceSourceChange = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      const requestId = cloneVoiceSourceRequestIdRef.current + 1;
      cloneVoiceSourceRequestIdRef.current = requestId;
      setCloneVoiceError(null);

      if (!nextSource) {
        setCloneVoiceSource(null);
        return;
      }

      const resolveErrorMessage = (error: unknown): string => {
        if (error instanceof Error && error.message.trim()) return error.message.trim();
        return "Unable to prepare the selected voice sample.";
      };

      if (nextSource.kind !== "audio") {
        setCloneVoiceSource({
          ...nextSource,
          status: "failed",
          errorMessage: "Clone Voice accepts audio samples only.",
        });
        return;
      }

      const initialStatus = nextSource.file ? "uploading" : "ready";
      const initialSource: VoiceChangerSource = {
        ...nextSource,
        status: initialStatus,
        storagePath:
          nextSource.storagePath ?? resolveVoiceChangerSourceStoragePath(nextSource.sourceUrl),
        errorMessage: null,
        extractedFrom: null,
      };

      setCloneVoiceSource(initialSource);

      void (async () => {
        let stagedStoragePath = initialSource.storagePath;
        let stagedSourceUrl = initialSource.sourceUrl;
        let stagedMimeType = initialSource.mimeType;
        let stagedName = initialSource.name;
        let stagedDurationMs = initialSource.durationMs;

        try {
          if (initialSource.file) {
            const uploaded = await uploadVoiceCloneSourceFile({ file: initialSource.file });
            stagedStoragePath = uploaded.storagePath;
            stagedSourceUrl = uploaded.signedUrl ?? stagedSourceUrl;
            stagedMimeType = uploaded.mimeType;
            stagedName = uploaded.name;
          } else if (stagedStoragePath) {
            stagedSourceUrl = await signVoiceSourceStoragePath(stagedStoragePath);
          }

          if (cloneVoiceSourceRequestIdRef.current !== requestId) return;
          if (!stagedSourceUrl || !stagedStoragePath) {
            throw new Error("Unable to resolve the staged voice sample.");
          }

          stagedDurationMs =
            stagedDurationMs ??
            (await resolveVoiceChangerMediaDurationMs(stagedSourceUrl, "audio").catch(() => null));

          setCloneVoiceSource({
            ...initialSource,
            kind: "audio",
            status: "ready",
            aspect: null,
            durationMs: stagedDurationMs,
            name: stagedName,
            mimeType: stagedMimeType,
            file: null,
            previewUrl: null,
            sourceUrl: stagedSourceUrl,
            objectUrl: initialSource.objectUrl,
            storagePath: stagedStoragePath,
            errorMessage: null,
            extractedFrom: null,
          });
        } catch (error) {
          if (cloneVoiceSourceRequestIdRef.current !== requestId) return;
          setCloneVoiceSource({
            ...initialSource,
            status: "failed",
            file: null,
            sourceUrl: stagedSourceUrl,
            storagePath: stagedStoragePath,
            errorMessage: resolveErrorMessage(error),
          });
        }
      })();
    },
    []
  );

  React.useEffect(() => {
    const previousSource = previousCloneVoiceSourceRef.current;
    if (previousSource?.objectUrl && previousSource.objectUrl !== cloneVoiceSource?.objectUrl) {
      releaseVoiceChangerSource(previousSource);
    }
    previousCloneVoiceSourceRef.current = cloneVoiceSource;
  }, [cloneVoiceSource]);

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
      releaseVoiceChangerSource(previousCloneVoiceSourceRef.current);
      const previewAudio = previewAudioRef.current;
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = "";
      }
      const designedPreviewAudio = designedPreviewAudioRef.current;
      if (designedPreviewAudio) {
        designedPreviewAudio.pause();
        designedPreviewAudio.src = "";
      }
      if (previewAudioVoiceIdRef.current) {
        clearExclusiveSoundPlayback(buildVoicePreviewInstanceKey(previewAudioVoiceIdRef.current));
      }
      if (designedPreviewAudioIdRef.current) {
        clearExclusiveSoundPlayback(
          buildDesignedPreviewInstanceKey(designedPreviewAudioIdRef.current)
        );
      }
      previewAudioRef.current = null;
      previewAudioVoiceIdRef.current = null;
      designedPreviewAudioRef.current = null;
      designedPreviewAudioIdRef.current = null;
      cloneVoiceSourceRequestIdRef.current += 1;
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

  React.useEffect(() => {
    if (!onGenerate) {
      return;
    }
    let cancelled = false;
    const loadVoices = async () => {
      setIsVoicesLoading(true);
      setVoicesLoadError(null);
      setVoicesLoadNotice(null);
      resetSharedVoicesGridStore();
      try {
        const response = await fetchWithAuth("/api/elevenlabs/voices", {
          shortpulseLogScope: "generation",
        });
        const payload = (await response.json().catch(() => null)) as VoicesListResponse | null;
        if (!response.ok) {
          throw new Error("Unable to load voices.");
        }
        const nextVoices: SharedVoiceOption[] = (payload?.voices ?? []).flatMap((voice) => {
          const voiceId = voice.voiceId?.trim() ?? "";
          const name = voice.name?.trim() ?? "";
          if (!voiceId || !name) return [];
          const resolvedLibrarySection =
            voice.librarySection === "default"
              ? "default"
              : voice.librarySection === "my"
                ? "my"
                : voice.isFallback
                  ? "default"
                  : "my";
          const canRemoveFromLibrary =
            typeof voice.canRemoveFromLibrary === "boolean"
              ? voice.canRemoveFromLibrary
              : resolvedLibrarySection === "my";
          const canDeleteFromProvider = Boolean(voice.canDeleteFromProvider);
          const destructiveAction =
            voice.destructiveAction ??
            (canDeleteFromProvider ? "delete" : canRemoveFromLibrary ? "remove" : "none");
          const destructiveActionLabel =
            voice.destructiveActionLabel ??
            (destructiveAction === "delete"
              ? "Delete"
              : destructiveAction === "remove"
                ? "Remove"
                : null);
          const destructiveActionDisabledReason =
            voice.destructiveActionDisabledReason?.trim() ||
            (destructiveAction === "none" && voice.isFallback
              ? "Built-in voices can't be deleted here."
              : destructiveAction === "none"
                ? "This voice can't be deleted here."
                : null);
          return [
            {
              id: voiceId,
              name: sanitizeCustomerFacingProviderText(name, "Voice"),
              previewUrl: voice.previewUrl?.trim() || null,
              description: sanitizeCustomerFacingProviderText(voice.description, "") || null,
              isFallback: Boolean(voice.isFallback),
              librarySection: resolvedLibrarySection,
              provider: "elevenlabs" as const,
              providerCategory: voice.providerCategory?.trim().toLowerCase() || null,
              providerVoiceType: voice.providerVoiceType?.trim().toLowerCase() || null,
              originKind:
                voice.originKind ?? (voice.isFallback ? "fallback-default" : "legacy-saved"),
              canRemoveFromLibrary,
              canDeleteFromProvider,
              destructiveAction,
              destructiveActionLabel,
              destructiveActionDescription:
                sanitizeCustomerFacingProviderText(voice.destructiveActionDescription, "") || null,
              destructiveActionDisabledReason:
                sanitizeCustomerFacingProviderText(destructiveActionDisabledReason, "") || null,
            },
          ];
        });
        if (!cancelled) {
          if (nextVoices.length > 0) {
            replaceVoices(nextVoices);
          }
          setVoicesLoadNotice(sanitizeCustomerFacingProviderText(payload?.warning, "") || null);
        }
      } catch (error) {
        if (!cancelled) {
          resetSharedVoicesGridStore();
          setVoicesLoadError(
            sanitizeCustomerFacingProviderText(
              error instanceof Error ? error.message : null,
              "Unable to load voices."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setIsVoicesLoading(false);
        }
      }
    };

    void loadVoices();
    return () => {
      cancelled = true;
    };
  }, [onGenerate, replaceVoices]);

  const handleSurfaceModeChange = React.useCallback((nextMode: VoicesSurfaceMode) => {
    setSurfaceMode(nextMode);
    if (nextMode !== "create") {
      setIsCreatePanelOpen(false);
    }
  }, []);

  const handleCreateVoiceModeChange = React.useCallback((nextMode: CreateVoiceMode) => {
    setCreateVoiceMode(nextMode);
    setVoiceDesignError(null);
    setSaveVoiceError(null);
    setCloneVoiceError(null);
  }, []);

  const handleCreateVoicePreviewGeneration = React.useCallback(async () => {
    const nextVoiceName = voiceName.trim();
    const nextVoiceDescription = voicePrompt.trim();
    if (!nextVoiceName || nextVoiceDescription.length < minVoicePromptCharacters) {
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
      const response = await fetchWithAuth("/api/elevenlabs/text-to-voice/design", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: nextVoiceName,
          voiceDescription: nextVoiceDescription,
        }),
        shortpulseLogScope: "generation",
      });
      const payload = (await response.json().catch(() => null)) as VoiceDesignResponse | null;
      if (!response.ok) {
        throw new Error(
          sanitizeCustomerFacingProviderText(
            payload?.details || payload?.error,
            "Unable to generate voice previews."
          )
        );
      }

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
  }, [stopActiveDesignedPreview, voiceName, voicePrompt]);

  const handleVoicePromptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setVoicePrompt(droppedPromptText);
  };

  const handleVoiceScriptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setVoiceScript(droppedPromptText);
  };

  const handleVoicePromptDragOver = (event: React.DragEvent<HTMLTextAreaElement>) => {
    if (!isPromptTextDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
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

  const handleOpenVoicesLibraryModal = React.useCallback(() => {
    shouldRestoreVoicesLibraryTriggerFocusRef.current = true;
    setActiveVoicesLibrarySection("my");
    setVoicesLoadNotice((current) => (isTransientVoicePreviewNotice(current) ? null : current));
    setIsVoicesLibraryModalOpen(true);
  }, []);

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

  const stopActiveVoicePreview = React.useCallback(() => {
    const activeAudio = previewAudioRef.current;
    const activeInstanceKey = previewAudioVoiceIdRef.current
      ? buildVoicePreviewInstanceKey(previewAudioVoiceIdRef.current)
      : null;
    if (!activeAudio) {
      if (activeInstanceKey) {
        clearExclusiveSoundPlayback(activeInstanceKey);
      }
      setActivePreviewVoiceId(null);
      previewAudioVoiceIdRef.current = null;
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
    previewAudioRef.current = null;
    previewAudioVoiceIdRef.current = null;
    setActivePreviewVoiceId(null);
  }, []);

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
  }, [resetCreateVoiceModalState, sessionUserId, stopActiveVoicePreview]);

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

  const handleVoicePreviewPlay = React.useCallback(
    (voiceId: string, previewUrl: string | null | undefined) => {
      const nextUrl = previewUrl?.trim() ?? "";
      if (!nextUrl) {
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewUnavailableNotice);
        return;
      }
      if (typeof Audio === "undefined") {
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewBrowserUnavailableNotice);
        return;
      }
      setVoicesLoadError(null);
      setVoicesLoadNotice(null);
      const activeAudio = previewAudioRef.current;
      const isSameVoice = previewAudioVoiceIdRef.current === voiceId;
      if (activeAudio && isSameVoice) {
        stopActiveVoicePreview();
        return;
      }

      if (activeAudio) {
        stopActiveVoicePreview();
      }

      const nextAudio = new Audio(nextUrl);
      const nextInstanceKey = buildVoicePreviewInstanceKey(voiceId);
      nextAudio.preload = "none";
      nextAudio.onplay = () => {
        if (previewAudioRef.current !== nextAudio) return;
        markExclusiveSoundPlaying({
          instanceKey: nextInstanceKey,
          pause: () => {
            nextAudio.pause();
          },
        });
        setActivePreviewVoiceId(voiceId);
      };
      nextAudio.onpause = () => {
        if (previewAudioRef.current !== nextAudio) return;
        if (nextAudio.ended || nextAudio.currentTime <= 0) {
          stopActiveVoicePreview();
        }
      };
      nextAudio.onended = () => {
        if (previewAudioRef.current !== nextAudio) return;
        stopActiveVoicePreview();
      };
      nextAudio.onerror = () => {
        if (previewAudioRef.current !== nextAudio) return;
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewPlaybackErrorNotice);
        stopActiveVoicePreview();
      };
      previewAudioRef.current = nextAudio;
      previewAudioVoiceIdRef.current = voiceId;
      requestExclusiveSoundPlayback({
        instanceKey: nextInstanceKey,
        pause: () => {
          nextAudio.pause();
        },
      });
      const playResult = nextAudio.play();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch(() => {
          if (previewAudioRef.current === nextAudio) {
            setVoicesLoadError(null);
            setVoicesLoadNotice(voicePreviewPlaybackErrorNotice);
            stopActiveVoicePreview();
          }
        });
      }
    },
    [stopActiveVoicePreview]
  );

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
      !selectedVoiceDesignPreviewId
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
      const response = await fetchWithAuth("/api/elevenlabs/text-to-voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
        shortpulseLogScope: "generation",
      });
      const payload = (await response.json().catch(() => null)) as CreatedVoiceResponse | null;
      if (!response.ok) {
        throw new Error(
          sanitizeCustomerFacingProviderText(
            payload?.details || payload?.error,
            "Unable to create voice."
          )
        );
      }

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
      const response = await fetchWithAuth("/api/elevenlabs/voices/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: nextVoiceName,
          sourceStoragePath,
          sourceName: cloneVoiceSource.name,
          removeBackgroundNoise: true,
        }),
        shortpulseLogScope: "generation",
      });
      const payload = (await response.json().catch(() => null)) as CreatedVoiceResponse | null;
      if (!response.ok) {
        throw new Error(
          sanitizeCustomerFacingProviderText(
            payload?.details || payload?.error,
            "Unable to clone voice."
          )
        );
      }

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
  }, [selectedLibraryVoice]);

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
      const response = await fetchWithAuth(
        `/api/elevenlabs/voices/${encodeURIComponent(pendingDeleteVoice.id)}`,
        {
          method: "DELETE",
          shortpulseLogScope: "generation",
        }
      );
      const payload = (await response.json().catch(() => null)) as DeleteVoiceResponse | null;
      if (!response.ok) {
        throw new Error(
          sanitizeCustomerFacingProviderText(
            payload?.details || payload?.error,
            "Unable to delete voice."
          )
        );
      }

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
      if (!voiceScript.trim()) return;
      void onGenerate({
        mode: "voiceover",
        voice: selectedLibraryVoice,
        script: voiceScript.trim(),
        outputFormat: hardcodedVoiceOutputFormat,
        config: buildVoiceoverElevenV3RequestConfig(),
        displayedBilledCredits: estimatedCredits,
      });
      return;
    }
    if (!voiceChangerSource) return;
    void onGenerate({
      mode: "voice-changer",
      voice: selectedLibraryVoice,
      source: voiceChangerSource,
      outputFormat: hardcodedVoiceOutputFormat,
      removeBackgroundNoise: hardcodedVoiceChangerNoiseReductionEnabled,
      modelId: hardcodedVoiceChangerModel,
      inputFormat: hardcodedVoiceChangerInputFormat,
      displayedBilledCredits: estimatedCredits,
      voiceSettings: buildVoiceChangerRequestSettings(),
    });
  }, [
    onGenerate,
    selectedLibraryVoice,
    surfaceMode,
    estimatedCredits,
    voiceChangerSource,
    voiceScript,
  ]);

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
    <section className="voices-properties-panel tool-properties" aria-label="Voices properties">
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
                  <textarea
                    ref={voiceScriptRef}
                    className="voices-properties-script-input"
                    value={voiceScript}
                    onChange={(event) => setVoiceScript(event.target.value)}
                    onDrop={handleVoiceScriptDrop}
                    onDragOver={handleVoicePromptDragOver}
                    maxLength={maxVoiceScriptCharacters}
                    placeholder={voiceScriptPlaceholder}
                    aria-label="Voice script"
                  />
                  <div className="voices-properties-script-meta-row">
                    <p className="voices-properties-script-count" aria-live="polite">
                      {`${voiceScript.length.toLocaleString()} / ${maxVoiceScriptCharacters.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              ) : (
                <VoiceChangerSourceDropzone
                  source={voiceChangerSource}
                  onSourceChange={handleVoiceChangerSourceChange}
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
                    onClick={handleOpenVoicesLibraryModal}
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
                    <span className="voices-properties-generate-context-copy">
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
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="voices-properties-generate-btn"
                  disabled={!isGenerateEnabled}
                  aria-label="Generate"
                  onClick={handleGenerate}
                >
                  <span className="voices-properties-generate-label">Generate</span>
                  <span className="voices-properties-generate-pill" aria-hidden="true">
                    <span className="voices-properties-generate-cost-icon">✦</span>
                    <span className="voices-properties-generate-cost-value">
                      {estimatedCredits != null ? formatCreditValue(estimatedCredits) : "—"}
                      <span className="voices-properties-generate-cost-label">credits</span>
                    </span>
                  </span>
                </button>
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
            maxVoicePromptCharacters={maxVoicePromptCharacters}
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
            onVoicePromptDragOver={handleVoicePromptDragOver}
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
