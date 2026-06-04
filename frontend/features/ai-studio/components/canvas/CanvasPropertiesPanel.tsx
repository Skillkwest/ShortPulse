/**
 * Canvas panel for AI Studio.
 * Renders the V1 infinite-board workspace using a page-owned controller contract.
 */
import React from "react";
import { PushPinSimple } from "phosphor-react";
import type { CanvasResizeHandle, CanvasSceneItem } from "./canvasTypes";
import type { CanvasPropertiesPanelProps } from "./useAiStudioCanvasWorkspaceState";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import { CanvasAudioCard } from "./CanvasAudioCard";
import { CANVAS_TEXT_ITEM_MIN_HEIGHT } from "./canvasGeometry";

const resolveCanvasMediaErrorKey = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") {
    return `${item.id}:image:${item.src}`;
  }
  if (item.kind === "video") {
    return `${item.id}:video:${item.videoUrl}:${item.posterUrl ?? ""}`;
  }
  return null;
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
> & {
  item: CanvasSceneItem;
  textResizeHandles: CanvasResizeHandle[];
  mediaErrorKey: string | null;
  hasMediaError: boolean;
  isEditingTextItem: boolean;
  showTextResizeHandles: boolean;
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
  markCanvasMediaError,
  clearCanvasMediaError,
}: CanvasSceneItemViewProps) {
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
      className={`canvas-scene-item canvas-scene-item--${item.kind}${item.selected ? " is-selected" : ""}${hasMediaError ? " is-media-unavailable" : ""}`}
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
                event.stopPropagation();
                return;
              }
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
        isItemDraggable && onItemDragStart ? (event) => onItemDragStart(item.id, event) : undefined
      }
      onDragEnd={
        isItemDraggable && onItemDragEnd ? (event) => onItemDragEnd(item.id, event) : undefined
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
          onError={() => markCanvasMediaError(mediaErrorKey)}
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
              onError={() => markCanvasMediaError(mediaErrorKey)}
            />
          ) : (
            <div className="canvas-scene-item__video-placeholder" role="img">
              <span>{item.title?.trim() || "Video"}</span>
            </div>
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
        <CanvasAudioCard item={item} />
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

/**
 * Renders the Canvas workspace UI and delegates all state changes to the page-owned controller.
 */
export function CanvasPropertiesPanel({
  instanceId,
  camera,
  items,
  pendingItems,
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
  onDraftTextKeyDown,
  onDraftTextBlur,
  onTextItemEditChange,
  onTextItemEditKeyDown,
  onTextItemEditBlur,
}: CanvasPropertiesPanelProps) {
  const textResizeHandles = React.useMemo<CanvasResizeHandle[]>(() => ["nw", "ne", "se", "sw"], []);
  const [mediaErrorKeys, setMediaErrorKeys] = React.useState<Set<string>>(() => new Set());
  const [isNativeDragModifierArmed, setIsNativeDragModifierArmed] = React.useState(false);
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

  React.useEffect(() => {
    if (instanceId !== "rail") return;
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (!event.cancelable) return;
      event.preventDefault();
    };
    viewportNode.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewportNode.removeEventListener("wheel", handleNativeWheel);
    };
  }, [instanceId, viewportRef]);

  const handleViewportWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onViewportWheel(event);
    },
    [onViewportWheel]
  );

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
        tabIndex={0}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerCancel}
        onKeyDown={onViewportKeyDown}
        onDoubleClick={onViewportDoubleClick}
        onClick={onViewportClick}
        onDragEnter={onViewportDragEnter}
        onDragOver={onViewportDragOver}
        onDragLeave={onViewportDragLeave}
        onDrop={onViewportDrop}
        onWheel={handleViewportWheel}
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
          {items.map((item) => {
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
                editingTextValue={isEditingTextItem ? editingTextValue : ""}
                isTextEditEditable={isEditingTextItem && isTextEditEditable}
                isItemDraggable={isItemDraggable && isNativeDragModifierArmed}
                onItemPointerDown={onItemPointerDown}
                onItemPointerMove={onItemPointerMove}
                onItemPointerUp={onItemPointerUp}
                onItemPointerCancel={onItemPointerCancel}
                onItemDragStart={onItemDragStart}
                onItemDragEnd={onItemDragEnd}
                onItemContextMenu={onItemContextMenu}
                onItemDoubleClick={onItemDoubleClick}
                onPinTextItem={onPinTextItem}
                onTextItemEditChange={onTextItemEditChange}
                onTextItemEditKeyDown={onTextItemEditKeyDown}
                onTextItemEditBlur={onTextItemEditBlur}
                onTextResizeHandlePointerDown={onTextResizeHandlePointerDown}
                markCanvasMediaError={markCanvasMediaError}
                clearCanvasMediaError={clearCanvasMediaError}
              />
            );
          })}
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
    </section>
  );
}
