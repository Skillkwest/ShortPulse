/**
 * Canvas drag/drop controller for Reference Grid.
 * Encapsulates drop-mode transitions and global drag cleanup outside the render component.
 */
import { useEffect, type MutableRefObject } from "react";
import { extractDroppedPromptText } from "./referenceGridClipboard";

export type ReferenceCanvasDropMode = "none" | "text" | "files";

type UseReferenceGridCanvasDropControllerArgs = {
  canvasDragDepthRef: MutableRefObject<number>;
  curatedDragDepthRef: MutableRefObject<number>;
  setCanvasDropModeSafe: (next: ReferenceCanvasDropMode) => void;
  setCuratedDropActiveSafe: (next: boolean) => void;
  resolveCanvasDropMode: (transfer: DataTransfer) => ReferenceCanvasDropMode;
  canAcceptCanvasDrag: (transfer: DataTransfer) => boolean;
  normalizeMediaFiles: (files: File[]) => File[];
  buildFileList: (files: File[]) => FileList | null;
  onDropFiles?: (files: FileList) => void;
  onPasteTextReference?: (text: string) => void;
};

type UseReferenceGridCanvasDropControllerResult = {
  handleCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCanvasDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
};

/**
 * Returns canvas drag/drop handlers and installs document-level drag cleanup listeners.
 */
export const useReferenceGridCanvasDropController = ({
  canvasDragDepthRef,
  curatedDragDepthRef,
  setCanvasDropModeSafe,
  setCuratedDropActiveSafe,
  resolveCanvasDropMode,
  canAcceptCanvasDrag,
  normalizeMediaFiles,
  buildFileList,
  onDropFiles,
  onPasteTextReference,
}: UseReferenceGridCanvasDropControllerArgs): UseReferenceGridCanvasDropControllerResult => {
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

    // Ignore drops that originate from existing reference cards to avoid creating duplicates/empties.
    const internalRefId = event.dataTransfer.getData("text/reference-id");
    if (internalRefId) {
      event.preventDefault();
      return;
    }
    const files = event.dataTransfer.files;
    if (files && files.length > 0 && onDropFiles) {
      const mediaFiles = normalizeMediaFiles(Array.from(files));
      if (mediaFiles.length === 0) return;
      const fileList = buildFileList(mediaFiles);
      if (!fileList) return;
      event.preventDefault();
      onDropFiles(fileList);
      return;
    }

    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText || !onPasteTextReference) return;
    event.preventDefault();
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
