/**
 * Types for the AI Studio feature surface.
 * Keeps mode, aspect, prompt, and output structures shared between components.
 */
import type { InternalMediaRef } from "../../lib/media/internalMediaRefs";

export type StudioMode = "text" | "image" | "video" | "audio";

export type WorkflowId = "create" | "edit" | "video" | "character" | "none";

export type VideoReferenceMode =
  | "standard"
  | "modify"
  | "keyframes"
  | "kling3"
  | "motion"
  | "lip-sync";

export type LipSyncAudioStatus = "empty" | "uploading" | "ready" | "failed";
export type LipSyncAudioSourceKind = "local" | "library" | "reference" | "canvas" | null;

export type LipSyncAudioState = {
  url: string | null;
  title?: string | null;
  durationMs: number | null;
  status: LipSyncAudioStatus;
  sourceKind: LipSyncAudioSourceKind;
  storagePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  error?: string | null;
  previewUrl?: string | null;
};

export type AspectOption = {
  value: string;
  ratioLabel: string;
  name: string;
  orientation: "square" | "vertical" | "horizontal" | "widescreen";
};

export type PromptTemplate = {
  id: string;
  label: string;
  text: string;
};

export type StudioOutputCharacterContext = {
  applied: boolean;
  characterId?: string | null;
  characterName?: string | null;
  lookId?: string | null;
  lookName?: string | null;
  characterProfileImageUrl?: string | null;
};

export type StudioOutputStyleContext = {
  applied: boolean;
  styleId?: string | null;
  styleName?: string | null;
  stylePrompt?: string | null;
  stylePreviewImageUrl?: string | null;
};

export type GenerationReplaySubmitTool = "create" | "image" | "edit";

export type GenerationReplayConfigV1 = {
  version: 1;
  mode: "image";
  submitTool: GenerationReplaySubmitTool;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  // Provider-ready reference URLs captured from preflight at submit time.
  referenceInputs: string[];
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  capturedAt: string;
};

export type GenerationReplayConfigV2 = {
  version: 2;
  mode: "image";
  submitTool: GenerationReplaySubmitTool;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  // Only truly external or already-provider-safe references remain here.
  referenceInputs: string[];
  // App-owned references persist canonically so reroll can mint fresh provider URLs later.
  internalMediaRefs: Array<InternalMediaRef | null>;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  capturedAt: string;
};

export type GenerationReplayConfig = GenerationReplayConfigV1 | GenerationReplayConfigV2;

export type WorkflowReloadPanelKind =
  | WorkflowId
  | "styles"
  | "presets"
  | "elements"
  | "media-library"
  | "sound"
  | "music"
  | "sound-effects"
  | "voices";

export type WorkflowReloadCreateMode = "standard" | "pulse";
export type WorkflowReloadMediaKindHint = "image" | "video" | "audio";

export type WorkflowReloadPrompt = {
  display: string;
  submission?: string;
};

export type WorkflowReloadModel = {
  id: string;
};

export type WorkflowReloadExpertEditReferenceSlot = {
  slotIndex: number;
  referenceInputIndex: number;
  internalMediaRef?: InternalMediaRef | null;
};

export type WorkflowReloadExpertEditRestoreSlot = {
  slotIndex: number;
  sourceUrl: string;
  internalMediaRef?: InternalMediaRef | null;
};

export type WorkflowReloadExpertEditReferences = {
  version: 1;
  maxSecondarySlotCount: number;
  primaryReferenceInputIndex: number | null;
  restorePrimaryCanvasSlots?: WorkflowReloadExpertEditRestoreSlot[];
  secondarySlots: WorkflowReloadExpertEditReferenceSlot[];
  restoreSecondarySlots?: WorkflowReloadExpertEditRestoreSlot[];
};

export type WorkflowReloadPulseContext = {
  presetId?: string | null;
  presetLabel?: string | null;
  pulseKind?: string | null;
};

export type WorkflowReloadImagePayload = {
  kind: "image";
  submitTool: GenerationReplaySubmitTool;
  aspect: string;
  imageResolution: string | null;
  referenceInputs: string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  expertEditReferences?: WorkflowReloadExpertEditReferences;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
};

export type WorkflowReloadVideoReferenceMode =
  | "standard"
  | "modify"
  | "keyframes"
  | "kling3"
  | "motion"
  | "lip-sync";

export type WorkflowReloadKlingWorkflowMode = "single" | "multi" | "custom";
export type WorkflowReloadSeedance2InputMode = "text" | "first-frame" | "first-last" | "multimodal";
export type WorkflowReloadKlingShotType = "customize" | "intelligent";

