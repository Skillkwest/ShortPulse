import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractDragDropPayload,
  extractPromptDropText,
  getNormalizedTransferTypes,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
} from "../../utils/dragDrop";

type AgentComposerDropResolution = {
  droppedPromptText: string | null;
  droppedImageUrl: string | null;
  isVideoReference: boolean;
};

export type AgentComposerPanelDropKind = "none" | "text" | "media";
export type DroppedPromptTextEditMode = "replace" | "insert";

let isShiftPromptDropModifierPressed = false;
let isShiftPromptDropModifierActiveForDrag = false;

const resetPromptDropDragModifierSoon = () => {
  if (typeof window === "undefined") {
    isShiftPromptDropModifierActiveForDrag = false;
    return;
  }
  window.setTimeout(() => {
    isShiftPromptDropModifierActiveForDrag = false;
  }, 0);
};

const updatePromptDropDragModifier = (event: DragEvent | KeyboardEvent) => {
  isShiftPromptDropModifierActiveForDrag =
    Boolean(event.shiftKey) || isShiftPromptDropModifierPressed;
};

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      if (!event.shiftKey && event.key !== "Shift") return;
      isShiftPromptDropModifierPressed = true;
      isShiftPromptDropModifierActiveForDrag = true;
    },
    true
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (event.key !== "Shift" || event.shiftKey) return;
      isShiftPromptDropModifierPressed = false;
      isShiftPromptDropModifierActiveForDrag = false;
    },
    true
  );
  window.addEventListener("blur", () => {
    isShiftPromptDropModifierPressed = false;
    isShiftPromptDropModifierActiveForDrag = false;
  });
  window.addEventListener("dragenter", updatePromptDropDragModifier, true);
  window.addEventListener("dragover", updatePromptDropDragModifier, true);
  window.addEventListener(
    "drop",
    (event) => {
      updatePromptDropDragModifier(event);
      resetPromptDropDragModifierSoon();
    },
    true
  );
  window.addEventListener("dragend", resetPromptDropDragModifierSoon, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    isShiftPromptDropModifierPressed = false;
    isShiftPromptDropModifierActiveForDrag = false;
  });
}

const MEDIA_HINT_TRANSFER_TYPES = new Set([
  "files",
  "image/url",
  "text/reference-drag-token",
  "text/reference-id",
  "text/reference-output-id",
  "text/reference-media-id",
  "text/reference-origin",
  "text/reference-source-surface",
  "text/reference-url",
  "text/reference-render-url",
  "text/uri-list",
  "application/x-shortpulse-reference-drag-token",
  "application/x-shortpulse-composer-image-drop-token",
  "application/x-shortpulse-composer-image-drop",
  "text/reference-composer-image-drop-token",
  "text/reference-composer-image-payload",
]);

const PROMPT_HINT_TRANSFER_TYPES = new Set(["text/prompt", "text/plain", "text"]);

export const insertDroppedPromptTextAtSelection = ({
  composerText,
  droppedPromptText,
  selectionStart,
  selectionEnd,
}: {
  composerText: string;
  droppedPromptText: string;
  selectionStart: number;
  selectionEnd: number;
}): { prompt: string; caret: number } => {
  const currentText = typeof composerText === "string" ? composerText : "";
  const insertedText = droppedPromptText.trim();
  const start = Math.max(0, Math.min(currentText.length, selectionStart));
  const end = Math.max(start, Math.min(currentText.length, selectionEnd));
  const nextPrompt = `${currentText.slice(0, start)}${insertedText}${currentText.slice(end)}`;

  return {
    prompt: nextPrompt,
    caret: start + insertedText.length,
  };
};

export const resolveDroppedPromptTextEdit = ({
  composerText,
  droppedPromptText,
  selectionStart,
  selectionEnd,
  editMode,
}: {
  composerText: string;
  droppedPromptText: string;
  selectionStart: number;
  selectionEnd: number;
  editMode: DroppedPromptTextEditMode;
}): { prompt: string; caret: number } => {
  if (editMode === "insert") {
    return insertDroppedPromptTextAtSelection({
      composerText,
      droppedPromptText,
      selectionStart,
      selectionEnd,
    });
  }

  const prompt = droppedPromptText.trim();
  return {
    prompt,
    caret: prompt.length,
  };
};

