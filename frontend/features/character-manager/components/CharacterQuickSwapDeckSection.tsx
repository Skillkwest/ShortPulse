/**
 * Character QuickSwap section component.
 * Renders active and archived quick-swap references with upload and drag/drop affordances.
 */
import Image from "next/image";
import React, { useState } from "react";
import { CaretDown, Trash, UploadSimple } from "phosphor-react";
import type { CharacterQuickSwapItem } from "../types";

type CharacterQuickSwapDeckSectionProps = {
  beginnerMode: boolean;
  showCollapseToggle?: boolean;
  isCollapsed: boolean;
  contentId: string;
  pageBusy: boolean;
  isDropActive: boolean;
  isDropPending?: boolean;
  remainingCapacityHint: number;
  activeItems: CharacterQuickSwapItem[];
  archivedItems: CharacterQuickSwapItem[];
  archivedCount: number;
  hasMoreArchived: boolean;
  loadingArchived: boolean;
  onToggleCollapsed: () => void;
  onOpenUploadPicker: () => void;
  onRemoveItem: (itemId: string) => void;
  onRestoreArchivedItem: (itemId: string) => void;
  onLoadMoreArchived: () => void;
  onReferenceDragStart: (
    item: CharacterQuickSwapItem
  ) => (event: React.DragEvent<HTMLElement>) => void;
  onReferenceDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onOpenReferencePreview: (index: number, aspectRatio: number | null) => void;
  resolveCharacterGridPreviewUrl: (
    url: string | null | undefined,
    cardLongEdgePx: number
  ) => string | null;
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
};

/**
 * Renders the quick-swap deck with dynamic item counts and archived controls.
 */
