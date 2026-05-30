/**
 * Curated quick-slot drag/drop and keyboard-reorder controller.
 * Keeps curated interaction policies out of ReferenceGrid rendering/orchestration code.
 */
import { useCallback, type MutableRefObject } from "react";
import {
  hasMediaLibraryDragTypeHints,
  readMediaLibraryDragPayload,
  type MediaLibraryDragPayload,
} from "../../logic/mediaLibraryDragPayload";
import { getDroppedMediaReference } from "./referenceGridClipboard";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../referenceGridTypes";
import type { StudioOutput } from "../../types";
import {
  extractInternalReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  type ReferenceDragSourceSurface,
} from "../../utils/dragDrop";

type UseReferenceGridCuratedDndControllerArgs = {
  isCuratedSplitEnabled: boolean;
  curatedReferenceIds: string[];
  curatedDragDepthRef: MutableRefObject<number>;
  setCuratedDropActiveSafe: (next: boolean) => void;
  onAddCuratedReference?: (id: string) => void;
  onReorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "start" | "before" | "after" | "end"
  ) => void;
  onSelectOutput: (id: string) => void;
  onAddDroppedFilesToQuickSlot?: (
    files: FileList,
    options?: {
      targetId: string | null;
      placement: "start" | "before" | "after" | "end";
    }
  ) => Promise<string[]>;
  onAddLibraryMediaReferenceToQuickSlot?: (
    payload: LibraryMediaReferencePayload,
    options?: {
      targetId: string | null;
      placement: "start" | "before" | "after" | "end";
    }
  ) => Promise<string | null>;
  onAddLibraryPromptReferenceToQuickSlot?: (
    payload: LibraryPromptReferencePayload,
    options?: {
      targetId: string | null;
      placement: "start" | "before" | "after" | "end";
    }
  ) => string | null;
  onAddPastedMediaReferenceToQuickSlot?: (
    payload: { url: string; mimeType?: string | null },
    options?: {
      targetId: string | null;
      placement: "start" | "before" | "after" | "end";
    }
  ) => string | null;
};

type UseReferenceGridCuratedDndControllerResult = {
  handleCuratedSectionDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCuratedSectionDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedSectionDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedSectionDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedCardDrop: (event: React.DragEvent<HTMLElement>, target: StudioOutput) => void;
  handleCuratedCardKeyboardReorder: (id: string, direction: "up" | "down") => void;
};

const hasInternalReferenceDrag = (transfer: DataTransfer): boolean => {
  if (hasInternalReferenceDragTypeHints(transfer)) return true;
  const types = getNormalizedTransferTypes(transfer);
  const shouldProbeDegradedPayload =
    types.length === 0 || (types.length === 1 && types.includes("files"));
  if (!shouldProbeDegradedPayload) return false;
  return Boolean(
    extractInternalReferenceDragPayload(transfer) ?? transfer.getData("text/reference-id")
  );
};

const resolveReferenceDragOutputId = (transfer: DataTransfer): string => {
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  return (
    internalPayload?.outputId ??
    internalPayload?.referenceId ??
    transfer.getData("text/reference-id")
  ).trim();
};

const resolveReferenceDragSourceSurface = (transfer: DataTransfer): ReferenceDragSourceSurface => {
  const sourceSurfaceFromPayload = extractInternalReferenceDragPayload(transfer)?.sourceSurface;
  if (sourceSurfaceFromPayload) return sourceSurfaceFromPayload;
  const types = getNormalizedTransferTypes(transfer);
  if (types.length > 0 && !types.includes("text/reference-source-surface")) {
    return "all-refs";
  }
  const sourceSurface = transfer.getData("text/reference-source-surface");
  return sourceSurface === "curated" ? "curated" : "all-refs";
};

const readQuickSlotLibraryPayload = (transfer: DataTransfer): MediaLibraryDragPayload | null =>
  readMediaLibraryDragPayload(transfer);

const readDroppedFiles = (transfer: DataTransfer): FileList | null =>
  transfer.files && transfer.files.length > 0 ? transfer.files : null;

const hasDroppedFiles = (transfer: DataTransfer): boolean => {
  if (transfer.files?.length > 0) return true;
  return getNormalizedTransferTypes(transfer).includes("files");
};

const hasDroppedMediaReference = (transfer: DataTransfer): boolean =>
  Boolean(getDroppedMediaReference(transfer));

const hasQuickSlotStructuredDropHints = (transfer: DataTransfer): boolean =>
  hasInternalReferenceDrag(transfer) || hasMediaLibraryDragTypeHints(transfer);

/**
 * Returns curated-surface drag/drop and keyboard reorder handlers.
 */
