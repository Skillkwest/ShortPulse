/**
 * Agent reference output adapters for AI Studio state.
 * Builds prompt/media reference output records used by agent and clipboard insertion paths.
 */
import type { StudioOutput } from "../../types";
import { isVideoUrl, resolveModelLabel } from "../../logic/stateParsers";

type CommonParams = {
  id: string;
  aspect: string;
  model: string | null;
};

/**
 * Build a text prompt reference output with a fixed source timestamp label.
 */
const buildTextPromptReferenceOutput = ({
  id,
  aspect,
  model,
  promptText,
  timestamp,
}: CommonParams & {
  promptText: string;
  timestamp: string;
}): StudioOutput => {
  const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
  return {
    id,
    prompt: promptText,
    mode: "text",
    aspect,
    model: placeholderModelLabel,
    modelId: model ?? undefined,
    status: "ready",
    timestamp,
    previewText: promptText,
    mediaSource: "prompt",
    previewTier: "full",
    archivedAt: null,
    archiveReason: null,
    saveState: "idle",
    saveError: null,
  };
};

/**
 * Build an output for prompt references added by agent actions.
 */
export const buildAgentPromptReferenceOutput = ({
  id,
  aspect,
  model,
  promptText,
}: CommonParams & {
  promptText: string;
}): StudioOutput =>
  buildTextPromptReferenceOutput({
    id,
    aspect,
    model,
    promptText,
    timestamp: "Agent",
  });

/**
 * Build an output for prompt references pasted from clipboard.
 */
export const buildPastedPromptReferenceOutput = ({
  id,
  aspect,
  model,
  promptText,
}: CommonParams & {
  promptText: string;
}): StudioOutput =>
  buildTextPromptReferenceOutput({
    id,
    aspect,
    model,
    promptText,
    timestamp: "Clipboard",
  });

/**
 * Build an output for media references pasted from clipboard.
 */
export const buildPastedMediaReferenceOutput = ({
  id,
  aspect,
  model,
  url,
  mimeType,
}: CommonParams & {
  url: string;
  mimeType?: string | null;
}): StudioOutput => {
  const isVideo = mimeType?.startsWith("video/") || (!mimeType && isVideoUrl(url));
  const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
  const parsedFilename = (() => {
    if (/^data:/i.test(url)) return null;
    try {
      const path = new URL(url).pathname;
      const segment = path.split("/").pop();
      return segment ? decodeURIComponent(segment) : null;
    } catch {
      return null;
    }
  })();
  return {
    id,
    prompt: parsedFilename ?? (isVideo ? "Pasted video" : "Pasted image"),
    mode: isVideo ? "video" : "image",
    aspect,
    model: placeholderModelLabel,
    modelId: model ?? undefined,
    status: "ready",
    timestamp: "Clipboard",
    previewUrl: url,
    mediaSource: "clipboard",
    previewTier: isVideo ? "preview_loop" : "full",
    fullStoragePath: null,
    previewStoragePath: null,
    archivedAt: null,
    archiveReason: null,
    saveState: "idle",
    saveError: null,
  };
};