export type WorkflowReloadKlingPromptShot = {
  id: string;
  prompt: string;
  duration: number;
};

export type WorkflowReloadKlingElement = Record<string, unknown>;

export type WorkflowReloadVideoFrameSlot = {
  sourceUrl: string;
  internalMediaRef?: InternalMediaRef | null;
};

export type WorkflowReloadVideoMediaSlot = {
  slotIndex: number;
  sourceUrl: string;
  internalMediaRef?: InternalMediaRef | null;
};

export type WorkflowReloadVideoKlingElementSlot = {
  slotIndex: number;
  element: WorkflowReloadKlingElement;
  profileImageInternalMediaRef?: InternalMediaRef | null;
  frontalImageInternalMediaRef?: InternalMediaRef | null;
  referenceImageInternalMediaRefs?: Array<InternalMediaRef | null>;
  videoInternalMediaRef?: InternalMediaRef | null;
  audioInternalMediaRef?: InternalMediaRef | null;
};

export type WorkflowReloadVideoReferences = {
  version: 1;
  firstFrame?: WorkflowReloadVideoFrameSlot | null;
  lastFrame?: WorkflowReloadVideoFrameSlot | null;
  seedance2ReferenceImages?: WorkflowReloadVideoMediaSlot[];
  seedance2ReferenceVideos?: WorkflowReloadVideoMediaSlot[];
  seedance2ReferenceAudio?: WorkflowReloadVideoMediaSlot[];
  klingElementSlots?: WorkflowReloadVideoKlingElementSlot[];
};

export type WorkflowReloadVideoPayload = {
  kind: "video";
  aspect: string;
  videoReferenceMode: WorkflowReloadVideoReferenceMode;
  durationSeconds: number | null;
  resolution: string | null;
  generateAudio: boolean | null;
  cameraFixed: boolean | null;
  autoFix: boolean | null;
  referenceInputs: string[];
  internalMediaRefs?: Array<InternalMediaRef | null>;
  styleContext?: StudioOutputStyleContext;
  videoReferences?: WorkflowReloadVideoReferences;
  motionReferenceVideoUrl?: string | null;
  lipSyncAudioUrl?: string | null;
  lipSyncAudioStoragePath?: string | null;
  lipSyncAudioDurationMs?: number | null;
  lipSyncTurboMode?: boolean | null;
  seedance2InputMode?: WorkflowReloadSeedance2InputMode | null;
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  seedance2ReturnLastFrame?: boolean | null;
  seedance2WebSearch?: boolean | null;
  klingNegativePrompt?: string | null;
  klingCfgScale?: number | null;
  klingWorkflowMode?: WorkflowReloadKlingWorkflowMode | null;
  klingShotType?: WorkflowReloadKlingShotType | null;
  klingVoiceIds?: [string, string] | null;
  klingMultiPrompts?: WorkflowReloadKlingPromptShot[];
  klingElements?: WorkflowReloadKlingElement[];
};

export type WorkflowReloadMusicMode = "instrumental" | "vocal";
export type WorkflowReloadMusicStructure = "loop" | "full-track" | "cinematic";
export type WorkflowReloadMusicFormat = "mp3_44100_128" | "wav_48000";
export type WorkflowReloadMusicComposerMode = "simple" | "custom";
export type WorkflowReloadMusicSongBatchCount = 1 | 2 | 3 | 4;

export type WorkflowReloadMusicPayload = {
  kind: "music";
  text: string;
  prompt?: string;
  lyrics?: string;
  durationSeconds: number | null;
  bpm?: number | null;
  mode?: WorkflowReloadMusicMode | null;
  structure?: WorkflowReloadMusicStructure | null;
  energyPercent?: number | null;
  outputFormat?: WorkflowReloadMusicFormat | null;
  composerMode?: WorkflowReloadMusicComposerMode | null;
  instrumentalEnabled?: boolean | null;
  singerEnabled?: boolean | null;
  songBatchCount?: WorkflowReloadMusicSongBatchCount | null;
};

export type WorkflowReloadSoundEffectFormat = "mp3_44100_128" | "pcm_48000";

export type WorkflowReloadSoundEffectsPayload = {
  kind: "sound-effects";
  text: string;
  durationSeconds: number | null;
  loop?: boolean | null;
  promptInfluence?: number | null;
  outputFormat?: WorkflowReloadSoundEffectFormat | null;
};

export type WorkflowReloadVoiceoverPayload = {
  kind: "voiceover";
  script: string;
  voiceId: string;
  voiceName: string;
  outputFormat: string;
  config?: Record<string, unknown>;
};

