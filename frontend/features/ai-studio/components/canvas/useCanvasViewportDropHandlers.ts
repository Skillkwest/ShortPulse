/**
 * Encapsulates drag/drop behavior for a single Canvas viewport instance.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import {
  buildAiStudioDropSnapshotTransfer,
  captureAiStudioDropSnapshot,
} from "../../logic/aiStudioDropSnapshot";
import {
  readMediaLibraryBulkMediaDragPayload,
  readMediaLibraryDragPayload,
} from "../../logic/mediaLibraryDragPayload";
import { sanitizeStoredWaveformPeaks } from "../../reference-grid/logic/referenceGridAudioWaveform";
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
  getAvailableItemSlots: () => number;
  notifyItemLimitReached: () => void;
};

type CanvasDropHandlers = {
  isDropActive: boolean;
  isDropResolving: boolean;
  dropFeedback: { id: string; message: string } | null;
  onViewportDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDrop: (event: DragEvent<HTMLDivElement>) => void;
};

const CANVAS_DROP_RESOLVING_FAILSAFE_MS = 8000;
const CANVAS_DROP_FEEDBACK_TIMEOUT_MS = 3600;

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
  getAvailableItemSlots,
  notifyItemLimitReached,
}: UseCanvasViewportDropHandlersParams): CanvasDropHandlers => {
  const dragDepthRef = useRef(0);
  const dropResolvingCountRef = useRef(0);
  const dropResolvingTimeoutRef = useRef<number | null>(null);
  const dropFeedbackTimeoutRef = useRef<number | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isDropResolving, setIsDropResolving] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<{ id: string; message: string } | null>(null);

  const clearDropResolvingTimeout = useCallback(() => {
    if (dropResolvingTimeoutRef.current != null) {
      window.clearTimeout(dropResolvingTimeoutRef.current);
      dropResolvingTimeoutRef.current = null;
    }
  }, []);

  const clearDropFeedbackTimeout = useCallback(() => {
    if (dropFeedbackTimeoutRef.current != null) {
      window.clearTimeout(dropFeedbackTimeoutRef.current);
      dropFeedbackTimeoutRef.current = null;
    }
  }, []);

  const clearDropFeedback = useCallback(() => {
    clearDropFeedbackTimeout();
    setDropFeedback(null);
  }, [clearDropFeedbackTimeout]);

  const showDropFeedback = useCallback(
    (message: string) => {
      clearDropFeedbackTimeout();
      setDropFeedback({ id: `${Date.now()}:${message}`, message });
      dropFeedbackTimeoutRef.current = window.setTimeout(() => {
        dropFeedbackTimeoutRef.current = null;
        setDropFeedback(null);
      }, CANVAS_DROP_FEEDBACK_TIMEOUT_MS);
    },
    [clearDropFeedbackTimeout]
  );

  const beginDropResolving = useCallback(() => {
    dropResolvingCountRef.current += 1;
    setIsDropResolving(true);
    clearDropResolvingTimeout();
    dropResolvingTimeoutRef.current = window.setTimeout(() => {
      dropResolvingCountRef.current = 0;
      dropResolvingTimeoutRef.current = null;
      setIsDropResolving(false);
    }, CANVAS_DROP_RESOLVING_FAILSAFE_MS);
  }, [clearDropResolvingTimeout]);

  const endDropResolving = useCallback(() => {
    dropResolvingCountRef.current = Math.max(0, dropResolvingCountRef.current - 1);
    if (dropResolvingCountRef.current > 0) return;
    clearDropResolvingTimeout();
    setIsDropResolving(false);
  }, [clearDropResolvingTimeout]);

  const runDropResolvingTask = useCallback(
    async (task: () => Promise<void>): Promise<void> => {
      beginDropResolving();
      try {
        await task();
      } finally {
        endDropResolving();
      }
    },
    [beginDropResolving, endDropResolving]
  );

  useEffect(
    () => () => {
      clearDropResolvingTimeout();
      clearDropFeedbackTimeout();
      dropResolvingCountRef.current = 0;
    },
    [clearDropFeedbackTimeout, clearDropResolvingTimeout]
  );

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
      clearDropFeedback();
      dragDepthRef.current += 1;
      setIsDropActive(true);
    },
    [canHandleViewportTransfer, clearDropFeedback]
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
      const originalTransfer = event.dataTransfer;
      const transfer = buildAiStudioDropSnapshotTransfer(
        captureAiStudioDropSnapshot(originalTransfer)
      );
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
        void runDropResolvingTask(async () => {
          try {
            const wasHandled = await handleResolvedInternalDrop(internalPayload, point);
            if (!wasHandled) {
              logUnresolvedInternalDrop(internalPayload, "resolve_miss");
              showDropFeedback("Unable to add that reference to the canvas.");
            }
          } catch (error) {
            logUnresolvedInternalDrop(
              internalPayload,
              "resolver_exception",
              error instanceof Error ? error.message : String(error)
            );
            showDropFeedback("Unable to add that reference to the canvas.");
          }
        });
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
      const bulkMediaLibraryPayload = readMediaLibraryBulkMediaDragPayload(transfer);
      if (bulkMediaLibraryPayload) {
        event.preventDefault();
        event.stopPropagation();
        const availableItemSlots = getAvailableItemSlots();
        if (availableItemSlots <= 0) {
          notifyItemLimitReached();
          return;
        }
        const insertablePayloads = bulkMediaLibraryPayload.payload.items.slice(
          0,
          availableItemSlots
        );
        const skippedPayloadCount =
          bulkMediaLibraryPayload.payload.items.length - insertablePayloads.length;
        void runDropResolvingTask(async () => {
          const preparedDrops: {
            resolved: CanvasDropResolution;
            afterInsert?: (result: CanvasInsertResult) => Promise<void> | void;
          }[] = [];
          for (const payload of insertablePayloads) {
            const preparedDrop = prepareCanvasMediaLibraryDrop
              ? await prepareCanvasMediaLibraryDrop({
                  kind: "libraryMedia",
                  source: "mediaLibrary",
                  payload,
                })
              : null;
            if (!preparedDrop) continue;
            preparedDrops.push(normalizePreparedDrop(preparedDrop));
          }
          if (!preparedDrops.length) {
            showDropFeedback("Unable to add that media to the canvas.");
            return;
          }
          const offsetStep = 24;
          for (let index = 0; index < preparedDrops.length; index += 1) {
            const preparedDrop = preparedDrops[index];
            const offset = index * offsetStep;
            const insertResult = await addResolvedItem(
              preparedDrop.resolved,
              point.x + offset,
              point.y + offset,
              {
                showLoadingPlaceholder: true,
              }
            );
            await preparedDrop.afterInsert?.(insertResult);
          }
          if (skippedPayloadCount > 0) {
            notifyItemLimitReached();
          }
        });
        return;
      }
      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (mediaLibraryPayload) {
        event.preventDefault();
        event.stopPropagation();
        void runDropResolvingTask(async () => {
          const preparedDrop = prepareCanvasMediaLibraryDrop
            ? await prepareCanvasMediaLibraryDrop(mediaLibraryPayload)
            : mediaLibraryPayload.kind === "libraryPrompt"
              ? (() => {
                  const promptText = mediaLibraryPayload.payload.promptText.trim();
                  if (!promptText) return null;
                  return {
                    kind: "text" as const,
                    outputId: null,
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
                          mediaLibraryPayload.payload.displayTitle ||
                          mediaLibraryPayload.payload.filename ||
                          mediaLibraryPayload.payload.promptText ||
                          "Canvas audio"
                        ).trim() || null,
                      companionArtUrl: mediaLibraryPayload.payload.companionArtUrl ?? null,
                      companionArtStoragePath:
                        mediaLibraryPayload.payload.companionArtStoragePath ?? null,
                      audioSourceMode: mediaLibraryPayload.payload.audioSourceMode ?? null,
                      durationMs: mediaLibraryPayload.payload.durationMs ?? null,
                      waveformPeaks: sanitizeStoredWaveformPeaks(
                        mediaLibraryPayload.payload.waveformPeaks
                      ),
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
          if (!preparedDrop) {
            showDropFeedback("Unable to add that media to the canvas.");
            return;
          }
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
        });
        return;
      }
      const droppedMediaReference = getDroppedMediaReference(transfer);
      if (droppedMediaReference && resolveCanvasDroppedMediaReference) {
        event.preventDefault();
        event.stopPropagation();
        void runDropResolvingTask(async () => {
          const resolvedItem = await resolveCanvasDroppedMediaReference(droppedMediaReference);
          if (!resolvedItem) {
            showDropFeedback("Unable to add that media to the canvas.");
            return;
          }
          await addResolvedItem(resolvedItem, point.x, point.y, {
            showLoadingPlaceholder: true,
          });
        });
        return;
      }
      const droppedFiles = originalTransfer.files;
      if (droppedFiles && droppedFiles.length > 0 && resolveCanvasDropFiles) {
        event.preventDefault();
        event.stopPropagation();
        const availableItemSlots = getAvailableItemSlots();
        if (availableItemSlots <= 0) {
          notifyItemLimitReached();
          return;
        }
        const insertableFiles =
          droppedFiles.length > availableItemSlots
            ? Array.from(droppedFiles).slice(0, availableItemSlots)
            : droppedFiles;
        const skippedFileCount =
          droppedFiles.length - Math.min(droppedFiles.length, availableItemSlots);
        void runDropResolvingTask(async () => {
          const resolvedItems = await resolveCanvasDropFiles(insertableFiles);
          if (!resolvedItems?.length) {
            showDropFeedback("Unable to add those files to the canvas.");
            return;
          }
          const offsetStep = 24;
          for (let index = 0; index < resolvedItems.length; index += 1) {
            const resolvedItem = resolvedItems[index];
            const offset = index * offsetStep;
            await addResolvedItem(resolvedItem, point.x + offset, point.y + offset, {
              showLoadingPlaceholder: true,
            });
          }
          if (skippedFileCount > 0) {
            notifyItemLimitReached();
          }
        });
        return;
      }
      const droppedText = extractCanvasDroppedText(transfer);
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
      getAvailableItemSlots,
      showDropFeedback,
      handleResolvedInternalDrop,
      logUnresolvedInternalDrop,
      notifyItemLimitReached,
      prepareCanvasMediaLibraryDrop,
      normalizePreparedDrop,
      resolveCanvasDroppedMediaReference,
      resolveCanvasDropFiles,
      runDropResolvingTask,
      viewportRef,
    ]
  );

  return {
    isDropActive,
    isDropResolving,
    dropFeedback,
    onViewportDragEnter,
    onViewportDragOver,
    onViewportDragLeave,
    onViewportDrop,
  };
};
