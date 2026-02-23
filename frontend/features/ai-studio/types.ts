/**
 * Types for the AI Studio feature surface.
 * Keeps mode, aspect, prompt, and output structures shared between components.
 */
export type StudioMode = "text" | "image" | "video";

export type WorkflowId = "create" | "edit" | "video" | "character" | "none";

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
};

export type ToolId =
  | "create"
  | "workflows"
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