export type WorkflowReloadVoiceChangerSource = {
  name?: string | null;
  origin?: string | null;
  sourceUrl?: string | null;
  storagePath?: string | null;
  internalMediaRef?: InternalMediaRef | null;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
  mimeType?: string | null;
  aspect?: string | null;
  extractedFrom?: {
    name?: string | null;
    sourceUrl?: string | null;
    storagePath?: string | null;
    internalMediaRef?: InternalMediaRef | null;
    referenceOutputId?: string | null;
    referenceMediaId?: string | null;
    mimeType?: string | null;
    aspect?: string | null;
  } | null;
};

export type WorkflowReloadVoiceChangerPayload = {
  kind: "voice-changer";
  source: WorkflowReloadVoiceChangerSource;
  voiceId: string;
  voiceName: string;
  outputFormat: string;
  modelId: string;
  inputFormat?: string | null;
  removeBackgroundNoise?: boolean | null;
  voiceSettings?: Record<string, unknown>;
};

export type WorkflowReloadPayload =
  | WorkflowReloadImagePayload
  | WorkflowReloadVideoPayload
  | WorkflowReloadMusicPayload
  | WorkflowReloadSoundEffectsPayload
  | WorkflowReloadVoiceoverPayload
  | WorkflowReloadVoiceChangerPayload;

export type WorkflowReloadConfigV1 = {
  version: 1;
  source: "ai_studio_generation";
  capturedAt: string;
  originTool: ToolId;
  panelKind: WorkflowReloadPanelKind;
  outputMode: StudioMode;
  restoreBehavior: "navigate_and_hydrate";
  projectId?: string | null;
  createMode?: WorkflowReloadCreateMode | null;
  pulse?: WorkflowReloadPulseContext | null;
  prompt: WorkflowReloadPrompt;
  model: WorkflowReloadModel;
  payload: WorkflowReloadPayload;
};

export type WorkflowReloadConfig = WorkflowReloadConfigV1;

export type StudioOutputMediaSource = "upload" | "library" | "generated" | "clipboard" | "prompt";

export type StudioOutputPreviewTier = "thumb" | "poster" | "preview_loop" | "full";
export type StudioOutputSubmissionMode = "provider-task" | "direct-request";
export type StudioOutputCompanionArtStatus = "pending" | "processing" | "ready" | "failed";
export type StudioOutputSaveState = "idle" | "saving" | "saved" | "failed" | "blocked_storage";
export type StudioAudioSourceMode = "voiceover" | "voice-changer" | "sound-effects" | "music";

export type StudioOutput = {
  id: string;
  prompt: string;
  title?: string | null;
  transcriptText?: string | null;
  lyricsText?: string | null;
  mode: StudioMode;
  aspect: string;
  model: string;
  createdAt?: string | null;
  modelId?: string;
  provider?: string;
  sourceRef?: string;
  generationId?: string;
  savedMediaIds?: string[];
  promptId?: string;
  saveState?: StudioOutputSaveState;
  saveError?: string | null;
  status: "ready" | "saved";
  timestamp: string;
  taskId?: string;
  queueState?: "queued" | "dispatching" | "dispatched";
  queueEnqueuedAtMs?: number;
  submissionTraceId?: string;
  generationTraceId?: string;
  submissionMode?: StudioOutputSubmissionMode;
  taskState?: "pending" | "running" | "success" | "fail";
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  errorPayload?: unknown | null;
  resultUrls?: string[];
  previewUrl?: string;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
  companionArtStatus?: StudioOutputCompanionArtStatus | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewTier?: StudioOutputPreviewTier;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  musicMode?: WorkflowReloadMusicMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
  mediaSource?: StudioOutputMediaSource;
  localObjectUrl?: string | null;
  previewText?: string;
  pinned?: boolean;
  hiddenInReferenceGrid?: boolean;
  archivedAt?: string | null;
  archiveReason?: "manual" | "cleanup" | null;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  generationReplay?: GenerationReplayConfig;
  workflowReload?: WorkflowReloadConfig;
};

export type ToolId =
  | "create"
  | "media-library"
  | "elements"
  | "workflows"
  | "presets"
  | "styles"
  | "templates"
  | "community"
  | "character"
  | "image"
  | "video"
  | "sound"
  | "voices"
  | "text-to-speech"
  | "voice-changer"
  | "sound-effects"
  | "music"
  | "text"
  | "kling"
  | "edit";

export type StylesLibraryStyleDetails = {
  style: string;
  title: string;
  referenceImageName: string;
  stylePrompt: string;
  previewImageUrl: string;
};

export type StylesLibraryStyleDetailsMap = Record<string, StylesLibraryStyleDetails>;
