/**
 * Canvas panel for AI Studio.
 * Renders the V1 infinite-board workspace using a page-owned controller contract.
 */
import React from "react";
import { PushPinSimple } from "phosphor-react";
import type { CanvasPropertiesPanelProps } from "./useAiStudioCanvasWorkspaceState";

/**
 * Renders the Canvas workspace UI and delegates all state changes to the page-owned controller.
 */
export function CanvasPropertiesPanel({
  instanceId,
  camera,
  items,
  pendingItems,
  viewportRef,
  isDropActive,
  draftTextEntry,
  editingTextItemId,
  editingTextValue,
  onViewportKeyDown,
  onViewportDoubleClick,
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
  return (
    <section className="canvas-properties-panel">
      <div
        ref={viewportRef}
        className={`canvas-workspace-viewport${isDropActive ? " is-drop-active" : ""}`}
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
        onDragEnter={onViewportDragEnter}
        onDragOver={onViewportDragOver}
        onDragLeave={onViewportDragLeave}
        onDrop={onViewportDrop}
        onWheel={onViewportWheel}
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
                data-height={item.kind === "image" ? item.height : undefined}
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  zIndex: item.z,
                  width: `${item.width}px`,
                  ...(item.kind === "image" ? { height: `${item.height}px` } : {}),
                }}
                onPointerDown={
                  isEditingTextItem ? undefined : (event) => onItemPointerDown(item.id, event)
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
                ) : isEditingTextItem ? (
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
              }}
            >
              <textarea
                className="canvas-scene-item__draft-input"
                data-testid="canvas-draft-text-input"
                value={draftTextEntry.value}
                onChange={(event) => onDraftTextChange(event.target.value)}
                onKeyDown={onDraftTextKeyDown}
                onBlur={onDraftTextBlur}
                autoFocus
              />
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
