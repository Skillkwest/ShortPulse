/**
 * Canvas panel for AI Studio.
 * Renders the V1 infinite-board workspace using a page-owned controller contract.
 */
import React from "react";
import { createPortal } from "react-dom";
import { PushPinSimple } from "phosphor-react";
import type { CanvasResizeHandle, CanvasSceneItem } from "./canvasTypes";
import type { CanvasPropertiesPanelProps } from "./useAiStudioCanvasWorkspaceState";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import { CanvasAudioCard } from "./CanvasAudioCard";
import { CANVAS_TEXT_ITEM_MIN_HEIGHT } from "./canvasGeometry";

const CANVAS_TEAR_OUT_GHOST_CURSOR_INSET_PX = 14;
const CANVAS_VIEWPORT_CULL_OVERSCAN_PX = 480;

type CanvasViewportSize = {
  width: number;
  height: number;
};

const resolveCanvasMediaErrorKey = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") {
    return `${item.id}:image:${item.src}`;
  }
  if (item.kind === "video") {
    return `${item.id}:video:${item.videoUrl}:${item.posterUrl ?? ""}`;
  }
  if (item.kind === "audio") {
    return `${item.id}:audio:${item.audioUrl}`;
  }
  return null;
};

const getCanvasItemHeight = (item: CanvasSceneItem): number =>
  item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height;

const isCanvasItemInsideViewport = ({
  item,
  camera,
  viewportSize,
}: {
  item: CanvasSceneItem;
  camera: CanvasPropertiesPanelProps["camera"];
  viewportSize: CanvasViewportSize;
}): boolean => {
  if (viewportSize.width <= 0 || viewportSize.height <= 0 || camera.zoom <= 0) return true;
  const overscanWorldPx = CANVAS_VIEWPORT_CULL_OVERSCAN_PX / camera.zoom;
  const viewportLeft = -camera.x / camera.zoom - overscanWorldPx;
  const viewportTop = -camera.y / camera.zoom - overscanWorldPx;
  const viewportRight = (-camera.x + viewportSize.width) / camera.zoom + overscanWorldPx;
  const viewportBottom = (-camera.y + viewportSize.height) / camera.zoom + overscanWorldPx;
  const itemLeft = item.x;
  const itemTop = item.y;
  const itemRight = item.x + item.width;
  const itemBottom = item.y + getCanvasItemHeight(item);

  return (
    itemRight >= viewportLeft &&
    itemLeft <= viewportRight &&
    itemBottom >= viewportTop &&
    itemTop <= viewportBottom
  );
};

const useResolvedCanvasPropertiesPanelProps = (
  props: CanvasPropertiesPanelProps
): CanvasPropertiesPanelProps => {
  const livePropsStore = props.livePropsStore;
  const liveProps = React.useSyncExternalStore(
    livePropsStore?.subscribe ?? (() => () => undefined),
    livePropsStore?.getSnapshot ?? (() => props),
    livePropsStore?.getSnapshot ?? (() => props)
  );
  if (!livePropsStore) return props;
  if (props.onInteractionActiveChange === liveProps.onInteractionActiveChange) return liveProps;
  return {
    ...liveProps,
    onInteractionActiveChange:
      props.onInteractionActiveChange ?? liveProps.onInteractionActiveChange,
  };
};

type CanvasSceneItemViewProps = Pick<
  CanvasPropertiesPanelProps,
  | "isItemDraggable"
  | "onItemPointerDown"
  | "onItemPointerMove"
  | "onItemPointerUp"
  | "onItemPointerCancel"
  | "onItemDragStart"
  | "onItemDragEnd"
  | "onItemContextMenu"
  | "onItemDoubleClick"
  | "onPinTextItem"
  | "onTextItemEditChange"
  | "onTextItemEditKeyDown"
  | "onTextItemEditBlur"
  | "onTextResizeHandlePointerDown"
  | "onCanvasMediaRenderError"
> & {
  item: CanvasSceneItem;
  textResizeHandles: CanvasResizeHandle[];
  mediaErrorKey: string | null;
  hasMediaError: boolean;
  isEditingTextItem: boolean;
  showTextResizeHandles: boolean;
  isGhostSource: boolean;
  editingTextValue: string;
  isTextEditEditable: boolean;
  markCanvasMediaError: (errorKey: string | null) => void;
  clearCanvasMediaError: (errorKey: string | null) => void;
};