export function CharacterQuickSwapDeckSection({
  beginnerMode,
  showCollapseToggle = true,
  isCollapsed,
  contentId,
  pageBusy,
  isDropActive,
  isDropPending = false,
  remainingCapacityHint,
  activeItems,
  archivedItems,
  archivedCount,
  hasMoreArchived,
  loadingArchived,
  onToggleCollapsed,
  onOpenUploadPicker,
  onRemoveItem,
  onRestoreArchivedItem,
  onLoadMoreArchived,
  onReferenceDragStart,
  onReferenceDragEnd,
  onOpenReferencePreview,
  resolveCharacterGridPreviewUrl,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: CharacterQuickSwapDeckSectionProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  return (
    <section
      className={`character-section character-section--reference-drop ${isCollapsed ? "is-collapsed" : ""} ${showCollapseToggle ? "" : "no-collapse-toggle"}`.trim()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="character-section-head">
        <div className="character-section-title-row">
          {beginnerMode ? (
            <span className="character-step-badge" aria-hidden="true">
              1
            </span>
          ) : null}
          <div className="character-section-title-copy">
            <h3 className="character-section-title">QuickSwap Deck</h3>
            {!isCollapsed ? (
              <p className="character-section-helper tiny subdued">
                The quick swap deck is a small library of images you can quickly access to swap out
                your character&apos;s style on the fly.
              </p>
            ) : null}
          </div>
        </div>
        {showCollapseToggle ? (
          <div className="character-section-head-actions">
            <button
              type="button"
              className="ghost-btn mini character-section-collapse-btn"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} QuickSwap Deck`}
              aria-expanded={!isCollapsed}
              aria-controls={contentId}
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed();
              }}
            >
              <CaretDown
                size={16}
                weight="bold"
                className="character-section-collapse-icon"
                aria-hidden="true"
              />
            </button>
          </div>
        ) : null}
      </div>

      <div id={contentId} className="character-reference-drop-content" hidden={isCollapsed}>
        {isDropActive ? (
          <div
            className={`character-reference-drop-overlay ${isDropPending ? "is-pending" : ""}`}
            aria-live={isDropPending ? "polite" : undefined}
            role={isDropPending ? "status" : undefined}
          >
            <div className="character-reference-drop-overlay-content">
              {isDropPending ? (
                <span className="character-reference-drop-overlay-spinner" aria-hidden="true" />
              ) : (
                <UploadSimple
                  size={34}
                  weight="bold"
                  className="character-reference-drop-overlay-icon"
                />
              )}
              <p className="character-reference-drop-overlay-title">
                {isDropPending ? "Adding image to QuickSwap Deck..." : "Drop reference images here"}
              </p>
              <p className="tiny subdued">
                {isDropPending
                  ? "Processing drop and syncing your QuickSwap Deck."
                  : remainingCapacityHint > 0
                    ? `${remainingCapacityHint} active slot(s) remaining before archive overflow.`
                    : "New uploads will auto-archive oldest active references beyond 500."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="character-quickswap-active-scroll">
          <div
            className="character-reference-upload-grid character-reference-upload-grid--drop-card"
            role="list"
            aria-label="Uploaded references"
          >
            {activeItems.map((item, index) => (
              <article
                key={item.id}
                role="listitem"
                className="character-reference-upload-card"
                draggable={!pageBusy}
                onDragStart={onReferenceDragStart(item)}
                onDragEnd={onReferenceDragEnd}
              >
                <button
                  type="button"
                  className="character-list-delete-btn character-reference-delete-btn"
                  aria-label={`Remove reference ${index + 1}`}
                  onClick={() => {
                    onRemoveItem(item.id);
                  }}
                  disabled={pageBusy}
                >
                  <Trash size={12} weight="bold" />
                </button>
                <div
                  className="character-reference-upload-image-wrap"
                  onDoubleClick={() => {
                    onOpenReferencePreview(index, null);
                  }}
                  title="Double-click to preview this reference image"
                >
                  <Image
                    src={resolveCharacterGridPreviewUrl(item.previewUrl, 320) ?? item.previewUrl}
                    alt={`Reference ${index + 1}`}
                    className="character-reference-upload-image"
                    width={320}
                    height={240}
                    unoptimized
                  />
                </div>
              </article>
            ))}

            <button
              type="button"
              className="character-reference-upload-placeholder"
              onClick={onOpenUploadPicker}
              disabled={pageBusy}
              aria-label="Upload quick swap reference image"
            >
              <UploadSimple
                size={16}
                weight="bold"
                className="character-reference-upload-placeholder-icon"
                aria-hidden="true"
              />
              <span className="character-reference-upload-placeholder-label">Click to upload</span>
            </button>
          </div>
        </div>

        {archivedCount > 0 ? (
          <div className="character-quickswap-archive-panel">
            <button
              type="button"
              className="ghost-btn mini character-quickswap-archive-toggle"
              aria-expanded={isArchiveOpen}
              onClick={() => {
                setIsArchiveOpen((current) => {
                  const nextOpen = !current;
                  if (nextOpen && archivedItems.length === 0 && archivedCount > 0) {
                    onLoadMoreArchived();
                  }
                  return nextOpen;
                });
              }}
            >
              {isArchiveOpen ? "Hide" : "Show"} Archived ({archivedCount})
            </button>
            {isArchiveOpen ? (
              <div
                className="character-quickswap-archive-grid"
                role="list"
                aria-label="Archived references"
              >
                {archivedItems.map((item) => (
                  <article
                    key={item.id}
                    role="listitem"
                    className="character-quickswap-archive-card"
                  >
                    <div className="character-reference-upload-image-wrap">
                      <Image
                        src={
                          resolveCharacterGridPreviewUrl(item.previewUrl, 220) ?? item.previewUrl
                        }
                        alt="Archived reference"
                        className="character-reference-upload-image"
                        width={220}
                        height={180}
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => {
                        onRestoreArchivedItem(item.id);
                      }}
                      disabled={pageBusy}
                    >
                      Restore
                    </button>
                  </article>
                ))}
                {hasMoreArchived ? (
                  <button
                    type="button"
                    className="character-reference-upload-placeholder character-reference-upload-placeholder--archive-more"
                    onClick={() => {
                      onLoadMoreArchived();
                    }}
                    disabled={loadingArchived || pageBusy}
                  >
                    <span className="character-reference-upload-placeholder-label">
                      {loadingArchived ? "Loading..." : "Load more"}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
