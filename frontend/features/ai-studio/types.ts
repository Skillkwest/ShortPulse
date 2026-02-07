/**
 * Types for the AI Studio feature surface.
 * Keeps mode, aspect, prompt, and output structures shared between components.
 */
export type StudioMode = "text" | "image" | "video";

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
  taskState?: "pending" | "running" | "success" | "fail";
  errorMessage?: string | null;
  resultUrls?: string[];
  previewUrl?: string;
  previewText?: string;
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
  | "edit"
  | "canvas";