const CanvasSceneItemView = React.memo(function CanvasSceneItemView({
  item,
  textResizeHandles,
  mediaErrorKey,
  hasMediaError,
  isEditingTextItem,
  showTextResizeHandles,
  isGhostSource,
  editingTextValue,
  isTextEditEditable,
  isItemDraggable = false,
  onItemPointerDown,
  onItemPointerMove,
  onItemPointerUp,
  onItemPointerCancel,
  onItemDragStart,
  onItemDragEnd,
  onItemContextMenu,
  onItemDoubleClick,
  onPinTextItem,
  onTextItemEditChange,
  onTextItemEditKeyDown,
  onTextItemEditBlur,
  onTextResizeHandlePointerDown,
  onCanvasMediaRenderError,
  markCanvasMediaError,
  clearCanvasMediaError,
}: CanvasSceneItemViewProps) {
  const isExportDragArmedRef = React.useRef(false);
  const dragPreviewKind =
    item.kind === "image" || item.kind === "video" || item.kind === "audio" || item.kind === "text"
      ? item.kind
      : undefined;
  const dragPreviewUrl =
    item.kind === "image"
      ? item.src
      : item.kind === "video"
        ? (item.posterUrl ?? item.videoUrl)
        : item.kind === "audio"
          ? (item.companionArtUrl ?? item.audioUrl)
          : undefined;
  const dragImageSrc =
    item.kind === "image"
      ? item.src
      : item.kind === "video"
        ? (item.posterUrl ?? undefined)
        : item.kind === "audio"
          ? (item.companionArtUrl ?? undefined)
          : undefined;
  return (
    <article
      className={`canvas-scene-item canvas-scene-item--${item.kind}${item.selected ? " is-selected" : ""}${isGhostSource ? " is-ghost-source" : ""}${hasMediaError ? " is-media-unavailable" : ""}`}
      data-testid={`canvas-item-${item.id}`}
      data-kind={item.kind}
      data-drag-preview-kind={dragPreviewKind}
      data-drag-preview-url={dragPreviewUrl}
      data-drag-image-src={dragImageSrc}
      data-selected={item.selected ? "true" : "false"}
      data-x={item.x}
      data-y={item.y}
      data-width={item.width}
      data-height={
        item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height
      }
      style={{
        zIndex: item.z,
        width: `${item.width}px`,
        height: `${item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height}px`,
        ["--canvas-item-x" as string]: `${item.x}px`,
        ["--canvas-item-y" as string]: `${item.y}px`,
      }}
      draggable={isItemDraggable}
      onPointerDown={
        isEditingTextItem
          ? undefined
          : (event) => {
              if (isItemDraggable && event.shiftKey) {
                isExportDragArmedRef.current = true;
                event.stopPropagation();
                return;
              }
              isExportDragArmedRef.current = false;
              onItemPointerDown(item.id, event);
            }
      }
      onPointerMove={isEditingTextItem ? undefined : (event) => onItemPointerMove(item.id, event)}
      onPointerUp={isEditingTextItem ? undefined : (event) => onItemPointerUp(item.id, event)}
      onPointerCancel={
        isEditingTextItem ? undefined : (event) => onItemPointerCancel(item.id, event)
      }
      onContextMenu={(event) => onItemContextMenu(item.id, event)}
      onDragStart={
        isItemDraggable && onItemDragStart
          ? (event) => {
              const isExportDragArmed = event.shiftKey || isExportDragArmedRef.current;
              isExportDragArmedRef.current = false;
              if (!isExportDragArmed) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              onItemDragStart(item.id, event);
            }
          : undefined
      }
      onDragEnd={
        isItemDraggable && onItemDragEnd
          ? (event) => {
              isExportDragArmedRef.current = false;
              onItemDragEnd(item.id, event);
            }
          : undefined
      }
      onDoubleClick={(event) => {
        onItemDoubleClick(item.id, event);
      }}
    >
      {hasMediaError ? (
        <div className="canvas-scene-item__media-unavailable" role="status">
          <span>Media unavailable</span>
        </div>
      ) : item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="canvas-scene-item__image"
          src={item.src}
          alt={item.alt}
          draggable={false}
          onLoad={() => clearCanvasMediaError(mediaErrorKey)}
          onError={() => {
            markCanvasMediaError(mediaErrorKey);
            onCanvasMediaRenderError?.(item);
          }}
        />
      ) : item.kind === "video" ? (
        <>
          {item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="canvas-scene-item__video"
              src={item.posterUrl}
              alt={item.title?.trim() || "Canvas video"}
              draggable={false}
              onLoad={() => clearCanvasMediaError(mediaErrorKey)}
              onError={() => {
                markCanvasMediaError(mediaErrorKey);
                onCanvasMediaRenderError?.(item);
              }}
            />
          ) : (
            <video
              className="canvas-scene-item__video"
              src={item.videoUrl}
              aria-label={item.title?.trim() || "Canvas video"}
              draggable={false}
              muted
              playsInline
              preload="metadata"
              onLoadedData={() => clearCanvasMediaError(mediaErrorKey)}
              onError={() => {
                markCanvasMediaError(mediaErrorKey);
                onCanvasMediaRenderError?.(item);
              }}
            />
          )}
          <MediaDurationBadge
            className="canvas-scene-item__media-duration"
            durationMs={item.durationMs ?? null}
            mediaKind="video"
          />
        </>
      ) : isEditingTextItem ? (
        isTextEditEditable ? (
          <textarea
            className="canvas-scene-item__text-editor"
            data-testid="canvas-text-edit-input"
            value={editingTextValue}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onTextItemEditChange(event.target.value)}
            onKeyDown={onTextItemEditKeyDown}
            onBlur={onTextItemEditBlur}
            autoFocus
          />
        ) : (
          <p className="canvas-scene-item__text">{editingTextValue}</p>
        )
      ) : item.kind === "audio" ? (
        <CanvasAudioCard
          item={item}
          onMediaError={() => {
            markCanvasMediaError(mediaErrorKey);
            onCanvasMediaRenderError?.(item);
          }}
        />
      ) : (
        <>
          <p className="canvas-scene-item__text">{item.text}</p>
          <button
            type="button"
            className="canvas-scene-item__pin-button"
            aria-label="Pin text reference to reference grid"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPinTextItem(item.id);
            }}
          >
            <PushPinSimple aria-hidden="true" size={12} weight="fill" />
          </button>
          {showTextResizeHandles
            ? textResizeHandles.map((handle) => (
                <span
                  key={`${item.id}-resize-${handle}`}
                  className={`canvas-scene-item__resize-handle is-${handle}`}
                  data-testid={`canvas-text-resize-handle-${handle}`}
                  onPointerDown={(event) => onTextResizeHandlePointerDown?.(item.id, handle, event)}
                />
              ))
            : null}
        </>
      )}
    </article>
  );
});

