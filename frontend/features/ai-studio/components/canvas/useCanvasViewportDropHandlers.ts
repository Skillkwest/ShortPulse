/**
 * Encapsulates drag/drop behavior for a single Canvas viewport instance.
 */
import { useCallback, useRef, useState, type DragEvent, type RefObject } from "react";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import {
  canAcceptCanvasDropTransfer,
  extractCanvasDroppedText,
  resolveCanvasDropClientPoint,
} from "./canvasDropController";
import {
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
  viewportPointToCanvasWorld,
} from "./canvasGeometry";
import type {
  CanvasCamera,
  CanvasDropResolution,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDropReference,
} from "./canvasTypes";

type UseCanvasViewportDropHandlersParams = {
  viewportRef: RefObject<HTMLDivElement | null>;
  camera: CanvasCamera;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
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
  prepareResolvedInternalCanvasDrop,
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
      const preparedResolved = prepareResolvedInternalCanvasDrop
        ? await prepareResolvedInternalCanvasDrop(payload, resolved)
        : resolved;
      if (!preparedResolved) return false;
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveCanvasDropClientPoint({ clientX, clientY, rect });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      await addResolvedItem(preparedResolved, point.x, point.y, {
        showLoadingPlaceholder: true,
      });
      return true;
    },
    [
      addResolvedItem,
      camera,
      prepareResolvedInternalCanvasDrop,
      resolveCanvasDropReference,
      viewportRef,
    ]
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
      const transfer = event.dataTransfer;
      if (!viewportRef.current) return;
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
      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (mediaLibraryPayload) {
        event.preventDefault();
        event.stopPropagation();
        if (mediaLibraryPayload.kind === "libraryMedia") {
          const previewSrc =
            (mediaLibraryPayload.payload.fullUrl ?? "").trim() ||
            (mediaLibraryPayload.payload.previewUrl ?? "").trim() ||
            (mediaLibraryPayload.payload.url ?? "").trim();
          if (!previewSrc) return;
          const payloadWithDimensions =
            mediaLibraryPayload.payload as typeof mediaLibraryPayload.payload & {
              width?: number;
              height?: number;
            };
          const fallbackWidth =
            typeof payloadWithDimensions.width === "number" &&
            Number.isFinite(payloadWithDimensions.width) &&
            payloadWithDimensions.width > 0
              ? payloadWithDimensions.width
              : CANVAS_IMAGE_ITEM_WIDTH;
          const fallbackHeight =
            typeof payloadWithDimensions.height === "number" &&
            Number.isFinite(payloadWithDimensions.height) &&
            payloadWithDimensions.height > 0
              ? payloadWithDimensions.height
              : CANVAS_IMAGE_ITEM_HEIGHT;
          void addResolvedItem(
            {
              kind: "image",
              outputId: null,
              mediaId: mediaLibraryPayload.payload.id,
              src: previewSrc,
              alt: (mediaLibraryPayload.payload.filename || "Canvas media").trim(),
              width: fallbackWidth,
              height: fallbackHeight,
            },
            point.x,
            point.y,
            {
              showLoadingPlaceholder: true,
            }
          );
          return;
        }
        const promptText = mediaLibraryPayload.payload.promptText.trim();
        if (!promptText) return;
        void addResolvedItem(
          {
            kind: "text",
            outputId: mediaLibraryPayload.payload.id
              ? `prompt:${mediaLibraryPayload.payload.id}`
              : null,
            text: promptText,
          },
          point.x,
          point.y,
          {
            showLoadingPlaceholder: true,
          }
        );
        return;
      }
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      if (internalPayload) {
        event.preventDefault();
        event.stopPropagation();
        void handleResolvedInternalDrop(internalPayload, event.clientX, event.clientY);
        return;
      }
      const droppedText = extractCanvasDroppedText(event.dataTransfer);
      if (!droppedText) return;
      event.preventDefault();
      event.stopPropagation();
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
