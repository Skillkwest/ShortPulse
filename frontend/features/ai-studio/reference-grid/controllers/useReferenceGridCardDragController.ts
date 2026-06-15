/**
 * Card drag controller for Reference Grid cards.
 * Keeps drag protocol wiring out of ReferenceGrid render composition.
 */
import { useCallback } from "react";
import type { StudioOutput } from "../../types";
import {
  clearDragState,
  prepareReferenceDrag,
  type ReferenceComposerImageDragArtifact,
  type ReferenceDragSourceSurface,
} from "../../utils/dragDrop";

type UseReferenceGridCardDragControllerResult = {
  handleCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface,
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null
  ) => void;
  handleCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
};

type UseReferenceGridCardDragControllerParams = {
  onReferenceCardDragActiveChange?: (active: boolean) => void;
};

/**
 * Returns stable card drag handlers with unchanged drag payload semantics.
 */
export const useReferenceGridCardDragController = ({
  onReferenceCardDragActiveChange,
}: UseReferenceGridCardDragControllerParams = {}): UseReferenceGridCardDragControllerResult => {
  const handleCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      item: StudioOutput,
      sourceSurface: ReferenceDragSourceSurface,
      composerImageArtifact?: ReferenceComposerImageDragArtifact | null
    ) => {
      onReferenceCardDragActiveChange?.(true);
      try {
        prepareReferenceDrag(event, item, {
          dragImage: event.currentTarget as HTMLElement,
          sourceSurface,
          composerImageArtifact,
        });
      } catch (error) {
        onReferenceCardDragActiveChange?.(false);
        throw error;
      }
    },
    [onReferenceCardDragActiveChange]
  );

  const handleCardDragEnd = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      clearDragState(event);
      onReferenceCardDragActiveChange?.(false);
    },
    [onReferenceCardDragActiveChange]
  );

  return {
    handleCardDragStart,
    handleCardDragEnd,
  };
};