const CanvasSceneItemGhostView = React.memo(function CanvasSceneItemGhostView({
  item,
  deltaX,
  deltaY,
}: {
  item: CanvasSceneItem;
  deltaX: number;
  deltaY: number;
}) {
  const ghostX = Math.round((item.x + deltaX) * 100) / 100;
  const ghostY = Math.round((item.y + deltaY) * 100) / 100;
  const height = item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height;
  return (
    <article
      className={`canvas-scene-item canvas-scene-item--${item.kind} canvas-scene-item--ghost`}
      data-testid={`canvas-item-ghost-${item.id}`}
      data-kind={item.kind}
      data-source-item-id={item.id}
      data-x={ghostX}
      data-y={ghostY}
      data-width={item.width}
      data-height={height}
      aria-hidden="true"
      style={{
        zIndex: item.z + 10_000,
        width: `${item.width}px`,
        height: `${height}px`,
        ["--canvas-item-x" as string]: `${ghostX}px`,
        ["--canvas-item-y" as string]: `${ghostY}px`,
      }}
    >
      {item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="canvas-scene-item__image" src={item.src} alt="" draggable={false} />
      ) : item.kind === "video" ? (
        item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="canvas-scene-item__video" src={item.posterUrl} alt="" draggable={false} />
        ) : (
          <div className="canvas-scene-item__video-placeholder">
            <span>Video</span>
          </div>
        )
      ) : item.kind === "audio" ? (
        <div className="canvas-scene-item__ghost-label">
          <span>Audio</span>
        </div>
      ) : (
        <p className="canvas-scene-item__text">{item.text}</p>
      )}
    </article>
  );
});

