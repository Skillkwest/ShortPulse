/**
 * Encapsulates drag/drop behavior for a single Canvas viewport instance.
 */
import { useCallback, useRef, useState, type DragEvent, type RefObject } from "react";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import {
  canAcceptCanvasDropTransfer,
  extractCanvasDroppedText,
  resolveCanvasDropClientPoint,
} from "./canvasDropController";
import { viewportPointToCanvasWorld } from "./canvasGeometry";
import type { CanvasCamera, CanvasDropResolution, ResolveCanvasDropReference } from "./canvasTypes";

type UseCanvasViewportDropHandlersParams = {
  viewportRef: RefObject<HTMLDivElement | null>;
  camera: CanvasCamera;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  addResolvedItem: (
    resolved: CanvasDropResolution,
    worldX: number,
    worldY: number,
    options?: { showLoadingPlaceholder?: boolean }
  ) => Promise<void>;
};

type CanvasDropHandlers = {
  isDropActive: boolean;
  onViewportDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDrop: (event: DragEvent<HTMLDivElement>) => void;
};

/**
 * Returns drop-active state and drag/drop handlers for a viewport surface.
 */
export const useCanvasViewportDropHandlers = ({
  viewportRef,
  camera,
  resolveCanvasDropReference,
  addResolvedItem,
}: UseCanvasViewportDropHandlersParams): CanvasDropHandlers => {
  const dragDepthRef = useRef(0);
  const [isDropActive, setIsDropActive] = useState(false);

  const handleResolvedInternalDrop = useCallback(
    async (
      payload: InternalReferenceDragPayload,
      clientX: number,
      clientY: number
    ): Promise<boolean> => {
      if (!resolveCanvasDropReference || !viewportRef.current) return false;
      const resolved = resolveCanvasDropReference(payload);
      if (!resolved) return false;
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveCanvasDropClientPoint({ clientX, clientY, rect });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      await addResolvedItem(resolved, point.x, point.y, {
        showLoadingPlaceholder: true,
      });
      return true;
    },
    [addResolvedItem, camera, resolveCanvasDropReference, viewportRef]
  );

  const onViewportDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDropActive(true);
  }, []);

  const onViewportDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDropActive) {
        setIsDropActive(true);
      }
    },
    [isDropActive]
  );

  const onViewportDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDropActive(false);
    }
  }, []);

  const onViewportDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsDropActive(false);
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      if (internalPayload) {
        event.preventDefault();
        event.stopPropagation();
        void handleResolvedInternalDrop(internalPayload, event.clientX, event.clientY);
        return;
      }
      const droppedText = extractCanvasDroppedText(event.dataTransfer);
      if (!droppedText || !viewportRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveCanvasDropClientPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
      });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      void addResolvedItem(
        {
          kind: "text",
          outputId: null,
          text: droppedText,
        },
        point.x,
        point.y,
        {
          showLoadingPlaceholder: true,
        }
      );
    },
    [addResolvedItem, camera, handleResolvedInternalDrop, viewportRef]
  );

  return {
    isDropActive,
    onViewportDragEnter,
    onViewportDragOver,
    onViewportDragLeave,
    onViewportDrop,
  };
};
