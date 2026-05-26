import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractDragDropPayload,
  extractPromptDropText,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
} from "../../utils/dragDrop";

type AgentComposerDropResolution = {
  droppedPromptText: string | null;
  droppedImageUrl: string | null;
  isVideoReference: boolean;
};

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
