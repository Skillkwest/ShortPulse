import React from "react";

export type StudioMode = "enhance" | "image" | "video";

export type AspectOption = {
  label: string;
  value: string;
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
  status: "ready" | "saved";
  timestamp: string;
  previewUrl?: string;
  previewText?: string;
};

export type ToolId = "create" | "edit" | "image-to-video" | "organize";

export type ToolMeta = { id: ToolId; label: string; desc: string };

export type ModeIconMap = Record<StudioMode, React.ComponentType<any>>;
