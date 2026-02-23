/**
 * Curated quick-slot drag/drop and keyboard-reorder controller.
 * Keeps curated interaction policies out of ReferenceCanvas rendering/orchestration code.
 */
import { useCallback, type MutableRefObject } from "react";
import type { StudioOutput } from "../../types";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";

type UseReferenceGridCuratedDndControllerArgs = {
  isCuratedSplitEnabled: boolean;
  curatedReferenceIds: string[];
  curatedDragDepthRef: MutableRefObject<number>;
  setCuratedDropActiveSafe: (next: boolean) => void;
  onAddCuratedReference?: (id: string) => void;
  onReorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  onSelectOutput: (id: string) => void;
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
  const types = Array.from(transfer.types || []).map((value) => value.toLowerCase());
  if (types.includes("text/reference-id")) return true;
  return Boolean(transfer.getData("text/reference-id"));
};

const resolveReferenceDragSourceSurface = (transfer: DataTransfer): ReferenceDragSourceSurface => {
  const sourceSurface = transfer.getData("text/reference-source-surface");
  return sourceSurface === "curated" ? "curated" : "all-refs";
};

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
}: UseReferenceGridCuratedDndControllerArgs): UseReferenceGridCuratedDndControllerResult => {
  const handleCuratedSectionDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = 0;
      setCuratedDropActiveSafe(false);
      const referenceId = event.dataTransfer.getData("text/reference-id").trim();
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
    },
    [
      curatedDragDepthRef,
      curatedReferenceIds,
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
      if (!hasInternalReferenceDrag(event.dataTransfer)) {
        event.dataTransfer.dropEffect = "none";
        setCuratedDropActiveSafe(false);
        return;
      }
      const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
      event.dataTransfer.dropEffect = sourceSurface === "curated" ? "move" : "copy";
      setCuratedDropActiveSafe(true);
    },
    [isCuratedSplitEnabled, setCuratedDropActiveSafe]
  );

  const handleCuratedSectionDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current += 1;
      setCuratedDropActiveSafe(hasInternalReferenceDrag(event.dataTransfer));
    },
    [curatedDragDepthRef, isCuratedSplitEnabled, setCuratedDropActiveSafe]
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
      const referenceId = event.dataTransfer.getData("text/reference-id").trim();
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
      const rect = event.currentTarget.getBoundingClientRect();
      const placement: "before" | "after" =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      onReorderCuratedReference?.(referenceId, target.id, placement);
      onSelectOutput(referenceId);
    },
    [
      curatedDragDepthRef,
      curatedReferenceIds,
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
