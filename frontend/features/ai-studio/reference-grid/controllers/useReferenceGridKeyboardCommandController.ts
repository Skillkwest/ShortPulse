/**
 * Keyboard command controller for Reference Grid surfaces.
 * Owns selection-scoped document key handling without duplicating delete semantics.
 */
import { useEffect, useMemo, type MutableRefObject } from "react";
import {
  getReferencePasteSurfaces,
  isEditableElement,
  isNodeInsideAnySurface,
} from "./referenceGridClipboard";

export type ReferenceGridKeyboardSelectionSurface = "quick-slot" | "reference-grid";

type UseReferenceGridKeyboardCommandControllerArgs = {
  panelRef: MutableRefObject<HTMLDivElement | null>;
  selectedSurfaceRef: MutableRefObject<ReferenceGridKeyboardSelectionSurface | null>;
  activeOutputId: string | null | undefined;
  visibleOutputIds: readonly string[];
  visibleCuratedOutputIds: readonly string[];
  showReferenceGridSection: boolean;
  showQuickSlotSection: boolean;
  isAnyModalOpen: boolean;
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
};

const isReferenceRemovalKey = (event: KeyboardEvent): boolean =>
  event.key === "Delete" || event.key === "Backspace";

const shouldIgnoreReferenceRemovalKey = (event: KeyboardEvent): boolean =>
  event.defaultPrevented ||
  !isReferenceRemovalKey(event) ||
  event.altKey ||
  event.ctrlKey ||
  event.metaKey ||
  event.shiftKey;

const isKeyboardEventInsideReferenceGridSurface = (
  event: KeyboardEvent,
  panelNode: HTMLDivElement
): boolean => {
  const surfaces = getReferencePasteSurfaces(panelNode);
  const targetNode = event.target instanceof Node ? event.target : null;
  const activeNode = document.activeElement instanceof Node ? document.activeElement : null;
  return (
    isNodeInsideAnySurface(targetNode, surfaces) || isNodeInsideAnySurface(activeNode, surfaces)
  );
};

/**
 * Installs selected-reference Delete handling for Quick Slot and All Refs surfaces.
 */
export const useReferenceGridKeyboardCommandController = ({
  panelRef,
  selectedSurfaceRef,
  activeOutputId,
  visibleOutputIds,
  visibleCuratedOutputIds,
  showReferenceGridSection,
  showQuickSlotSection,
  isAnyModalOpen,
  onDeleteOutput,
  onRemoveCuratedReference,
}: UseReferenceGridKeyboardCommandControllerArgs) => {
  const visibleOutputIdSet = useMemo(() => new Set(visibleOutputIds), [visibleOutputIds]);
  const visibleCuratedOutputIdSet = useMemo(
    () => new Set(visibleCuratedOutputIds),
    [visibleCuratedOutputIds]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreReferenceRemovalKey(event)) return;
      if (isAnyModalOpen) return;

      const panelNode = panelRef.current;
      if (!panelNode) return;

      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (isEditableElement(targetElement) || isEditableElement(activeElement)) return;
      if (!isKeyboardEventInsideReferenceGridSurface(event, panelNode)) return;

      const selectedOutputId = activeOutputId?.trim();
      if (!selectedOutputId) return;

      const selectedSurface = selectedSurfaceRef.current;
      if (selectedSurface === "quick-slot") {
        if (
          !showQuickSlotSection ||
          !visibleCuratedOutputIdSet.has(selectedOutputId) ||
          !onRemoveCuratedReference
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onRemoveCuratedReference(selectedOutputId);
        return;
      }

      if (selectedSurface === "reference-grid") {
        if (
          !showReferenceGridSection ||
          !visibleOutputIdSet.has(selectedOutputId) ||
          !onDeleteOutput
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDeleteOutput(selectedOutputId);
      }
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [
    activeOutputId,
    isAnyModalOpen,
    onDeleteOutput,
    onRemoveCuratedReference,
    panelRef,
    selectedSurfaceRef,
    showQuickSlotSection,
    showReferenceGridSection,
    visibleCuratedOutputIdSet,
    visibleOutputIdSet,
  ]);
};
