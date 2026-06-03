/**
 * Encapsulates drag/drop behavior for a single Canvas viewport instance.
 */
import { useCallback, useRef, useState, type DragEvent, type RefObject } from "react";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import { getDroppedMediaReference } from "../../reference-grid/controllers/referenceGridClipboard";
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
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
} from "./canvasGeometry";
import { viewportPointToCanvasWorld } from "./canvasGeometry";
import type {
  CanvasCamera,
  CanvasPreparedDrop,
  CanvasDropResolution,
  CanvasInsertResult,
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "./canvasTypes";

type UseCanvasViewportDropHandlersParams = {
  viewportRef: RefObject<HTMLDivElement | null>;
  camera: CanvasCamera;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDroppedMediaReference?: ResolveCanvasDroppedMediaReference;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  addResolvedItem: (
    resolved: CanvasDropResolution,
    worldX: number,
    worldY: number,
    options?: { showLoadingPlaceholder?: boolean }
  ) => Promise<CanvasInsertResult>;
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
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  addResolvedItem,
}: UseCanvasViewportDropHandlersParams): CanvasDropHandlers => {
  const dragDepthRef = useRef(0);
  const [isDropActive, setIsDropActive] = useState(false);

  const normalizePreparedDrop = useCallback(
    (
      prepared: CanvasPreparedDrop
    ): {
      resolved: CanvasDropResolution;
      afterInsert?: (result: CanvasInsertResult) => Promise<void> | void;
    } => {
      if ("resolved" in prepared) {
        return {
          resolved: prepared.resolved,
          afterInsert: prepared.afterInsert,
        };
      }
      return { resolved: prepared };
    },
    []
  );

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
      const preparedDrop = prepareResolvedInternalCanvasDrop
        ? await prepareResolvedInternalCanvasDrop(payload, resolved)
        : resolved;
      if (!preparedDrop) return false;
      if (!dropPoint) return false;
      const normalizedPreparedDrop = normalizePreparedDrop(preparedDrop);
      const insertResult = await addResolvedItem(
        normalizedPreparedDrop.resolved,
        dropPoint.x,
        dropPoint.y,
        {
          showLoadingPlaceholder: true,
        }
      );
      await normalizedPreparedDrop.afterInsert?.(insertResult);
      return true;
    },
    [
      addResolvedItem,
      normalizePreparedDrop,
      prepareResolvedInternalCanvasDrop,
      resolveCanvasDropReference,
    ]
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
        void (async () => {
          const preparedDrop = prepareCanvasMediaLibraryDrop
            ? await prepareCanvasMediaLibraryDrop(mediaLibraryPayload)
            : mediaLibraryPayload.kind === "libraryPrompt"
              ? (() => {
                  const promptText = mediaLibraryPayload.payload.promptText.trim();
                  if (!promptText) return null;
                  return {
                    kind: "text" as const,
                    outputId: mediaLibraryPayload.payload.id
                      ? `prompt:${mediaLibraryPayload.payload.id}`
                      : null,
                    text: promptText,
                  };
                })()
              : (() => {
                  const previewSrc =
                    mediaLibraryPayload.payload.previewUrl?.trim() ||
                    mediaLibraryPayload.payload.url?.trim() ||
                    mediaLibraryPayload.payload.fullUrl?.trim();
                  if (!previewSrc) return null;
                  if (mediaLibraryPayload.payload.fileType === "audio") {
                    return {
                      kind: "audio" as const,
                      outputId: null,
                      mediaId: mediaLibraryPayload.payload.id,
                      audioUrl: previewSrc,
                      title:
                        (
                          mediaLibraryPayload.payload.filename ||
                          mediaLibraryPayload.payload.promptText ||
                          "Canvas audio"
                        ).trim() || null,
                      companionArtUrl: mediaLibraryPayload.payload.companionArtUrl ?? null,
                      companionArtStoragePath:
                        mediaLibraryPayload.payload.companionArtStoragePath ?? null,
                      audioSourceMode: mediaLibraryPayload.payload.audioSourceMode ?? null,
                      durationMs: mediaLibraryPayload.payload.durationMs ?? null,
                      waveformPeaks: mediaLibraryPayload.payload.waveformPeaks ?? null,
                      width: CANVAS_AUDIO_ITEM_WIDTH,
                      height: CANVAS_AUDIO_ITEM_HEIGHT,
                    };
                  }

                  const width =
                    typeof mediaLibraryPayload.payload.width === "number" &&
                    Number.isFinite(mediaLibraryPayload.payload.width) &&
                    mediaLibraryPayload.payload.width > 0
                      ? mediaLibraryPayload.payload.width
                      : CANVAS_IMAGE_ITEM_WIDTH;
                  const height =
                    typeof mediaLibraryPayload.payload.height === "number" &&
                    Number.isFinite(mediaLibraryPayload.payload.height) &&
                    mediaLibraryPayload.payload.height > 0
                      ? mediaLibraryPayload.payload.height
                      : CANVAS_IMAGE_ITEM_HEIGHT;

                  if (mediaLibraryPayload.payload.fileType === "video") {
                    return {
                      kind: "video" as const,
                      outputId: null,
                      mediaId: mediaLibraryPayload.payload.id,
                      videoUrl: previewSrc,
                      posterUrl: mediaLibraryPayload.payload.previewPosterUrl ?? null,
                      title:
                        (
                          mediaLibraryPayload.payload.filename ||
                          mediaLibraryPayload.payload.promptText ||
                          "Canvas video"
                        ).trim() || null,
                      durationMs: mediaLibraryPayload.payload.durationMs ?? null,
                      width,
                      height,
                    };
                  }

                  return {
                    kind: "image" as const,
                    outputId: null,
                    mediaId: mediaLibraryPayload.payload.id,
                    src: previewSrc,
                    alt: (
                      mediaLibraryPayload.payload.filename ||
                      mediaLibraryPayload.payload.promptText ||
                      "Canvas media"
                    ).trim(),
                    width,
                    height,
                  };
                })();
          if (!preparedDrop) return;
          const normalizedPreparedDrop = normalizePreparedDrop(preparedDrop);
          const insertResult = await addResolvedItem(
            normalizedPreparedDrop.resolved,
            point.x,
            point.y,
            {
              showLoadingPlaceholder: true,
            }
          );
          await normalizedPreparedDrop.afterInsert?.(insertResult);
        })();
        return;
      }
      const droppedMediaReference = getDroppedMediaReference(transfer);
      if (droppedMediaReference && resolveCanvasDroppedMediaReference) {
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          const resolvedItem = await resolveCanvasDroppedMediaReference(droppedMediaReference);
          if (!resolvedItem) return;
          await addResolvedItem(resolvedItem, point.x, point.y, {
            showLoadingPlaceholder: true,
          });
        })();
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
      normalizePreparedDrop,
      resolveCanvasDroppedMediaReference,
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