const CanvasTearOutDragGhostView = React.memo(function CanvasTearOutDragGhostView({
  item,
  clientX,
  clientY,
  phase,
}: {
  item: CanvasSceneItem;
  clientX: number;
  clientY: number;
  phase: "candidate" | "active";
}) {
  const sourceHeight =
    item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height;
  const scale = Math.min(1, 220 / item.width, 180 / sourceHeight);
  const ghostWidth = Math.round(item.width * scale);
  const ghostHeight = Math.round(sourceHeight * scale);
  const ghostX = Math.round((clientX - CANVAS_TEAR_OUT_GHOST_CURSOR_INSET_PX) * 100) / 100;
  const ghostY = Math.round((clientY - CANVAS_TEAR_OUT_GHOST_CURSOR_INSET_PX) * 100) / 100;
  return (
    <article
      className={`canvas-scene-item canvas-scene-item--${item.kind} canvas-scene-item--ghost canvas-scene-item--tear-out-ghost is-${phase}`}
      data-testid={`canvas-item-tear-out-ghost-${item.id}`}
      data-kind={item.kind}
      data-source-item-id={item.id}
      data-phase={phase}
      data-client-x={clientX}
      data-client-y={clientY}
      data-width={ghostWidth}
      data-height={ghostHeight}
      aria-hidden="true"
      style={{
        width: `${ghostWidth}px`,
        height: `${ghostHeight}px`,
        ["--canvas-item-x" as string]: `${ghostX}px`,
        ["--canvas-item-y" as string]: `${ghostY}px`,
      }}
    >
      {item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="canvas-scene-item__image" src={item.src} alt="" draggable={false} />
      ) : item.kind === "video" ? (
        item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="canvas-scene-item__video" src={item.posterUrl} alt="" draggable={false} />
        ) : (
          <div className="canvas-scene-item__video-placeholder">
            <span>Video</span>
          </div>
        )
      ) : item.kind === "audio" ? (
        <div className="canvas-scene-item__ghost-label">
          <span>Audio</span>
        </div>
      ) : (
        <p className="canvas-scene-item__text">{item.text}</p>
      )}
    </article>
  );
});

/**
 * Renders the Canvas workspace UI and delegates all state changes to the page-owned controller.
 */
