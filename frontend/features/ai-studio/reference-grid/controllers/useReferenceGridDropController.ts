/**
 * Canvas drag/drop controller for Reference Grid.
 * Encapsulates drop-mode transitions and global drag cleanup outside the render component.
 */
import { useEffect, type MutableRefObject } from "react";
import { extractDroppedPromptText, getDroppedMediaReference } from "./referenceGridClipboard";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../utils/dragDrop";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../referenceGridTypes";

export type ReferenceGridDropMode = "none" | "text" | "files";

/**
 * @deprecated Use `ReferenceGridDropMode`.
 */

type UseReferenceGridDropControllerArgs = {
  canvasDragDepthRef: MutableRefObject<number>;
  curatedDragDepthRef: MutableRefObject<number>;
  setCanvasDropModeSafe: (next: ReferenceGridDropMode) => void;
  setCuratedDropActiveSafe: (next: boolean) => void;
  resolveCanvasDropMode: (transfer: DataTransfer) => ReferenceGridDropMode;
  canAcceptCanvasDrag: (transfer: DataTransfer) => boolean;
  normalizeMediaFiles: (files: File[]) => File[];
  buildFileList: (files: File[]) => FileList | null;
  onDropFiles?: (files: FileList) => void;
  onPasteMediaReference?: (reference: { url: string; mimeType?: string | null }) => void;
  onPasteTextReference?: (text: string) => void;
  onAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  onAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
};

type UseReferenceGridDropControllerResult = {
  handleCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
};

/**
 * Returns canvas drag/drop handlers and installs document-level drag cleanup listeners.
 */
export const useReferenceGridDropController = ({
  canvasDragDepthRef,
  curatedDragDepthRef,
  setCanvasDropModeSafe,
  setCuratedDropActiveSafe,
  resolveCanvasDropMode,
  canAcceptCanvasDrag,
  normalizeMediaFiles,
  buildFileList,
  onDropFiles,
  onPasteMediaReference,
  onPasteTextReference,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
}: UseReferenceGridDropControllerArgs): UseReferenceGridDropControllerResult => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const clearDropState = () => {
      canvasDragDepthRef.current = 0;
      curatedDragDepthRef.current = 0;
      setCanvasDropModeSafe("none");
      setCuratedDropActiveSafe(false);
    };
    document.addEventListener("dragend", clearDropState);
    document.addEventListener("drop", clearDropState);
    return () => {
      document.removeEventListener("dragend", clearDropState);
      document.removeEventListener("drop", clearDropState);
    };
  }, [canvasDragDepthRef, curatedDragDepthRef, setCanvasDropModeSafe, setCuratedDropActiveSafe]);

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    canvasDragDepthRef.current = 0;
    setCanvasDropModeSafe("none");
    const transfer = event.dataTransfer;

    // Ignore drops that originate from existing reference cards to avoid creating duplicates/empties.
    if (
      hasInternalReferenceDragTypeHints(transfer) ||
      extractInternalReferenceDragPayload(transfer)?.outputId
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
    if (mediaLibraryPayload?.kind === "libraryMedia" && onAddLibraryMediaReference) {
      event.preventDefault();
      event.stopPropagation();
      onAddLibraryMediaReference(mediaLibraryPayload.payload);
      return;
    }
    if (mediaLibraryPayload?.kind === "libraryPrompt" && onAddLibraryPromptReference) {
      event.preventDefault();
      event.stopPropagation();
      onAddLibraryPromptReference(mediaLibraryPayload.payload);
      return;
    }

    const droppedMediaReference = getDroppedMediaReference(transfer);
    if (droppedMediaReference && onPasteMediaReference) {
      event.preventDefault();
      event.stopPropagation();
      onPasteMediaReference(droppedMediaReference);
      return;
    }

    const files = transfer.files;
    if (files && files.length > 0 && onDropFiles) {
      const mediaFiles = normalizeMediaFiles(Array.from(files));
      if (mediaFiles.length === 0) return;
      const fileList = buildFileList(mediaFiles);
      if (!fileList) return;
      event.preventDefault();
      event.stopPropagation();
      onDropFiles(fileList);
      return;
    }

    const droppedPromptText = extractDroppedPromptText(transfer);
    if (!droppedPromptText || !onPasteTextReference) return;
    event.preventDefault();
    event.stopPropagation();
    onPasteTextReference(droppedPromptText);
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const nextDropMode = resolveCanvasDropMode(event.dataTransfer);
    if (nextDropMode === "none") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setCanvasDropModeSafe(nextDropMode);
  };

  const handleCanvasDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    const nextDropMode = resolveCanvasDropMode(event.dataTransfer);
    if (nextDropMode === "none") return;
    event.preventDefault();
    canvasDragDepthRef.current += 1;
    setCanvasDropModeSafe(nextDropMode);
  };

  const handleCanvasDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDrag(event.dataTransfer)) return;
    event.preventDefault();
    canvasDragDepthRef.current = Math.max(0, canvasDragDepthRef.current - 1);
    if (canvasDragDepthRef.current === 0) {
      setCanvasDropModeSafe("none");
    }
  };

  return {
    handleCanvasDrop,
    handleCanvasDragOver,
    handleCanvasDragEnter,
    handleCanvasDragLeave,
  };
};
