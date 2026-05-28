/**
 * Canvas panel for AI Studio.
 * Renders the V1 infinite-board workspace using a page-owned controller contract.
 */
import React from "react";
import { PushPinSimple } from "phosphor-react";
import type { CanvasResizeHandle } from "./canvasTypes";
import type { CanvasPropertiesPanelProps } from "./useAiStudioCanvasWorkspaceState";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import { CanvasAudioCard } from "./CanvasAudioCard";
import { CANVAS_TEXT_ITEM_MIN_HEIGHT } from "./canvasGeometry";

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
                left: `${item.x}px`,
                top: `${item.y}px`,
                zIndex: item.z,
                width: `${item.width}px`,
                height: `${item.height}px`,
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
            return (
              <article
                key={item.id}
                className={`canvas-scene-item canvas-scene-item--${item.kind}${item.selected ? " is-selected" : ""}`}
                data-testid={`canvas-item-${item.id}`}
                data-kind={item.kind}
                data-selected={item.selected ? "true" : "false"}
                data-x={item.x}
                data-y={item.y}
                data-width={item.width}
                data-height={
                  item.kind === "text" ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT) : item.height
                }
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  zIndex: item.z,
                  width: `${item.width}px`,
                  height: `${
                    item.kind === "text"
                      ? (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT)
                      : item.height
                  }px`,
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
                onPointerMove={
                  isEditingTextItem ? undefined : (event) => onItemPointerMove(item.id, event)
                }
                onPointerUp={
                  isEditingTextItem ? undefined : (event) => onItemPointerUp(item.id, event)
                }
                onPointerCancel={
                  isEditingTextItem ? undefined : (event) => onItemPointerCancel(item.id, event)
                }
                onContextMenu={(event) => onItemContextMenu(item.id, event)}
                onDragStart={
                  isItemDraggable && onItemDragStart
                    ? (event) => onItemDragStart(item.id, event)
                    : undefined
                }
                onDragEnd={
                  isItemDraggable && onItemDragEnd
                    ? (event) => onItemDragEnd(item.id, event)
                    : undefined
                }
                onDoubleClick={(event) => {
                  if (item.kind === "text") {
                    onItemDoubleClick(item.id, event);
                    return;
                  }
                  event.stopPropagation();
                }}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="canvas-scene-item__image"
                    src={item.src}
                    alt={item.alt}
                    draggable={false}
                  />
                ) : item.kind === "video" ? (
                  <>
                    <video
                      className="canvas-scene-item__video"
                      src={item.videoUrl}
                      poster={item.posterUrl ?? undefined}
                      aria-label={item.title?.trim() || "Canvas video"}
                      draggable={false}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                    />
                    <MediaDurationBadge
                      className="canvas-scene-item__media-duration"
                      durationMs={item.durationMs ?? null}
                      mediaUrl={item.videoUrl}
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
                            onPointerDown={(event) =>
                              onTextResizeHandlePointerDown?.(item.id, handle, event)
                            }
                          />
                        ))
                      : null}
                  </>
                )}
              </article>
            );
          })}
          {draftTextEntry ? (
            <article
              className="canvas-scene-item canvas-scene-item--text canvas-scene-item--draft is-selected"
              data-testid="canvas-draft-text-item"
              style={{
                left: `${draftTextEntry.x}px`,
                top: `${draftTextEntry.y}px`,
                zIndex: items.length + 1,
                width: "260px",
                height: `${CANVAS_TEXT_ITEM_MIN_HEIGHT}px`,
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
