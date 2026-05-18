/**
 * Voices properties panel for AI Studio.
 * Keeps the Voices workflow visually aligned with the TTS layout while remaining fully isolated.
 */
import React from "react";
import { Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import {
  resolveRequiredAudioVoiceChangerModelId,
  resolveRequiredAudioVoiceDesignModelId,
  resolveRequiredAudioVoiceoverModelId,
} from "../../../lib/model-runtime/modelCatalog";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useSharedVoicesGrid, type SharedVoiceOption } from "../hooks/useSharedVoicesGrid";
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
  extractVoiceChangerVideoSource,
  resolveVoiceChangerMediaDurationMs,
  resolveVoiceChangerVideoAspect,
  resolveVoiceChangerSourceStoragePath,
  signVoiceSourceStoragePath,
  signVoiceChangerStoragePath,
  uploadVoiceCloneSourceFile,
  uploadVoiceChangerSourceFile,
} from "../utils/voiceChangerSourceAsset";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "./shared/exclusiveSoundPlayback";

type VoicesSurfaceMode = "create" | "edit";
type CreateVoiceMode = "generate" | "clone";

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

const voiceDescriptionPlaceholder =
  "Describe the voice you want to create: tone, age, and delivery.";
const voiceScriptPlaceholder = "Paste or write the script that will be spoken with this voice.";
const createVoiceDefaultName = "";

const maxVoicePromptCharacters = 1000;
const minVoicePromptCharacters = 20;
const minCloneVoiceSourceDurationMs = 60_000;
const cloneVoiceSourceDurationErrorMessage = "Voice clone source must be at least 1 minute long.";
const maxVoiceScriptCharacters = 5000;
const voiceLoadingSkeletonCount = 12;
const maxVoicePromptHeightPx = 264;
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
  stability: 0.5,
  similarity_boost: 0.75,
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
  }>;
  source?: "api" | "fallback";
  warning?: string;
};

