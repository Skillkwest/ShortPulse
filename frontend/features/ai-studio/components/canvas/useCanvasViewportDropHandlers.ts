/**
 * Encapsulates drag/drop behavior for a single Canvas viewport instance.
 */
import { useCallback, useRef, useState, type DragEvent, type RefObject } from "react";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractInternalReferenceDragPayload,
  getNormalizedTransferTypes,
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
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "./canvasTypes";

type UseCanvasViewportDropHandlersParams = {
  viewportRef: RefObject<HTMLDivElement | null>;
  camera: CanvasCamera;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
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
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDropFiles,
  addResolvedItem,
}: UseCanvasViewportDropHandlersParams): CanvasDropHandlers => {
  const dragDepthRef = useRef(0);
  const [isDropActive, setIsDropActive] = useState(false);

  const logUnresolvedInternalDrop = useCallback(
    (
      payload: InternalReferenceDragPayload,
      reason: "resolve_miss" | "resolver_exception",
      errorMessage?: string
    ) => {
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "canvas.internal_drop.unresolved",
        data: {
          reason,
          outputId: payload.outputId ?? null,
          referenceId: payload.referenceId ?? null,
          mediaId: payload.mediaId ?? null,
          sourceSurface: payload.sourceSurface ?? null,
          imageIndex: payload.imageIndex,
          hasReferenceUrl: Boolean(payload.referenceUrl),
          errorMessage: errorMessage ?? null,
        },
      });
    },
    []
  );

  const handleResolvedInternalDrop = useCallback(
    async (
      payload: InternalReferenceDragPayload,
      dropPoint?: { x: number; y: number }
    ): Promise<boolean> => {
      if (!resolveCanvasDropReference) return false;
      const resolved = resolveCanvasDropReference(payload);
      if (!resolved) return false;
      const preparedResolved = prepareResolvedInternalCanvasDrop
        ? await prepareResolvedInternalCanvasDrop(payload, resolved)
        : resolved;
      if (!preparedResolved) return false;
      if (!dropPoint) return false;
      await addResolvedItem(preparedResolved, dropPoint.x, dropPoint.y, {
        showLoadingPlaceholder: true,
      });
      return true;
    },
    [addResolvedItem, prepareResolvedInternalCanvasDrop, resolveCanvasDropReference]
  );

  const canHandleViewportTransfer = useCallback(
    (transfer: DataTransfer | null | undefined): boolean => {
      if (!transfer) return false;
      if (canAcceptCanvasDropTransfer(transfer)) return true;
      const transferTypes = getNormalizedTransferTypes(transfer);
      const hasFilesType = transferTypes.includes("files");
      const hasDroppedFiles = (transfer.files?.length ?? 0) > 0;
      if (hasDroppedFiles || hasFilesType) {
        return Boolean(resolveCanvasDropFiles);
      }
      return false;
    },
    [resolveCanvasDropFiles]
  );

  const onViewportDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canHandleViewportTransfer(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDropActive(true);
    },
    [canHandleViewportTransfer]
  );

  const onViewportDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canHandleViewportTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDropActive) {
        setIsDropActive(true);
      }
    },
    [canHandleViewportTransfer, isDropActive]
  );

  const onViewportDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canHandleViewportTransfer(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDropActive(false);
      }
    },
    [canHandleViewportTransfer]
  );

  const onViewportDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsDropActive(false);
      const transfer = event.dataTransfer;
      if (!viewportRef.current) return;
      const internalPayload = extractInternalReferenceDragPayload(transfer);
      if (internalPayload) {
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
        void (async () => {
          try {
            const wasHandled = await handleResolvedInternalDrop(internalPayload, point);
            if (!wasHandled) {
              logUnresolvedInternalDrop(internalPayload, "resolve_miss");
            }
          } catch (error) {
            logUnresolvedInternalDrop(
              internalPayload,
              "resolver_exception",
              error instanceof Error ? error.message : String(error)
            );
          }
        })();
        return;
      }
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
        if (prepareCanvasMediaLibraryDrop) {
          void (async () => {
            const resolvedItem = await prepareCanvasMediaLibraryDrop(mediaLibraryPayload);
            if (!resolvedItem) return;
            await addResolvedItem(resolvedItem, point.x, point.y, {
              showLoadingPlaceholder: true,
            });
          })();
          return;
        }
        if (mediaLibraryPayload.kind === "libraryMedia") {
          const previewSrc =
            (mediaLibraryPayload.payload.fullUrl ?? "").trim() ||
            (mediaLibraryPayload.payload.previewUrl ?? "").trim() ||
            (mediaLibraryPayload.payload.url ?? "").trim();
          if (!previewSrc) return;
          if (mediaLibraryPayload.payload.fileType === "audio") {
            void addResolvedItem(
              {
                kind: "audio",
                outputId: null,
                mediaId: mediaLibraryPayload.payload.id,
                audioUrl: previewSrc,
                title:
                  (
                    mediaLibraryPayload.payload.filename ||
                    mediaLibraryPayload.payload.promptText ||
                    "Canvas audio"
                  ).trim() || null,
                width: CANVAS_IMAGE_ITEM_WIDTH,
                height: CANVAS_IMAGE_ITEM_HEIGHT,
              },
              point.x,
              point.y,
              {
                showLoadingPlaceholder: true,
              }
            );
            return;
          }
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
      const droppedFiles = transfer.files;
      if (droppedFiles && droppedFiles.length > 0 && resolveCanvasDropFiles) {
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          const resolvedItems = await resolveCanvasDropFiles(droppedFiles);
          if (!resolvedItems?.length) return;
          const offsetStep = 24;
          for (let index = 0; index < resolvedItems.length; index += 1) {
            const resolvedItem = resolvedItems[index];
            const offset = index * offsetStep;
            await addResolvedItem(resolvedItem, point.x + offset, point.y + offset, {
              showLoadingPlaceholder: true,
            });
          }
        })();
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
    [
      addResolvedItem,
      camera,
      handleResolvedInternalDrop,
      logUnresolvedInternalDrop,
      prepareCanvasMediaLibraryDrop,
      resolveCanvasDropFiles,
      viewportRef,
    ]
  );

  return {
    isDropActive,
    onViewportDragEnter,
    onViewportDragOver,
    onViewportDragLeave,
    onViewportDrop,
  };
};