export function CanvasPropertiesPanel(props: CanvasPropertiesPanelProps) {
  const {
    instanceId,
    camera,
    items,
    pendingItems,
    itemDragPreview,
    tearOutDragPreview,
    marqueeSelectionBox,
    viewportRef,
    isDropActive,
    draftTextEntry,
    isDraftTextEditable = true,
    editingTextItemId,
    editingTextValue,
    isTextEditEditable = true,
    onViewportKeyDown,
    onViewportDoubleClick,
    onViewportClick,
    onViewportPointerDown,
    onViewportPointerMove,
    onViewportPointerUp,
    onViewportPointerCancel,
    onViewportDragEnter,
    onViewportDragOver,
    onViewportDragLeave,
    onViewportDrop,
    onViewportWheel,
    onInteractionActiveChange,
    onItemPointerDown,
    onItemPointerMove,
    onItemPointerUp,
    onItemPointerCancel,
    isTextResizeEnabled = false,
    onTextResizeHandlePointerDown,
    isItemDraggable = false,
    onItemDragStart,
    onItemDragEnd,
    onItemContextMenu,
    onItemDoubleClick,
    onPinTextItem,
    onDraftTextChange,
    onDraftTextPaste,
    onDraftTextKeyDown,
    onDraftTextBlur,
    onTextItemEditChange,
    onTextItemEditKeyDown,
    onTextItemEditBlur,
    onCanvasMediaRenderError,
  } = useResolvedCanvasPropertiesPanelProps(props);
  const textResizeHandles = React.useMemo<CanvasResizeHandle[]>(() => ["nw", "ne", "se", "sw"], []);
  const [mediaErrorKeys, setMediaErrorKeys] = React.useState<Set<string>>(() => new Set());
  const [isNativeDragModifierArmed, setIsNativeDragModifierArmed] = React.useState(false);
  const [viewportSize, setViewportSize] = React.useState<CanvasViewportSize>({
    width: 0,
    height: 0,
  });
  const interactionActiveRef = React.useRef(false);
  const wheelInteractionIdleTimeoutRef = React.useRef<number | null>(null);
  const itemDragPreviewIdSet = React.useMemo(
    () => new Set(itemDragPreview?.itemIds ?? []),
    [itemDragPreview]
  );
  const itemDragPreviewItems = React.useMemo(
    () => (itemDragPreview ? items.filter((item) => itemDragPreviewIdSet.has(item.id)) : []),
    [itemDragPreview, itemDragPreviewIdSet, items]
  );
  const tearOutDragPreviewItem = React.useMemo(
    () =>
      tearOutDragPreview
        ? (items.find((item) => item.id === tearOutDragPreview.activeItemId) ?? null)
        : null,
    [items, tearOutDragPreview]
  );
  const renderedItems = React.useMemo(() => {
    const preservedItemIds = new Set<string>();
    if (editingTextItemId) preservedItemIds.add(editingTextItemId);
    if (itemDragPreview?.activeItemId) preservedItemIds.add(itemDragPreview.activeItemId);
    itemDragPreview?.itemIds.forEach((id) => preservedItemIds.add(id));
    if (tearOutDragPreview?.activeItemId) preservedItemIds.add(tearOutDragPreview.activeItemId);

    return items.filter((item) => {
      if (item.selected || preservedItemIds.has(item.id)) return true;
      return isCanvasItemInsideViewport({ item, camera, viewportSize });
    });
  }, [camera, editingTextItemId, itemDragPreview, items, tearOutDragPreview, viewportSize]);
  const activeMediaErrorKeys = React.useMemo(() => {
    const nextKeys = new Set<string>();
    items.forEach((item) => {
      const errorKey = resolveCanvasMediaErrorKey(item);
      if (errorKey) {
        nextKeys.add(errorKey);
      }
    });
    return nextKeys;
  }, [items]);

  const markCanvasMediaError = React.useCallback((errorKey: string | null) => {
    if (!errorKey) return;
    setMediaErrorKeys((current) => {
      if (current.has(errorKey)) return current;
      const next = new Set(current);
      next.add(errorKey);
      return next;
    });
  }, []);

  const clearCanvasMediaError = React.useCallback((errorKey: string | null) => {
    if (!errorKey) return;
    setMediaErrorKeys((current) => {
      if (!current.has(errorKey)) return current;
      const next = new Set(current);
      next.delete(errorKey);
      return next;
    });
  }, []);

  const setCanvasInteractionActive = React.useCallback(
    (active: boolean) => {
      if (interactionActiveRef.current === active) return;
      interactionActiveRef.current = active;
      onInteractionActiveChange?.(active);
    },
    [onInteractionActiveChange]
  );

  const releaseWheelInteractionAfterIdle = React.useCallback(() => {
    if (wheelInteractionIdleTimeoutRef.current != null) {
      window.clearTimeout(wheelInteractionIdleTimeoutRef.current);
    }
    wheelInteractionIdleTimeoutRef.current = window.setTimeout(() => {
      wheelInteractionIdleTimeoutRef.current = null;
      setCanvasInteractionActive(false);
    }, 180);
  }, [setCanvasInteractionActive]);

  React.useEffect(
    () => () => {
      if (wheelInteractionIdleTimeoutRef.current != null) {
        window.clearTimeout(wheelInteractionIdleTimeoutRef.current);
        wheelInteractionIdleTimeoutRef.current = null;
      }
      if (interactionActiveRef.current) {
        interactionActiveRef.current = false;
        onInteractionActiveChange?.(false);
      }
    },
    [onInteractionActiveChange]
  );

  React.useEffect(() => {
    if (!isItemDraggable) {
      setIsNativeDragModifierArmed(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey && event.key !== "Shift") return;
      setIsNativeDragModifierArmed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.shiftKey) return;
      if (event.key !== "Shift") return;
      setIsNativeDragModifierArmed(false);
    };

    const handleWindowBlur = () => {
      setIsNativeDragModifierArmed(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsNativeDragModifierArmed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isItemDraggable]);

  const onViewportWheelRef = React.useRef(onViewportWheel);

  React.useEffect(() => {
    onViewportWheelRef.current = onViewportWheel;
  }, [onViewportWheel]);

  React.useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      setCanvasInteractionActive(true);
      onViewportWheelRef.current(event);
      releaseWheelInteractionAfterIdle();
    };
    viewportNode.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewportNode.removeEventListener("wheel", handleNativeWheel);
    };
  }, [releaseWheelInteractionAfterIdle, setCanvasInteractionActive, viewportRef]);

  React.useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;

    const updateViewportSize = () => {
      const bounds = viewportNode.getBoundingClientRect();
      const nextWidth = Math.round(bounds.width || viewportNode.clientWidth || 0);
      const nextHeight = Math.round(bounds.height || viewportNode.clientHeight || 0);
      setViewportSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewportSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportSize);
      return () => window.removeEventListener("resize", updateViewportSize);
    }

    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewportNode);
    return () => resizeObserver.disconnect();
  }, [viewportRef]);

  return (
    <section className="canvas-properties-panel">
      <div
        ref={viewportRef}
        className={`canvas-workspace-viewport${isDropActive ? " is-drop-active" : ""}${
          marqueeSelectionBox ? " is-marquee-active" : ""
        }`}
        data-testid="canvas-viewport"
        data-canvas-instance={instanceId}
        data-camera-x={camera.x}
        data-camera-y={camera.y}
        data-camera-zoom={camera.zoom}
        data-canvas-rendered-item-count={renderedItems.length}
        data-canvas-total-item-count={items.length}
        data-canvas-culled-item-count={Math.max(0, items.length - renderedItems.length)}
        tabIndex={0}
        onPointerDown={(event) => {
          setCanvasInteractionActive(true);
          onViewportPointerDown(event);
        }}
        onPointerMove={onViewportPointerMove}
        onPointerUp={(event) => {
          onViewportPointerUp(event);
          setCanvasInteractionActive(false);
        }}
        onPointerCancel={(event) => {
          onViewportPointerCancel(event);
          setCanvasInteractionActive(false);
        }}
        onKeyDown={onViewportKeyDown}
        onDoubleClick={onViewportDoubleClick}
        onClick={onViewportClick}
        onDragEnter={onViewportDragEnter}
        onDragOver={onViewportDragOver}
        onDragLeave={onViewportDragLeave}
        onDrop={onViewportDrop}
      >
        <div
          className="canvas-workspace-world"
          data-testid="canvas-world"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          <div className="canvas-workspace-grid" aria-hidden="true" />
          {pendingItems.map((item) => (
            <article
              key={item.id}
              className={`canvas-scene-item canvas-scene-item--${item.kind} canvas-scene-item--pending`}
              data-testid={`canvas-pending-item-${item.id}`}
              style={{
                zIndex: item.z,
                width: `${item.width}px`,
                height: `${item.height}px`,
                ["--canvas-item-x" as string]: `${item.x}px`,
                ["--canvas-item-y" as string]: `${item.y}px`,
              }}
            >
              <div
                className="canvas-scene-item__loading"
                role="status"
                aria-label="Loading reference"
              >
                <span
                  className="canvas-scene-item__loading-spinner"
                  data-testid="canvas-loading-spinner"
                  aria-hidden="true"
                />
              </div>
            </article>
          ))}
          {renderedItems.map((item) => {
            const isEditingTextItem = item.kind === "text" && editingTextItemId === item.id;
            const showTextResizeHandles =
              isTextResizeEnabled && item.kind === "text" && item.selected && !isEditingTextItem;
            const mediaErrorKey = resolveCanvasMediaErrorKey(item);
            const hasMediaError =
              mediaErrorKey != null &&
              activeMediaErrorKeys.has(mediaErrorKey) &&
              mediaErrorKeys.has(mediaErrorKey);
            return (
              <CanvasSceneItemView
                key={item.id}
                item={item}
                textResizeHandles={textResizeHandles}
                mediaErrorKey={mediaErrorKey}
                hasMediaError={hasMediaError}
                isEditingTextItem={isEditingTextItem}
                showTextResizeHandles={showTextResizeHandles}
                isGhostSource={itemDragPreviewIdSet.has(item.id)}
                editingTextValue={isEditingTextItem ? editingTextValue : ""}
                isTextEditEditable={isEditingTextItem && isTextEditEditable}
                isItemDraggable={isItemDraggable && isNativeDragModifierArmed}
                onItemPointerDown={(id, event) => {
                  setCanvasInteractionActive(true);
                  onItemPointerDown(id, event);
                }}
                onItemPointerMove={onItemPointerMove}
                onItemPointerUp={(id, event) => {
                  onItemPointerUp(id, event);
                  setCanvasInteractionActive(false);
                }}
                onItemPointerCancel={(id, event) => {
                  onItemPointerCancel(id, event);
                  setCanvasInteractionActive(false);
                }}
                onItemDragStart={onItemDragStart}
                onItemDragEnd={onItemDragEnd}
                onItemContextMenu={onItemContextMenu}
                onItemDoubleClick={onItemDoubleClick}
                onPinTextItem={onPinTextItem}
                onTextItemEditChange={onTextItemEditChange}
                onTextItemEditKeyDown={onTextItemEditKeyDown}
                onTextItemEditBlur={onTextItemEditBlur}
                onTextResizeHandlePointerDown={
                  onTextResizeHandlePointerDown
                    ? (id, handle, event) => {
                        setCanvasInteractionActive(true);
                        onTextResizeHandlePointerDown(id, handle, event);
                      }
                    : undefined
                }
                onCanvasMediaRenderError={onCanvasMediaRenderError}
                markCanvasMediaError={markCanvasMediaError}
                clearCanvasMediaError={clearCanvasMediaError}
              />
            );
          })}
          {itemDragPreview
            ? itemDragPreviewItems.map((item) => (
                <CanvasSceneItemGhostView
                  key={`ghost-${item.id}`}
                  item={item}
                  deltaX={itemDragPreview.deltaX}
                  deltaY={itemDragPreview.deltaY}
                />
              ))
            : null}
          {draftTextEntry ? (
            <article
              className="canvas-scene-item canvas-scene-item--text canvas-scene-item--draft is-selected"
              data-testid="canvas-draft-text-item"
              style={{
                zIndex: items.length + 1,
                width: "260px",
                height: `${CANVAS_TEXT_ITEM_MIN_HEIGHT}px`,
                ["--canvas-item-x" as string]: `${draftTextEntry.x}px`,
                ["--canvas-item-y" as string]: `${draftTextEntry.y}px`,
              }}
            >
              {isDraftTextEditable ? (
                <textarea
                  className="canvas-scene-item__draft-input"
                  data-testid="canvas-draft-text-input"
                  value={draftTextEntry.value}
                  onChange={(event) => onDraftTextChange(event.target.value)}
                  onPaste={onDraftTextPaste}
                  onKeyDown={onDraftTextKeyDown}
                  onBlur={onDraftTextBlur}
                  autoFocus
                />
              ) : (
                <p className="canvas-scene-item__text">{draftTextEntry.value}</p>
              )}
            </article>
          ) : null}
        </div>
        {marqueeSelectionBox ? (
          <div
            className="canvas-workspace-marquee"
            aria-hidden="true"
            style={{
              left: `${marqueeSelectionBox.x}px`,
              top: `${marqueeSelectionBox.y}px`,
              width: `${marqueeSelectionBox.width}px`,
              height: `${marqueeSelectionBox.height}px`,
            }}
          />
        ) : null}
      </div>
      {tearOutDragPreview && tearOutDragPreviewItem && typeof document !== "undefined"
        ? createPortal(
            <CanvasTearOutDragGhostView
              item={tearOutDragPreviewItem}
              clientX={tearOutDragPreview.clientX}
              clientY={tearOutDragPreview.clientY}
              phase={tearOutDragPreview.phase}
            />,
            document.body
          )
        : null}
    </section>
  );
}