export const resolveDroppedPromptTextEditMode = (event: {
  getModifierState?: (key: "Shift") => boolean;
  shiftKey?: boolean;
}): DroppedPromptTextEditMode =>
  event.shiftKey ||
  event.getModifierState?.("Shift") ||
  isShiftPromptDropModifierPressed ||
  isShiftPromptDropModifierActiveForDrag
    ? "insert"
    : "replace";

export const resolveAgentComposerDrop = (
  transfer: DataTransfer | null | undefined
): AgentComposerDropResolution => {
  const payload = transfer ? extractDragDropPayload(transfer) : null;
  const mediaLibraryPayload = transfer ? readMediaLibraryDragPayload(transfer) : null;
  const droppedPromptText = transfer ? extractPromptDropText(transfer) : null;
  const droppedImageUrl = droppedPromptText ? null : (payload?.imageUrl?.trim() ?? null);
  const droppedReferenceUrl = transfer
    ? (normalizeReferenceTransferUrlCandidate(transfer.getData("text/reference-url")) ?? null)
    : null;
  const isVideoReference =
    payload?.mediaKind === "video" ||
    (mediaLibraryPayload?.kind === "libraryMedia" &&
      mediaLibraryPayload.payload.fileType === "video") ||
    looksLikeVideoUrl(droppedReferenceUrl ?? undefined);

  return {
    droppedPromptText,
    droppedImageUrl,
    isVideoReference,
  };
};

/**
 * Resolves prompt text only when the dropped payload should be inserted into the composer
 * instead of routed through the generic attachment pipeline.
 */
export const resolveAgentComposerTextDrop = (
  transfer: DataTransfer | null | undefined
): string | null => {
  const { droppedPromptText, droppedImageUrl, isVideoReference } =
    resolveAgentComposerDrop(transfer);
  if (!droppedPromptText || droppedImageUrl || isVideoReference) return null;
  return droppedPromptText;
};

/**
 * Builds the next composer text/caret state for text-only prompt drops.
 */
export const resolveAgentComposerTextDropInsertion = ({
  transfer,
  composerText,
  selectionStart,
  selectionEnd,
  editMode = "replace",
}: {
  transfer: DataTransfer | null | undefined;
  composerText: string;
  selectionStart: number;
  selectionEnd: number;
  editMode?: DroppedPromptTextEditMode;
}): { prompt: string; caret: number } | null => {
  const droppedPromptText = resolveAgentComposerTextDrop(transfer);
  if (!droppedPromptText) return null;
  return resolveDroppedPromptTextEdit({
    composerText,
    droppedPromptText,
    selectionStart,
    selectionEnd,
    editMode,
  });
};

export const resolveAgentComposerPanelDropKind = (
  transfer: DataTransfer | null | undefined
): AgentComposerPanelDropKind => {
  if (!transfer) return "none";

  if (resolveAgentComposerTextDrop(transfer)) return "text";

  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  if (mediaLibraryPayload?.kind === "libraryMedia") return "media";
  if (mediaLibraryPayload?.kind === "libraryPrompt") return "text";

  const normalizedTransferTypes = getNormalizedTransferTypes(transfer);
  const hasStrongMediaTransferHints = normalizedTransferTypes.some((type) =>
    MEDIA_HINT_TRANSFER_TYPES.has(type)
  );
  if (hasStrongMediaTransferHints) return "media";

  const payload = extractDragDropPayload(transfer);
  if (payload?.imageFile || payload?.imageUrl) return "media";
  if (
    payload?.mediaKind === "image" ||
    payload?.mediaKind === "video" ||
    payload?.mediaKind === "audio"
  ) {
    return "media";
  }

  const hasPromptTransferHints = normalizedTransferTypes.some((type) =>
    PROMPT_HINT_TRANSFER_TYPES.has(type)
  );
  if (hasPromptTransferHints) {
    const droppedPromptText = extractPromptDropText(transfer);
    if (droppedPromptText) return "text";
  }

  return extractPromptDropText(transfer) ? "text" : "none";
};
