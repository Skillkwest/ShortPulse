/**
 * Types for the AI Studio feature surface.
 * Keeps mode, aspect, prompt, and output structures shared between components.
 */
export type StudioMode = "enhance" | "image" | "video";

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
  | "edit-parent"
  | "enhance"
  | "character"
  | "image-to-image"
  | "image-to-video"
  | "text"
  | "edit"
  | "canvas";