export const useReferenceGridCuratedDndController = ({
  isCuratedSplitEnabled,
  curatedReferenceIds,
  curatedDragDepthRef,
  setCuratedDropActiveSafe,
  onAddCuratedReference,
  onReorderCuratedReference,
  onSelectOutput,
  onAddDroppedFilesToQuickSlot,
  onAddLibraryMediaReferenceToQuickSlot,
  onAddLibraryPromptReferenceToQuickSlot,
  onAddPastedMediaReferenceToQuickSlot,
}: UseReferenceGridCuratedDndControllerArgs): UseReferenceGridCuratedDndControllerResult => {
  const handleLibraryQuickSlotDrop = useCallback(
    (
      payload: MediaLibraryDragPayload,
      options: { targetId: string | null; placement: "start" | "before" | "after" | "end" }
    ) => {
      if (payload.kind === "libraryMedia") {
        void (async () => {
          const insertedId = await onAddLibraryMediaReferenceToQuickSlot?.(
            payload.payload,
            options
          );
          if (insertedId) {
            onSelectOutput(insertedId);
          }
        })();
        return true;
      }
      if (payload.kind === "libraryPrompt") {
        const insertedId = onAddLibraryPromptReferenceToQuickSlot?.(payload.payload, options);
        if (insertedId) {
          onSelectOutput(insertedId);
        }
        return true;
      }
      return false;
    },
    [onAddLibraryMediaReferenceToQuickSlot, onAddLibraryPromptReferenceToQuickSlot, onSelectOutput]
  );

  const handleQuickSlotFileDrop = useCallback(
    (
      transfer: DataTransfer,
      options: { targetId: string | null; placement: "start" | "before" | "after" | "end" }
    ) => {
      const droppedFiles = readDroppedFiles(transfer);
      if (!droppedFiles || !onAddDroppedFilesToQuickSlot) return false;
      void (async () => {
        const insertedIds = await onAddDroppedFilesToQuickSlot(droppedFiles, options);
        const activeId = insertedIds[insertedIds.length - 1];
        if (activeId) {
          onSelectOutput(activeId);
        }
      })();
      return true;
    },
    [onAddDroppedFilesToQuickSlot, onSelectOutput]
  );

  const handleQuickSlotMediaDrop = useCallback(
    (
      transfer: DataTransfer,
      options: { targetId: string | null; placement: "start" | "before" | "after" | "end" }
    ) => {
      const droppedMediaReference = getDroppedMediaReference(transfer);
      if (!droppedMediaReference || !onAddPastedMediaReferenceToQuickSlot) return false;
      const insertedId = onAddPastedMediaReferenceToQuickSlot(droppedMediaReference, options);
      if (insertedId) {
        onSelectOutput(insertedId);
      }
      return true;
    },
    [onAddPastedMediaReferenceToQuickSlot, onSelectOutput]
  );

  const handleCuratedSectionDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = 0;
      setCuratedDropActiveSafe(false);
      const mediaLibraryPayload = readQuickSlotLibraryPayload(event.dataTransfer);
      if (
        mediaLibraryPayload &&
        handleLibraryQuickSlotDrop(mediaLibraryPayload, {
          targetId: null,
          placement: "start",
        })
      ) {
        return;
      }
      if (hasInternalReferenceDrag(event.dataTransfer)) {
        const referenceId = resolveReferenceDragOutputId(event.dataTransfer);
        if (!referenceId) return;
        const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
        if (sourceSurface === "all-refs") {
          if (curatedReferenceIds.includes(referenceId)) {
            onSelectOutput(referenceId);
            return;
          }
          onAddCuratedReference?.(referenceId);
          onSelectOutput(referenceId);
          return;
        }
        onReorderCuratedReference?.(referenceId, null, "end");
        onSelectOutput(referenceId);
        return;
      }
      if (
        !hasQuickSlotStructuredDropHints(event.dataTransfer) &&
        handleQuickSlotMediaDrop(event.dataTransfer, {
          targetId: null,
          placement: "start",
        })
      ) {
        return;
      }
      if (
        !hasQuickSlotStructuredDropHints(event.dataTransfer) &&
        handleQuickSlotFileDrop(event.dataTransfer, {
          targetId: null,
          placement: "start",
        })
      ) {
        return;
      }
    },
    [
      curatedDragDepthRef,
      curatedReferenceIds,
      handleQuickSlotFileDrop,
      handleQuickSlotMediaDrop,
      handleLibraryQuickSlotDrop,
      isCuratedSplitEnabled,
      onAddCuratedReference,
      onReorderCuratedReference,
      onSelectOutput,
      setCuratedDropActiveSafe,
    ]
  );

  const handleCuratedSectionDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      const hasFilePayload =
        hasDroppedFiles(event.dataTransfer) && Boolean(onAddDroppedFilesToQuickSlot);
      const hasMediaReferencePayload =
        Boolean(onAddPastedMediaReferenceToQuickSlot) &&
        hasDroppedMediaReference(event.dataTransfer);
      const hasLibraryPayloadHint = hasMediaLibraryDragTypeHints(event.dataTransfer);
      if (
        !hasInternalReferenceDrag(event.dataTransfer) &&
        !hasLibraryPayloadHint &&
        !hasMediaReferencePayload &&
        !hasFilePayload
      ) {
        event.dataTransfer.dropEffect = "none";
        setCuratedDropActiveSafe(false);
        return;
      }
      if (hasLibraryPayloadHint) {
        event.dataTransfer.dropEffect = "copy";
        setCuratedDropActiveSafe(true);
        return;
      }
      if (hasMediaReferencePayload) {
        event.dataTransfer.dropEffect = "copy";
        setCuratedDropActiveSafe(true);
        return;
      }
      if (hasInternalReferenceDrag(event.dataTransfer)) {
        const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
        event.dataTransfer.dropEffect = sourceSurface === "curated" ? "move" : "copy";
        setCuratedDropActiveSafe(true);
        return;
      }
      if (hasFilePayload) {
        event.dataTransfer.dropEffect = "copy";
        setCuratedDropActiveSafe(true);
        return;
      }
    },
    [
      isCuratedSplitEnabled,
      onAddDroppedFilesToQuickSlot,
      onAddPastedMediaReferenceToQuickSlot,
      setCuratedDropActiveSafe,
    ]
  );

  const handleCuratedSectionDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current += 1;
      setCuratedDropActiveSafe(
        hasInternalReferenceDrag(event.dataTransfer) ||
          hasMediaLibraryDragTypeHints(event.dataTransfer) ||
          (Boolean(onAddPastedMediaReferenceToQuickSlot) &&
            hasDroppedMediaReference(event.dataTransfer)) ||
          (Boolean(onAddDroppedFilesToQuickSlot) && hasDroppedFiles(event.dataTransfer))
      );
    },
    [
      curatedDragDepthRef,
      isCuratedSplitEnabled,
      onAddDroppedFilesToQuickSlot,
      onAddPastedMediaReferenceToQuickSlot,
      setCuratedDropActiveSafe,
    ]
  );

  const handleCuratedSectionDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = Math.max(0, curatedDragDepthRef.current - 1);
      if (curatedDragDepthRef.current === 0) {
        setCuratedDropActiveSafe(false);
      }
    },
    [curatedDragDepthRef, isCuratedSplitEnabled, setCuratedDropActiveSafe]
  );

  const handleCuratedCardDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, target: StudioOutput): void => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = 0;
      setCuratedDropActiveSafe(false);
      const rect = event.currentTarget.getBoundingClientRect();
      const placement: "before" | "after" =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      const mediaLibraryPayload = readQuickSlotLibraryPayload(event.dataTransfer);
      if (mediaLibraryPayload) {
        handleLibraryQuickSlotDrop(mediaLibraryPayload, {
          targetId: target.id,
          placement,
        });
        return;
      }
      if (hasInternalReferenceDrag(event.dataTransfer)) {
        const referenceId = resolveReferenceDragOutputId(event.dataTransfer);
        if (!referenceId) return;
        const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
        if (sourceSurface === "all-refs") {
          if (curatedReferenceIds.includes(referenceId)) {
            onSelectOutput(referenceId);
            return;
          }
          onAddCuratedReference?.(referenceId);
          onReorderCuratedReference?.(referenceId, target.id, placement);
          onSelectOutput(referenceId);
          return;
        }
        onReorderCuratedReference?.(referenceId, target.id, placement);
        onSelectOutput(referenceId);
        return;
      }
      if (
        !hasQuickSlotStructuredDropHints(event.dataTransfer) &&
        handleQuickSlotMediaDrop(event.dataTransfer, {
          targetId: target.id,
          placement,
        })
      ) {
        return;
      }
      if (
        !hasQuickSlotStructuredDropHints(event.dataTransfer) &&
        handleQuickSlotFileDrop(event.dataTransfer, {
          targetId: target.id,
          placement,
        })
      ) {
        return;
      }
    },
    [
      curatedDragDepthRef,
      curatedReferenceIds,
      handleQuickSlotFileDrop,
      handleQuickSlotMediaDrop,
      handleLibraryQuickSlotDrop,
      isCuratedSplitEnabled,
      onAddCuratedReference,
      onReorderCuratedReference,
      onSelectOutput,
      setCuratedDropActiveSafe,
    ]
  );

  const handleCuratedCardKeyboardReorder = useCallback(
    (id: string, direction: "up" | "down") => {
      if (!isCuratedSplitEnabled || !onReorderCuratedReference) return;
      const currentIndex = curatedReferenceIds.indexOf(id);
      if (currentIndex < 0) return;
      if (direction === "up") {
        if (currentIndex === 0) return;
        const targetId = curatedReferenceIds[currentIndex - 1];
        onReorderCuratedReference(id, targetId, "before");
        onSelectOutput(id);
        return;
      }
      if (currentIndex >= curatedReferenceIds.length - 1) return;
      const targetId = curatedReferenceIds[currentIndex + 1];
      onReorderCuratedReference(id, targetId, "after");
      onSelectOutput(id);
    },
    [curatedReferenceIds, isCuratedSplitEnabled, onReorderCuratedReference, onSelectOutput]
  );

  return {
    handleCuratedSectionDrop,
    handleCuratedSectionDragOver,
    handleCuratedSectionDragEnter,
    handleCuratedSectionDragLeave,
    handleCuratedCardDrop,
    handleCuratedCardKeyboardReorder,
  };
};
