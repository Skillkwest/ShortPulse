import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractDragDropPayload,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
} from "../../utils/dragDrop";

type AgentComposerDropResolution = {
  droppedPromptText: string | null;
  droppedImageUrl: string | null;
  isVideoReference: boolean;
};

export const resolveAgentComposerDrop = (
  transfer: DataTransfer | null | undefined
): AgentComposerDropResolution => {
  const payload = transfer ? extractDragDropPayload(transfer) : null;
  const mediaLibraryPayload = transfer ? readMediaLibraryDragPayload(transfer) : null;
  const droppedPromptText = payload?.promptText?.trim() ?? null;
  const droppedImageUrl = payload?.imageUrl?.trim() ?? null;
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
