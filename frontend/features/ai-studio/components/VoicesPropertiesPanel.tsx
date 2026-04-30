/**
 * Voices properties panel for AI Studio.
 * Keeps the Voices workflow visually aligned with the TTS layout while remaining fully isolated.
 */
import React from "react";
import { Microphone, Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import {
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  ELEVENLABS_VOICE_DESIGN_MODEL_ID,
} from "../../../lib/model-runtime/elevenLabsModels";
import { computeCostForModel } from "../../../lib/model-runtime/pricing";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useSharedVoicesGrid, type SharedVoiceOption } from "../hooks/useSharedVoicesGrid";
import type { ToolId } from "../types";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import { CreateVoiceModal, type CreateVoiceModalPreview } from "./CreateVoiceModal";
import {
  releaseVoiceChangerSource,
  VoiceChangerSourceDropzone,
  type ResolveVoiceChangerInternalReferenceSource,
  type VoiceChangerSource,
} from "./VoiceChangerSourceDropzone";
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

type VoicesSurfaceMode = "create" | "edit";
type CreateVoiceMode = "generate" | "clone";
type VoicesSliderTheme = "voiceover" | "voice-changer";

type VoicesSliderProps = {
  label: string;
  helper: string;
  value: number;
  displayValue: string;
  onChange: (nextValue: number) => void;
  theme: VoicesSliderTheme;
  isModeTransitioning: boolean;
};

type VoicesSliderDefinition = {
  id: string;
  label: string;
  helper: string;
  defaultValue: number;
  formatValue: (value: number) => string;
};

type VoiceoverSliderValues = {
  speed?: number;
  stability?: number;
  similarityBoost?: number;
};

type ElevenVoiceoverRequestConfig = {
  model_id: typeof ELEVENLABS_VOICEOVER_MODEL_ID;
  language_code: null;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    speed: number;
    style: 0;
  };
};

const voiceDescriptionPlaceholder =
  "Describe the voice you want to create: tone, age, and delivery.";
const voiceScriptPlaceholder = "Paste or write the script that will be spoken with this voice.";
const createVoiceDefaultName = "";

const maxVoicePromptCharacters = 1000;
const minVoicePromptCharacters = 20;
const maxVoiceScriptCharacters = 5000;
const voiceLoadingSkeletonCount = 12;
const minTopVoicesPaneHeightPx = 0;
const minBottomComposePaneHeightPx = 480;
const maxVoicePromptHeightPx = 264;
const minVisibleVoicesPaneHeightPx = 76;
const minBottomVoiceChangerPaneHeightPx = 520;
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
export const hardcodedVoiceoverModelId = ELEVENLABS_VOICEOVER_MODEL_ID;
export const hardcodedVoiceoverLanguageCode = null;
export const hardcodedVoiceoverStyleValue = 0 as const;
export const hardcodedVoiceDesignModelId = ELEVENLABS_VOICE_DESIGN_MODEL_ID;

const normalizeSliderValue = (value: number | undefined, fallback: number): number =>
  Number(((value ?? fallback) / 100).toFixed(2));

export const buildVoiceoverElevenV3RequestConfig = (
  sliderValues: VoiceoverSliderValues
): ElevenVoiceoverRequestConfig => ({
  model_id: hardcodedVoiceoverModelId,
  language_code: hardcodedVoiceoverLanguageCode,
  voice_settings: {
    stability: normalizeSliderValue(sliderValues.stability, 50),
    similarity_boost: normalizeSliderValue(sliderValues.similarityBoost, 75),
    speed: Number((0.5 + (sliderValues.speed ?? 50) / 100).toFixed(2)),
    style: hardcodedVoiceoverStyleValue,
  },
});

