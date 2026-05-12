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

/**
 * Returns stable card drag handlers with unchanged drag payload semantics.
 */
export const useReferenceGridCardDragController = (): UseReferenceGridCardDragControllerResult => {
  const handleCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      item: StudioOutput,
      sourceSurface: ReferenceDragSourceSurface,
      composerImageArtifact?: ReferenceComposerImageDragArtifact | null
    ) => {
      prepareReferenceDrag(event, item, {
        dragImage: event.currentTarget as HTMLElement,
        sourceSurface,
        composerImageArtifact,
      });
    },
    []
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    clearDragState(event);
  }, []);

  return {
    handleCardDragStart,
    handleCardDragEnd,
  };
};