type VoiceDesignPreview = {
  generatedVoiceId: string;
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
  onActiveVoiceChangerSourceVideoChange?: (source: ActiveVoiceChangerSourceVideo | null) => void;
  resolveVoiceChangerInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
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
  onActiveVoiceChangerSourceVideoChange,
  resolveVoiceChangerInternalReferenceSource,
}: VoicesPropertiesPanelProps) {
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
  const [voicePrompt, setVoicePrompt] = React.useState("");
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
  const [activeDesignedPreviewId, setActiveDesignedPreviewId] = React.useState<string | null>(null);
  const [voiceScript, setVoiceScript] = React.useState("");
  const [activePreviewVoiceId, setActivePreviewVoiceId] = React.useState<string | null>(null);
  const [voiceChangerSource, setVoiceChangerSource] = React.useState<VoiceChangerSource | null>(
    null
  );

  const voiceNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const voicePromptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const voiceScriptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const voicesLibraryTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewAudioVoiceIdRef = React.useRef<string | null>(null);
  const designedPreviewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const designedPreviewAudioIdRef = React.useRef<string | null>(null);
  const previousVoiceChangerSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const previousCloneVoiceSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const shouldFocusCreateControlsRef = React.useRef(false);
  const shouldRestoreVoicesLibraryTriggerFocusRef = React.useRef(false);
  const voiceChangerSourceRequestIdRef = React.useRef(0);
  const cloneVoiceSourceRequestIdRef = React.useRef(0);
  const requiresProviderVoice = Boolean(onGenerate);
  const isCreateVoiceModalOpen = isCreatePanelOpen && surfaceMode === "create";
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
  const cloneVoiceSourceDurationError =
    createVoiceMode === "clone" &&
    cloneVoiceSource?.status === "ready" &&
    cloneVoiceSource.durationMs != null &&
    cloneVoiceSource.durationMs < minCloneVoiceSourceDurationMs
      ? cloneVoiceSourceDurationErrorMessage
      : null;
  const isCloneVoiceEnabled =
    createVoiceMode === "clone" &&
    voiceName.trim().length > 0 &&
    cloneVoiceSource?.status === "ready" &&
    Boolean(cloneVoiceSource.storagePath) &&
    !cloneVoiceSourceDurationError &&
    isCloneConsentChecked &&
    !isCloningVoice;
  const canDeleteSelectedVoice =
    selectedLibraryVoice?.provider === "elevenlabs" && !selectedLibraryVoice?.isFallback;
  const selectedGenerateVoiceName = selectedLibraryVoice
    ? getVoiceChipDisplayName(selectedLibraryVoice.name)
    : "Select a voice";

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

  const resetCreateVoiceModalState = React.useCallback(() => {
    stopActiveDesignedPreview();
    releaseVoiceChangerSource(previousCloneVoiceSourceRef.current);
    previousCloneVoiceSourceRef.current = null;
    setVoiceName(createVoiceDefaultName);
    setVoicePrompt("");
    setCreateVoiceMode("generate");
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
  }, [stopActiveDesignedPreview]);

  const handleVoiceChangerSourceChange = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      const requestId = voiceChangerSourceRequestIdRef.current + 1;
      voiceChangerSourceRequestIdRef.current = requestId;

      if (!nextSource) {
        setVoiceChangerSource(null);
        return;
      }

      const resolveErrorMessage = (error: unknown, fallback: string): string => {
        if (error instanceof Error && error.message.trim()) return error.message.trim();
        return fallback;
      };

      const initialStatus =
        nextSource.kind === "video"
          ? nextSource.file
            ? "uploading"
            : "extracting"
          : nextSource.file
            ? "uploading"
            : "ready";
      const initialSource: VoiceChangerSource = {
        ...nextSource,
        status: initialStatus,
        storagePath:
          nextSource.storagePath ?? resolveVoiceChangerSourceStoragePath(nextSource.sourceUrl),
        durationMs: nextSource.durationMs,
        errorMessage: null,
        extractedFrom: null,
      };

      setVoiceChangerSource(initialSource);

      void (async () => {
        let stagedStoragePath = initialSource.storagePath;
        let stagedSourceUrl = initialSource.sourceUrl;
        let stagedMimeType = initialSource.mimeType;
        let stagedName = initialSource.name;
        const stagedAspect = initialSource.aspect;
        let stagedDurationMs = initialSource.durationMs;

        try {
          if (initialSource.file) {
            const uploaded = await uploadVoiceChangerSourceFile({
              file: initialSource.file,
              kind: initialSource.kind,
            });
            stagedStoragePath = uploaded.storagePath;
            stagedSourceUrl = uploaded.signedUrl ?? stagedSourceUrl;
            stagedMimeType = uploaded.mimeType;
            stagedName = uploaded.name;
          } else if (stagedStoragePath) {
            stagedSourceUrl = await signVoiceChangerStoragePath(stagedStoragePath);
          }

          if (voiceChangerSourceRequestIdRef.current !== requestId) return;

          if (initialSource.kind === "audio") {
            if (!stagedSourceUrl) {
              throw new Error("Unable to resolve the staged audio source URL.");
            }

            stagedDurationMs =
              stagedDurationMs ??
              (await resolveVoiceChangerMediaDurationMs(stagedSourceUrl, "audio").catch(
                () => null
              ));

            setVoiceChangerSource({
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
            return;
          }

          setVoiceChangerSource((current) => {
            if (!current || voiceChangerSourceRequestIdRef.current !== requestId) return current;
            return {
              ...current,
              status: "extracting",
              aspect: stagedAspect,
              name: stagedName,
              mimeType: stagedMimeType,
              file: null,
              sourceUrl: stagedSourceUrl,
              storagePath: stagedStoragePath,
              errorMessage: null,
            };
          });

          const aspectResolutionPromise = (
            stagedAspect
              ? Promise.resolve(stagedAspect)
              : resolveVoiceChangerVideoAspect(initialSource.previewUrl ?? stagedSourceUrl)
          ).catch(() => null);
          const durationResolutionPromise = resolveVoiceChangerMediaDurationMs(
            initialSource.previewUrl ?? stagedSourceUrl,
            "video"
          ).catch(() => null);

          const extracted = await extractVoiceChangerVideoSource({
            sourceName: stagedName,
            sourceOrigin: initialSource.origin,
            sourceMimeType: stagedMimeType,
            sourceStoragePath: stagedStoragePath,
            sourceUrl: stagedSourceUrl,
          });

          if (voiceChangerSourceRequestIdRef.current !== requestId) return;

          setVoiceChangerSource({
            ...initialSource,
            kind: "audio",
            status: "ready",
            aspect: null,
            durationMs: await durationResolutionPromise,
            name: extracted.name,
            mimeType: extracted.mimeType,
            file: null,
            previewUrl: null,
            sourceUrl: extracted.signedUrl,
            objectUrl: null,
            storagePath: extracted.storagePath,
            errorMessage: null,
            extractedFrom: {
              kind: "video",
              name: stagedName,
              mimeType: stagedMimeType,
              previewUrl: initialSource.previewUrl ?? stagedSourceUrl,
              sourceUrl: stagedSourceUrl,
              storagePath: stagedStoragePath,
              aspect: stagedAspect,
              referenceOutputId: initialSource.referenceOutputId,
              referenceMediaId: initialSource.referenceMediaId,
            },
          });

          void aspectResolutionPromise.then((resolvedAspect) => {
            if (!resolvedAspect || voiceChangerSourceRequestIdRef.current !== requestId) return;
            setVoiceChangerSource((current) => {
              if (
                !current ||
                current.id !== initialSource.id ||
                current.status !== "ready" ||
                !current.extractedFrom
              ) {
                return current;
              }
              if (current.extractedFrom.aspect === resolvedAspect) {
                return current;
              }
              return {
                ...current,
                extractedFrom: {
                  ...current.extractedFrom,
                  aspect: resolvedAspect,
                },
              };
            });
          });
        } catch (error) {
          if (voiceChangerSourceRequestIdRef.current !== requestId) return;
          setVoiceChangerSource({
            ...initialSource,
            status: "failed",
            aspect: stagedAspect,
            file: null,
            sourceUrl: stagedSourceUrl,
            storagePath: stagedStoragePath,
            errorMessage: resolveErrorMessage(
              error,
              initialSource.kind === "video"
                ? "Unable to prepare the selected video."
                : "Unable to prepare the selected audio."
            ),
          });
        }
      })();
    },
    []
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
    const previousSource = previousVoiceChangerSourceRef.current;
    if (previousSource?.objectUrl && previousSource.objectUrl !== voiceChangerSource?.objectUrl) {
      releaseVoiceChangerSource(previousSource);
    }
    previousVoiceChangerSourceRef.current = voiceChangerSource;
  }, [voiceChangerSource]);

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
      releaseVoiceChangerSource(previousVoiceChangerSourceRef.current);
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
      voiceChangerSourceRequestIdRef.current += 1;
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
          return [
            {
              id: voiceId,
              name,
              previewUrl: voice.previewUrl?.trim() || null,
              description: voice.description?.trim() || null,
              isFallback: Boolean(voice.isFallback),
              provider: "elevenlabs" as const,
            },
          ];
        });
        if (!cancelled) {
          if (nextVoices.length > 0) {
            replaceVoices(nextVoices);
          }
          setVoicesLoadNotice(payload?.warning?.trim() || null);
        }
      } catch (error) {
        if (!cancelled) {
          setVoicesLoadError(error instanceof Error ? error.message : "Unable to load voices.");
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
        throw new Error(payload?.details || payload?.error || "Unable to generate voice previews.");
      }

      const nextPreviews = (payload?.previews ?? []).map((preview) => ({
        ...preview,
        audioSrc: buildVoiceDesignPreviewAudioSrc(preview.audioBase64, preview.mediaType),
      }));

      if (nextPreviews.length === 0) {
        throw new Error("ElevenLabs did not return any voice previews.");
      }

      setVoiceDesignPreviews(nextPreviews);
      setVoiceDesignPreviewText(payload?.previewText?.trim() || null);
      setSelectedVoiceDesignPreviewId(nextPreviews[0]?.generatedVoiceId ?? null);
    } catch (error) {
      setVoiceDesignPreviews([]);
      setVoiceDesignPreviewText(null);
      setSelectedVoiceDesignPreviewId(null);
      setVoiceDesignError(
        error instanceof Error ? error.message : "Unable to generate voice previews."
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

  const handleCreateVoiceEntry = React.useCallback(() => {
    shouldFocusCreateControlsRef.current = true;
    shouldRestoreVoicesLibraryTriggerFocusRef.current = false;
    setIsVoicesLibraryModalOpen(false);
    handleSurfaceModeChange("create");
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(true);
  }, [handleSurfaceModeChange, resetCreateVoiceModalState]);

  const handleCloseCreatePanel = React.useCallback(() => {
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(false);
  }, [resetCreateVoiceModalState]);

  useAiStudioModalActivity("voices-create-modal", isCreateVoiceModalOpen);

  const handleOpenVoicesLibraryModal = React.useCallback(() => {
    shouldRestoreVoicesLibraryTriggerFocusRef.current = true;
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
      if (!nextUrl || typeof Audio === "undefined") return;
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
      const response = await fetchWithAuth("/api/elevenlabs/text-to-voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: nextVoiceName,
          voiceDescription: nextVoiceDescription,
          generatedVoiceId: selectedVoiceDesignPreviewId,
          playedNotSelectedVoiceIds: playedVoiceDesignPreviewIds.filter(
            (previewId) => previewId !== selectedVoiceDesignPreviewId
          ),
        }),
        shortpulseLogScope: "generation",
      });
      const payload = (await response.json().catch(() => null)) as CreatedVoiceResponse | null;
      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Unable to create voice.");
      }

      const createdVoiceId = payload?.voice?.voiceId?.trim() ?? "";
      const createdVoiceName = payload?.voice?.name?.trim() ?? "";
      if (!createdVoiceId || !createdVoiceName) {
        throw new Error("ElevenLabs returned an invalid created voice.");
      }

      upsertSharedVoice({
        id: createdVoiceId,
        name: createdVoiceName,
        previewUrl: payload?.voice?.previewUrl?.trim() || null,
        description: payload?.voice?.description?.trim() || nextVoiceDescription,
        isFallback: false,
        provider: "elevenlabs",
      });
      resetCreateVoiceModalState();
      setIsCreatePanelOpen(false);
    } catch (error) {
      setSaveVoiceError(error instanceof Error ? error.message : "Unable to create voice.");
    } finally {
      setIsSavingDesignedVoice(false);
    }
  }, [
    resetCreateVoiceModalState,
    playedVoiceDesignPreviewIds,
    selectedVoiceDesignPreviewId,
    upsertSharedVoice,
    voiceName,
    voicePrompt,
  ]);

  const handleCloneVoice = React.useCallback(async () => {
    const nextVoiceName = voiceName.trim();
    const nextVoiceDescription = voicePrompt.trim();
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
          voiceDescription: nextVoiceDescription || null,
          sourceStoragePath,
          sourceName: cloneVoiceSource.name,
          removeBackgroundNoise: true,
        }),
        shortpulseLogScope: "generation",
      });
      const payload = (await response.json().catch(() => null)) as CreatedVoiceResponse | null;
      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Unable to clone voice.");
      }

      const clonedVoiceId = payload?.voice?.voiceId?.trim() ?? "";
      const clonedVoiceName = payload?.voice?.name?.trim() ?? "";
      if (!clonedVoiceId || !clonedVoiceName) {
        throw new Error("ElevenLabs returned an invalid cloned voice.");
      }

      upsertSharedVoice({
        id: clonedVoiceId,
        name: clonedVoiceName,
        previewUrl: payload?.voice?.previewUrl?.trim() || null,
        description: payload?.voice?.description?.trim() || nextVoiceDescription || null,
        isFallback: false,
        provider: "elevenlabs",
      });
      resetCreateVoiceModalState();
      setIsCreatePanelOpen(false);
    } catch (error) {
      setCloneVoiceError(error instanceof Error ? error.message : "Unable to clone voice.");
    } finally {
      setIsCloningVoice(false);
    }
  }, [
    cloneVoiceSource,
    isCloneConsentChecked,
    resetCreateVoiceModalState,
    upsertSharedVoice,
    voiceName,
    voicePrompt,
  ]);

  const handleDeleteSelectedVoice = React.useCallback(() => {
    if (!selectedLibraryVoice) {
      return;
    }

    if (!canDeleteSelectedVoice) {
      setVoicesLoadError("This voice cannot be deleted.");
      return;
    }

    shouldRestoreVoicesLibraryTriggerFocusRef.current = false;
    setIsVoicesLibraryModalOpen(false);
    setPendingDeleteVoice(selectedLibraryVoice);
  }, [canDeleteSelectedVoice, selectedLibraryVoice]);

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
        throw new Error(payload?.details || payload?.error || "Unable to delete voice.");
      }

      if (activePreviewVoiceId === pendingDeleteVoice.id) {
        stopActiveVoicePreview();
      }

      replaceVoices(libraryVoices.filter((voice) => voice.id !== pendingDeleteVoice.id));
      setPendingDeleteVoice(null);
    } catch (error) {
      setVoicesLoadError(error instanceof Error ? error.message : "Unable to delete voice.");
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

  return (
    <section className="voices-properties-panel tool-properties" aria-label="Voices properties">
      <div className="voices-properties-shell">
        <div className="voices-properties-column-shell">
          <div className="voices-properties-main">
            <div className="voices-properties-panel-header">
              <h2 className="panel-title voices-properties-library-title">Voices</h2>
              <div className="voices-properties-library-actions">
                <button
                  ref={voicesLibraryTriggerRef}
                  type="button"
                  className="voices-properties-library-open-btn"
                  aria-label="Voices"
                  onClick={handleOpenVoicesLibraryModal}
                >
                  <span>Voices</span>
                </button>
                {selectedLibraryVoice ? (
                  <button
                    type="button"
                    className="voices-properties-library-delete-btn"
                    onClick={handleDeleteSelectedVoice}
                    aria-label="Delete Voice"
                    disabled={!canDeleteSelectedVoice || isDeletingSelectedVoice}
                    title={canDeleteSelectedVoice ? undefined : "Default voices cannot be deleted."}
                  >
                    <Trash size={14} weight="bold" aria-hidden="true" />
                    <span>{isDeletingSelectedVoice ? "Deleting Voice…" : "Delete Voice"}</span>
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
              </div>
            </div>

            <div className="voices-properties-compose-area">
              <div className="voices-properties-compose-mode-switcher">
                <div className="voices-properties-mode-switcher">
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
                {surfaceMode === "create" ? (
                  <p className="voices-properties-script-count" aria-live="polite">
                    {`${voiceScript.length.toLocaleString()} / ${maxVoiceScriptCharacters.toLocaleString()}`}
                  </p>
                ) : null}
                <div className="voices-properties-generate-context is-align-end" aria-live="polite">
                  <span className="voices-properties-generate-context-label">Selected voice</span>
                  <span className="voices-properties-generate-context-value">
                    {selectedGenerateVoiceName}
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
            </div>
          </div>
        </div>
      </div>
      <VoicesLibraryModal
        isOpen={isVoicesLibraryModalOpen}
        onClose={handleCloseVoicesLibraryModal}
        title="Voices"
        subtitle="Choose the voice used for voiceover and voice changer output."
      >
        <section className="voices-library-modal-content" aria-label="Available voices">
          <VoiceLibraryContent
            libraryVoices={libraryVoices}
            selectedLibraryVoice={selectedLibraryVoice}
            activePreviewVoiceId={activePreviewVoiceId}
            isVoicesLoading={isVoicesLoading}
            voicesLoadError={voicesLoadError}
            voicesLoadNotice={voicesLoadNotice}
            voiceLoadingSkeletonCount={voiceLoadingSkeletonCount}
            getVoiceChipDisplayName={getVoiceChipDisplayName}
            onSelectVoice={setSelectedLibraryVoice}
            onPreviewVoice={handleVoicePreviewPlay}
          />
        </section>
      </VoicesLibraryModal>
      {pendingDeleteVoice ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Delete this voice?"
            body={
              <p>
                <strong>
                  {getVoiceChipDisplayName(pendingDeleteVoice.name) || pendingDeleteVoice.name}
                </strong>{" "}
                will be removed permanently.
              </p>
            }
            confirmLabel="Delete"
            confirmBusyLabel={isDeletingSelectedVoice ? "Deleting..." : undefined}
            confirmDisabled={isDeletingSelectedVoice}
            cancelDisabled={isDeletingSelectedVoice}
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
            voiceDescriptionPlaceholder={voiceDescriptionPlaceholder}
            isCreateVoiceEnabled={isCreateVoiceEnabled}
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
            cloneVoiceError={cloneVoiceSourceDurationError ?? cloneVoiceError}
            onClose={handleCloseCreatePanel}
            onCreateModeChange={handleCreateVoiceModeChange}
            onVoiceNameChange={setVoiceName}
            onVoicePromptChange={setVoicePrompt}
            onCloneConsentChange={setIsCloneConsentChecked}
            onVoicePromptDrop={handleVoicePromptDrop}
            onVoicePromptDragOver={handleVoicePromptDragOver}
            onGenerateVoicePreviews={() => {
              void handleCreateVoicePreviewGeneration();
            }}
            onSaveVoice={() => {
              void handleSaveDesignedVoice();
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