const voiceoverShapingSliders = [
  {
    id: "speed",
    label: "Speed",
    helper: "Controls the playback speed for voice output.",
    defaultValue: 50,
    formatValue: (value: number) => `${(0.5 + value / 100).toFixed(2)}x`,
  },
  {
    id: "stability",
    label: "Stability",
    helper: "Lower values add more variation. Higher values keep the read steadier.",
    defaultValue: 50,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
  {
    id: "similarityBoost",
    label: "Similarity boost",
    helper: "Controls how closely the output stays matched to the selected voice.",
    defaultValue: 75,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
] satisfies readonly VoicesSliderDefinition[];

const voiceoverFormatOptions = [
  { value: "mp3_44100_128", label: "MP3" },
  { value: "wav_44100", label: "WAV" },
  { value: "pcm_24000", label: "PCM" },
] as const;

const voiceChangerShapingSliders = [
  {
    id: "speed",
    label: "Speed",
    helper: "Adjusts the pacing of the converted performance.",
    defaultValue: 64,
    formatValue: (value: number) => `${(value * 0.015).toFixed(2)}x`,
  },
  {
    id: "stability",
    label: "Stability",
    helper: "Higher values keep the conversion more even across takes.",
    defaultValue: 62,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
  {
    id: "similarityBoost",
    label: "Similarity boost",
    helper: "Pushes the result closer to the selected output voice.",
    defaultValue: 82,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
] satisfies readonly VoicesSliderDefinition[];

const voiceChangerOutputFormatOptions = [
  { value: "mp3_44100_128", label: "MP3" },
  { value: "wav_44100", label: "WAV" },
  { value: "pcm_24000", label: "PCM" },
] as const;

const hardcodedVoiceChangerModel = ELEVENLABS_VOICE_CHANGER_MODEL_ID;
const hardcodedVoiceChangerSpeakerBoostEnabled = true;
const hardcodedVoiceChangerInputFormat = "other";
const hardcodedVideoDerivedVoiceChangerSettings = {
  stability: 1,
  similarity_boost: 1,
  speed: 1,
  use_speaker_boost: true,
} as const;
const hardcodedVideoDerivedVoiceChangerSliderValues = {
  speed: 67,
  stability: 100,
  similarityBoost: 100,
} as const;
const sliderThemeTokens: Record<
  VoicesSliderTheme,
  {
    accentStart: string;
    accentEnd: string;
    accentGlow: string;
  }
> = {
  voiceover: {
    accentStart: "rgba(149, 235, 228, 0.98)",
    accentEnd: "rgba(105, 220, 203, 0.9)",
    accentGlow: "rgba(101, 216, 217, 0.22)",
  },
  "voice-changer": {
    accentStart: "rgba(255, 196, 142, 0.98)",
    accentEnd: "rgba(255, 170, 116, 0.95)",
    accentGlow: "rgba(255, 178, 126, 0.22)",
  },
};

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

const buildSliderState = (sliders: readonly VoicesSliderDefinition[]): Record<string, number> =>
  Object.fromEntries(sliders.map((slider) => [slider.id, slider.defaultValue]));

const buildVoiceChangerRequestSettings = ({
  source,
  sliderValues,
}: {
  source: VoiceChangerSource;
  sliderValues: Record<string, number>;
}): {
  stability: number;
  similarity_boost: number;
  speed: number;
  use_speaker_boost: boolean;
} => {
  if (source.extractedFrom) {
    return { ...hardcodedVideoDerivedVoiceChangerSettings };
  }
  return {
    stability: normalizeSliderValue(
      sliderValues.stability,
      voiceChangerShapingSliders[1]?.defaultValue ?? 62
    ),
    similarity_boost: normalizeSliderValue(
      sliderValues.similarityBoost,
      voiceChangerShapingSliders[2]?.defaultValue ?? 82
    ),
    speed: Number(
      ((sliderValues.speed ?? voiceChangerShapingSliders[0]?.defaultValue ?? 64) * 0.015).toFixed(2)
    ),
    use_speaker_boost: hardcodedVoiceChangerSpeakerBoostEnabled,
  };
};

const buildVoiceDesignPreviewAudioSrc = (
  audioBase64: string,
  mediaType: string | null | undefined
): string => `data:${mediaType?.trim() || "audio/mpeg"};base64,${audioBase64}`;

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
    };

export type VoicesPropertiesPanelProps = {
  balanceCredits?: number | null;
  pricingPolicy?: ModelPricingPolicyDocument | null;
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

function VoicesSlider({
  label,
  helper,
  value,
  displayValue,
  onChange,
  theme,
  isModeTransitioning,
}: VoicesSliderProps) {
  const themeTokens = sliderThemeTokens[theme];
  const handleValueInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      onChange(Number((event.target as HTMLInputElement).value));
    },
    [onChange]
  );
  return (
    <label className="voices-properties-mode-slider">
      <span className="voices-properties-mode-slider-label-row">
        <span className="voices-properties-mode-slider-label">{label}</span>
        <output className="voices-properties-mode-slider-value" aria-live="polite">
          {displayValue}
        </output>
      </span>
      <span
        className={`voices-properties-mode-slider-control${
          isModeTransitioning ? " is-mode-transitioning" : ""
        }`}
        style={
          {
            "--voices-slider-progress": `${value}%`,
            "--voices-slider-accent-start": themeTokens.accentStart,
            "--voices-slider-accent-end": themeTokens.accentEnd,
            "--voices-slider-accent-glow": themeTokens.accentGlow,
          } as React.CSSProperties
        }
      >
        <span className="voices-properties-mode-slider-visual" aria-hidden="true">
          <span className="voices-properties-mode-slider-band" />
          <span className="voices-properties-mode-slider-knob" />
        </span>
        <input
          className="voices-properties-mode-slider-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          onChange={handleValueInput}
          onInput={handleValueInput}
        />
      </span>
      <span className="voices-properties-mode-slider-helper">{helper}</span>
    </label>
  );
}

/**
 * Renders the dedicated Voices workflow panel.
 */
export const VoicesPropertiesPanel = React.memo(function VoicesPropertiesPanel({
  balanceCredits = null,
  pricingPolicy = null,
  selectedTool = null,
  onGenerate,
  onActiveVoiceChangerSourceVideoChange,
  resolveVoiceChangerInternalReferenceSource,
}: VoicesPropertiesPanelProps) {
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
  const [activeDesignedPreviewId, setActiveDesignedPreviewId] = React.useState<string | null>(null);
  const [voiceScript, setVoiceScript] = React.useState("");
  const [voiceoverSliderValues, setVoiceoverSliderValues] = React.useState<Record<string, number>>(
    () => buildSliderState(voiceoverShapingSliders)
  );
  const [voiceChangerSliderValues, setVoiceChangerSliderValues] = React.useState<
    Record<string, number>
  >(() => buildSliderState(voiceChangerShapingSliders));
  const [selectedVoiceoverFormat, setSelectedVoiceoverFormat] = React.useState("mp3_44100_128");
  const [selectedVoiceChangerOutputFormat, setSelectedVoiceChangerOutputFormat] =
    React.useState("mp3_44100_128");
  const [voiceChangerBackgroundCleanupEnabled, setVoiceChangerBackgroundCleanupEnabled] =
    React.useState(false);
  const [activePreviewVoiceId, setActivePreviewVoiceId] = React.useState<string | null>(null);
  const [voiceChangerSource, setVoiceChangerSource] = React.useState<VoiceChangerSource | null>(
    null
  );

  const voiceoverSplitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const voiceChangerSplitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const voiceNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const voicePromptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const voiceScriptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewAudioVoiceIdRef = React.useRef<string | null>(null);
  const designedPreviewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const designedPreviewAudioIdRef = React.useRef<string | null>(null);
  const previousVoiceScriptRef = React.useRef(voiceScript);
  const previousSurfaceModeRef = React.useRef(surfaceMode);
  const previousVoiceChangerSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const previousCloneVoiceSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const shouldFocusCreateControlsRef = React.useRef(false);
  const voiceChangerSourceRequestIdRef = React.useRef(0);
  const cloneVoiceSourceRequestIdRef = React.useRef(0);
  const requiresProviderVoice = Boolean(onGenerate);
  const isCreateVoiceModalOpen = isCreatePanelOpen && surfaceMode === "create";
  const isSelectedVoiceProviderReady =
    selectedLibraryVoice?.provider === "elevenlabs" && !selectedLibraryVoice?.isFallback;
  const normalizedVoicePromptLength = voicePrompt.trim().length;
  const estimatedCredits =
    surfaceMode === "create"
      ? (computeCostForModel(
          hardcodedVoiceoverModelId,
          {
            textCharacters: voiceScript.trim().length,
          },
          pricingPolicy
        )?.credits ?? null)
      : (computeCostForModel(
          hardcodedVoiceChangerModel,
          {
            sourceDurationSeconds:
              voiceChangerSource?.durationMs != null
                ? voiceChangerSource.durationMs / 1000
                : undefined,
          },
          pricingPolicy
        )?.credits ?? null);
  const isInsufficientCredits =
    balanceCredits != null && estimatedCredits != null ? balanceCredits < estimatedCredits : false;
  const isGenerateEnabled =
    Boolean(selectedLibraryVoice?.id) &&
    (!requiresProviderVoice || isSelectedVoiceProviderReady) &&
    (surfaceMode === "create"
      ? voiceScript.trim().length > 0
      : voiceChangerSource?.status === "ready") &&
    !isInsufficientCredits;
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
  const isCloneVoiceEnabled =
    createVoiceMode === "clone" &&
    voiceName.trim().length > 0 &&
    cloneVoiceSource?.status === "ready" &&
    Boolean(cloneVoiceSource.storagePath) &&
    isCloneConsentChecked &&
    !isCloningVoice;
  const activeSliderDefinitions =
    surfaceMode === "create" ? voiceoverShapingSliders : voiceChangerShapingSliders;
  const activeSliderValues =
    surfaceMode === "create" ? voiceoverSliderValues : voiceChangerSliderValues;
  const isVideoDerivedVoiceChangerSource =
    surfaceMode === "edit" &&
    Boolean(
      voiceChangerSource &&
      (voiceChangerSource.kind === "video" || voiceChangerSource.extractedFrom)
    );
  const canDeleteSelectedVoice =
    selectedLibraryVoice?.provider === "elevenlabs" && !selectedLibraryVoice?.isFallback;
  const selectedGenerateVoiceName = selectedLibraryVoice
    ? getVoiceChipDisplayName(selectedLibraryVoice.name)
    : "Select a voice";
  const activeSliderTheme: VoicesSliderTheme =
    surfaceMode === "create" ? "voiceover" : "voice-changer";
  const voiceoverSplit = useReferenceGridHorizontalSplit({
    enabled: surfaceMode === "create",
    containerRef: voiceoverSplitContainerRef,
    defaultTopRatio: 0.995,
    minTopSectionHeightPx: minTopVoicesPaneHeightPx,
    minBottomSectionHeightPx: minBottomComposePaneHeightPx,
    ariaLabel: "Resize available voices and prompt sections",
  });
  const voiceChangerSplit = useReferenceGridHorizontalSplit({
    enabled: surfaceMode === "edit",
    containerRef: voiceChangerSplitContainerRef,
    defaultTopRatio: 0.995,
    minTopSectionHeightPx: minTopVoicesPaneHeightPx,
    minBottomSectionHeightPx: minBottomVoiceChangerPaneHeightPx,
    ariaLabel: "Resize available voices and voice changer sections",
  });
  const activeSplit = surfaceMode === "create" ? voiceoverSplit : voiceChangerSplit;
  const {
    topRatio,
    topSectionStyle,
    bottomSectionStyle,
    topSectionHeightPx,
    bottomSectionHeightPx,
    dividerProps,
  } = activeSplit;
  const { nudgeTopSectionHeightByPx: nudgeVoiceoverTopSectionHeightByPx } = voiceoverSplit;
  const isVoiceLibraryVisible =
    topSectionHeightPx > 0 ? topSectionHeightPx > minVisibleVoicesPaneHeightPx : topRatio > 0.2;

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

    const scriptChanged =
      previousVoiceScriptRef.current !== voiceScript ||
      previousSurfaceModeRef.current !== surfaceMode;

    if (surfaceMode !== "create") {
      textarea.style.overflowY = "auto";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    const overflowPx = textarea.scrollHeight - textarea.clientHeight;
    if (overflowPx <= 1) {
      textarea.style.overflowY = "hidden";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    if (scriptChanged && topSectionHeightPx > minTopVoicesPaneHeightPx + 1) {
      const residualOverflowPx = nudgeVoiceoverTopSectionHeightByPx(-overflowPx);
      textarea.style.overflowY = Math.abs(residualOverflowPx) > 1 ? "auto" : "hidden";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    textarea.style.overflowY = "auto";
    previousVoiceScriptRef.current = voiceScript;
    previousSurfaceModeRef.current = surfaceMode;
  }, [
    bottomSectionHeightPx,
    nudgeVoiceoverTopSectionHeightByPx,
    surfaceMode,
    topSectionHeightPx,
    voiceScript,
  ]);

  React.useEffect(() => {
    if (!isCreateVoiceModalOpen || !shouldFocusCreateControlsRef.current) {
      return;
    }

    voiceNameInputRef.current?.focus();
    shouldFocusCreateControlsRef.current = false;
  }, [isCreateVoiceModalOpen]);

  const stopActiveDesignedPreview = React.useCallback(() => {
    const activeAudio = designedPreviewAudioRef.current;
    if (!activeAudio) {
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
      if (nextSource.kind === "video") {
        setVoiceChangerSliderValues({ ...hardcodedVideoDerivedVoiceChangerSliderValues });
      }

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

  const handleShapingSliderChange = React.useCallback(
    (sliderId: string, nextValue: number) => {
      if (surfaceMode === "create") {
        setVoiceoverSliderValues((currentValues) => ({
          ...currentValues,
          [sliderId]: nextValue,
        }));
        return;
      }

      setVoiceChangerSliderValues((currentValues) => ({
        ...currentValues,
        [sliderId]: nextValue,
      }));
    },
    [surfaceMode]
  );

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
    handleSurfaceModeChange("create");
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(true);
  }, [handleSurfaceModeChange, resetCreateVoiceModalState]);

  const handleCloseCreatePanel = React.useCallback(() => {
    resetCreateVoiceModalState();
    setIsCreatePanelOpen(false);
  }, [resetCreateVoiceModalState]);

  useAiStudioModalActivity("voices-create-modal", isCreateVoiceModalOpen);

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
    if (!activeAudio) {
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
    previewAudioRef.current = null;
    previewAudioVoiceIdRef.current = null;
    setActivePreviewVoiceId(null);
  }, []);

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
      nextAudio.preload = "none";
      nextAudio.onplay = () => {
        if (previewAudioRef.current !== nextAudio) return;
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
      nextAudio.preload = "none";
      nextAudio.onplay = () => {
        if (designedPreviewAudioRef.current !== nextAudio) return;
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
        outputFormat: selectedVoiceoverFormat,
        config: buildVoiceoverElevenV3RequestConfig(voiceoverSliderValues),
      });
      return;
    }
    if (!voiceChangerSource) return;
    void onGenerate({
      mode: "voice-changer",
      voice: selectedLibraryVoice,
      source: voiceChangerSource,
      outputFormat: selectedVoiceChangerOutputFormat,
      removeBackgroundNoise: voiceChangerBackgroundCleanupEnabled,
      modelId: hardcodedVoiceChangerModel,
      inputFormat: hardcodedVoiceChangerInputFormat,
      voiceSettings: buildVoiceChangerRequestSettings({
        source: voiceChangerSource,
        sliderValues: voiceChangerSliderValues,
      }),
    });
  }, [
    onGenerate,
    selectedLibraryVoice,
    selectedVoiceChangerOutputFormat,
    selectedVoiceoverFormat,
    surfaceMode,
    voiceChangerBackgroundCleanupEnabled,
    voiceChangerSliderValues,
    voiceChangerSource,
    voiceScript,
    voiceoverSliderValues,
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
          <div
            className="voices-properties-main"
            ref={
              surfaceMode === "create" ? voiceoverSplitContainerRef : voiceChangerSplitContainerRef
            }
          >
            <section
              className="voices-properties-voice-library"
              aria-label="Available voices"
              style={topSectionStyle}
            >
              {isVoiceLibraryVisible ? (
                <>
                  <div className="voices-properties-voice-library-header">
                    <h2 className="panel-title voices-properties-library-title">Voices</h2>
                    <div className="voices-properties-library-actions">
                      {selectedLibraryVoice ? (
                        <button
                          type="button"
                          className="voices-properties-library-delete-btn"
                          onClick={handleDeleteSelectedVoice}
                          aria-label="Delete Voice"
                          disabled={!canDeleteSelectedVoice || isDeletingSelectedVoice}
                          title={
                            canDeleteSelectedVoice ? undefined : "Default voices cannot be deleted."
                          }
                        >
                          <Trash size={14} weight="bold" aria-hidden="true" />
                          <span>
                            {isDeletingSelectedVoice ? "Deleting Voice…" : "Delete Voice"}
                          </span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="voices-properties-library-create-btn"
                        onClick={handleCreateVoiceEntry}
                        aria-label="+ Create New Voice"
                      >
                        <span
                          className="voices-properties-library-create-btn-icon"
                          aria-hidden="true"
                        >
                          +
                        </span>
                        <span>Create New Voice</span>
                      </button>
                    </div>
                  </div>
                  {voicesLoadError ? <p className="tiny subdued">{voicesLoadError}</p> : null}
                  {voicesLoadNotice ? <p className="tiny subdued">{voicesLoadNotice}</p> : null}
                  <ul className="voices-properties-voice-grid" aria-label="Available voices list">
                    {isVoicesLoading ? (
                      <>
                        <li className="sr-only" role="status" aria-live="polite">
                          Loading voices…
                        </li>
                        {Array.from({ length: voiceLoadingSkeletonCount }, (_, index) => (
                          <li
                            key={`voice-loading-skeleton-${index + 1}`}
                            className="voices-properties-voice-item"
                            aria-hidden="true"
                          >
                            <div className="voices-properties-voice-chip voices-properties-voice-chip--skeleton">
                              <span className="voices-properties-voice-chip-avatar voices-properties-voice-chip-skeleton-block" />
                              <span className="voices-properties-voice-chip-copy">
                                <span className="voices-properties-voice-chip-label voices-properties-voice-chip-skeleton-line voices-properties-voice-chip-skeleton-line--label" />
                                <span className="voices-properties-voice-chip-name voices-properties-voice-chip-skeleton-line voices-properties-voice-chip-skeleton-line--name" />
                              </span>
                              <span className="voices-properties-voice-chip-play voices-properties-voice-chip-play--skeleton">
                                <span className="voices-properties-voice-chip-skeleton-block voices-properties-voice-chip-skeleton-block--play" />
                              </span>
                            </div>
                          </li>
                        ))}
                      </>
                    ) : (
                      libraryVoices.map((voice) => {
                        const isSelected = voice.id === selectedLibraryVoice?.id;
                        const isPreviewPlaying = voice.id === activePreviewVoiceId;
                        const voiceChipDisplayName = getVoiceChipDisplayName(voice.name);
                        return (
                          <li key={voice.id} className="voices-properties-voice-item">
                            <div
                              className={`voices-properties-voice-chip ${isSelected ? "is-selected" : ""}`}
                            >
                              <button
                                type="button"
                                className="voices-properties-voice-chip-select"
                                aria-pressed={isSelected}
                                aria-label={`${voice.name} voice`}
                                onClick={() => setSelectedLibraryVoice(voice.id)}
                              >
                                <span
                                  className="voices-properties-voice-chip-avatar"
                                  aria-hidden="true"
                                >
                                  <Microphone size={14} weight="bold" />
                                </span>
                                <span className="voices-properties-voice-chip-copy">
                                  <span className="voices-properties-voice-chip-label">Voice</span>
                                  <span className="voices-properties-voice-chip-name">
                                    {voiceChipDisplayName}
                                  </span>
                                </span>
                              </button>

                              <button
                                type="button"
                                className="voices-properties-voice-chip-play"
                                aria-label={`${isPreviewPlaying ? "Stop" : "Play"} ${voice.name} sample`}
                                aria-pressed={isPreviewPlaying}
                                disabled={!voice.previewUrl}
                                onClick={() => handleVoicePreviewPlay(voice.id, voice.previewUrl)}
                              >
                                <span
                                  className="voices-properties-voice-chip-play-icon"
                                  aria-hidden="true"
                                >
                                  {isPreviewPlaying ? "❚❚" : "▶"}
                                </span>
                              </button>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </>
              ) : null}
            </section>

            <div
              className="voices-properties-horizontal-divider-wrap reference-grid-horizontal-divider-wrap"
              {...dividerProps}
            >
              <div
                className="voices-properties-horizontal-divider reference-grid-horizontal-divider"
                aria-hidden="true"
              />
            </div>

            <div className="voices-properties-compose-area" style={bottomSectionStyle}>
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
                      {formatCreditValue(estimatedCredits ?? 0)}
                      <span className="voices-properties-generate-cost-label">credits</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="voices-properties-column-shell voices-properties-column-shell--aside">
          <aside className="voices-properties-aside">
            <section className="voices-properties-rail-section">
              <div className="voices-properties-mode-switcher">
                <span className="voices-properties-field-label">Voice mode</span>
                <div className="voices-properties-mode-tabs" role="tablist" aria-label="Voice mode">
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

              {isVideoDerivedVoiceChangerSource ? null : (
                <section
                  className={`voices-properties-shaping-card ${
                    activeSliderTheme === "voiceover" ? "is-voiceover" : "is-voice-changer"
                  }`}
                  aria-label={surfaceMode === "create" ? "Voice shaping" : "Voice changer shaping"}
                >
                  <div className="voices-properties-shaping-card-heading-row">
                    <p className="voices-properties-shaping-card-kicker">Voice shaping</p>
                  </div>

                  <div className="voices-properties-mode-slider-stack">
                    {activeSliderDefinitions.map((slider, index) => (
                      <VoicesSlider
                        key={`voices-shaping-slider-${index}`}
                        label={slider.label}
                        helper={slider.helper}
                        value={activeSliderValues[slider.id] ?? slider.defaultValue}
                        displayValue={slider.formatValue(
                          activeSliderValues[slider.id] ?? slider.defaultValue
                        )}
                        onChange={(nextValue) => handleShapingSliderChange(slider.id, nextValue)}
                        theme={activeSliderTheme}
                        isModeTransitioning={false}
                      />
                    ))}
                  </div>
                </section>
              )}

              {surfaceMode === "create" ? (
                <>
                  <section
                    className="voices-properties-voiceover-card"
                    aria-label="Voiceover settings"
                  >
                    {/* Eleven v3 voiceover request defaults: model_id is fixed, language_code stays null, style stays at 0, and Speaker Boost is omitted because v3 does not support it. */}
                    <div className="voices-properties-delivery-stack">
                      <label className="voices-properties-output-field">
                        <span className="voices-properties-selector-label">Format</span>
                        <span className="voices-properties-output-select-shell">
                          <select
                            className="voices-properties-output-select"
                            value={selectedVoiceoverFormat}
                            onChange={(event) => setSelectedVoiceoverFormat(event.target.value)}
                            aria-label="Voiceover output format"
                          >
                            {voiceoverFormatOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section
                    className="voices-properties-voice-changer-card"
                    aria-label="Voice changer settings"
                  >
                    <div className="voices-properties-voice-changer-card-heading-row">
                      <p className="voices-properties-voice-changer-card-kicker">
                        Conversion settings
                      </p>
                    </div>

                    <div className="voices-properties-voice-changer-setting-stack">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={voiceChangerBackgroundCleanupEnabled}
                        className={`voices-properties-voice-changer-switch-row ${
                          voiceChangerBackgroundCleanupEnabled ? "is-active" : ""
                        }`}
                        onClick={() =>
                          setVoiceChangerBackgroundCleanupEnabled((currentValue) => !currentValue)
                        }
                      >
                        <span className="voices-properties-voice-changer-switch-copy">
                          <span className="voices-properties-voice-changer-switch-label">
                            Noise reduction
                          </span>
                        </span>
                        <span
                          className="voices-properties-voice-changer-switch-control"
                          aria-hidden="true"
                        >
                          <span className="voices-properties-voice-changer-switch-thumb" />
                        </span>
                      </button>

                      <input
                        type="hidden"
                        name="voiceChangerModel"
                        value={hardcodedVoiceChangerModel}
                        aria-hidden="true"
                      />
                      <input
                        type="hidden"
                        name="voiceChangerSpeakerBoostEnabled"
                        value={hardcodedVoiceChangerSpeakerBoostEnabled ? "true" : "false"}
                        aria-hidden="true"
                      />
                      <input
                        type="hidden"
                        name="voiceChangerInputFormat"
                        value={hardcodedVoiceChangerInputFormat}
                        aria-hidden="true"
                      />

                      <label className="voices-properties-voice-changer-field">
                        <span className="voices-properties-voice-changer-field-label">
                          Output format
                        </span>
                        <span className="voices-properties-voice-changer-select-shell">
                          <select
                            className="voices-properties-voice-changer-select"
                            value={selectedVoiceChangerOutputFormat}
                            onChange={(event) =>
                              setSelectedVoiceChangerOutputFormat(event.target.value)
                            }
                            aria-label="Voice changer output format"
                          >
                            {voiceChangerOutputFormatOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                  </section>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
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
            cloneVoiceError={cloneVoiceError}
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
