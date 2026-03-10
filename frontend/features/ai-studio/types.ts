/**
 * Types for the AI Studio feature surface.
 * Keeps mode, aspect, prompt, and output structures shared between components.
 */
export type StudioMode = "text" | "image" | "video";

export type WorkflowId = "create" | "edit" | "video" | "character" | "canvas" | "none";

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
  characterProfileImageUrl?: string | null;
};

export type StudioOutputStyleContext = {
  applied: boolean;
  styleId?: string | null;
  styleName?: string | null;
  stylePrompt?: string | null;
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

export type GenerationReplayConfig = GenerationReplayConfigV1;

export type StudioOutputMediaSource = "upload" | "library" | "generated" | "clipboard" | "prompt";

export type StudioOutputPreviewTier = "thumb" | "poster" | "preview_loop" | "full";

export type StudioOutput = {
  id: string;
  prompt: string;
  mode: StudioMode;
  aspect: string;
  model: string;
  modelId?: string;
  provider?: string;
  generationId?: string;
  savedMediaIds?: string[];
  promptId?: string;
  saveState?: "idle" | "saving" | "saved" | "failed";
  saveError?: string | null;
  status: "ready" | "saved";
  timestamp: string;
  taskId?: string;
  queueState?: "queued" | "dispatched";
  queueEnqueuedAtMs?: number;
  submissionTraceId?: string;
  generationTraceId?: string;
  taskState?: "pending" | "running" | "success" | "fail";
  errorMessage?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  resultUrls?: string[];
  previewUrl?: string;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewTier?: StudioOutputPreviewTier;
  mediaSource?: StudioOutputMediaSource;
  localObjectUrl?: string | null;
  previewText?: string;
  pinned?: boolean;
  hiddenInReferenceGrid?: boolean;
  archivedAt?: string | null;
  archiveReason?: "soft_limit" | "manual" | "cleanup" | null;
  characterContext?: StudioOutputCharacterContext;
  styleContext?: StudioOutputStyleContext;
  generationReplay?: GenerationReplayConfig;
};

export type ToolId =
  | "create"
  | "media-library"
  | "workflows"
  | "presets"
  | "styles"
  | "templates"
  | "my-generations"
  | "community"
  | "character"
  | "image"
  | "video"
  | "text"
  | "kling"
  | "edit"
  | "canvas";

export type StylesLibraryStyleDetails = {
  style: string;
  title: string;
  referenceImageName: string;
  stylePrompt: string;
  previewImageUrl: string;
  styleProfile?: StylesLibraryStyleProfile;
  extractionMeta?: StylesLibraryStyleExtractionMeta;
};

export type StylesLibraryStyleDetailsMap = Record<string, StylesLibraryStyleDetails>;

export type StylesLibraryStyleExtractionOutcome = "success" | "fallback" | "blocked_source";

export type StylesLibraryStyleExtractionFlow = "create_modal" | "library_drop";

export type StylesLibraryStyleProfile = {
  version: 1;
  medium: string | null;
  lightingDescriptors: string[];
  lensDepthDescriptors: string[];
  colorDescriptors: string[];
  renderingDescriptors: string[];
  textureDescriptors: string[];
  generalDescriptors: string[];
};

export type StylesLibraryStyleExtractionMeta = {
  version: 1;
  outcome: StylesLibraryStyleExtractionOutcome;
  flow: StylesLibraryStyleExtractionFlow;
  extractedAtIso: string;
  sourceUrlKind: "data" | "url" | "unknown";
  extractor: "openai_prompt_style_extract";
};
