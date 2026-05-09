/**
 * Character QuickSwap section component.
 * Renders active and archived quick-swap references with upload and drag/drop affordances.
 */
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Trash, UploadSimple } from "phosphor-react";
import { resolveVirtualGridWindow, sliceVirtualGridEntries } from "../logic/quickSwapVirtualGrid";
import type { CharacterQuickSwapItem } from "../types";

type CharacterQuickSwapDeckSectionProps = {
  showCollapseToggle?: boolean;
  showHelperText?: boolean;
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
  quickSwapGridColumnCount: number;
  quickSwapArchiveGridColumnCount: number;
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
  resolveQuickSwapPreviewUrl?: (
    item: CharacterQuickSwapItem,
    cardLongEdgePx: number
  ) => string | null;
  onCardPreviewError?: (item: CharacterQuickSwapItem, failedUrl: string | null) => void;
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
};

type QuickSwapScrollStyle = React.CSSProperties & {
  "--character-quickswap-columns"?: string;
};

const ACTIVE_GRID_GAP_PX = 4;
const ARCHIVE_GRID_GAP_PX = 6;
const ACTIVE_CARD_MIN_WIDTH_PX = 108;
const ACTIVE_CARD_MAX_WIDTH_PX = 192;
const ACTIVE_CARD_MAX_COLUMNS = 4;
const ACTIVE_CARD_ASPECT_HEIGHT_MULTIPLIER = 5 / 4;
const ARCHIVE_CARD_ESTIMATED_CHROME_PX = 46;
const ARCHIVE_CARD_IMAGE_HEIGHT_MULTIPLIER = 11 / 16;
const GRID_OVERSCAN_ROWS = 1;
const ACTIVE_VIRTUALIZE_MIN_ROWS = 6;
const ARCHIVE_VIRTUALIZE_MIN_ROWS = 6;

const resolveCardWidth = ({
  viewportWidth,
  columnCount,
  gapPx,
  maxWidthPx,
}: {
  viewportWidth: number;
  columnCount: number;
  gapPx: number;
  maxWidthPx: number;
}): number => {
  const columns = Math.max(1, Math.floor(columnCount));
  const width = Math.max(0, viewportWidth - gapPx * (columns - 1)) / columns;
  return Math.max(1, Math.min(maxWidthPx, width));
};

const resolveActiveGridColumnCount = (
  viewportWidth: number,
  fallbackColumnCount: number
): number => {
  if (viewportWidth <= 0) {
    return Math.max(2, Math.min(ACTIVE_CARD_MAX_COLUMNS, Math.floor(fallbackColumnCount) || 4));
  }

  const readableColumnCount = Math.floor(
    (viewportWidth + ACTIVE_GRID_GAP_PX) / (ACTIVE_CARD_MIN_WIDTH_PX + ACTIVE_GRID_GAP_PX)
  );
  return Math.max(2, Math.min(ACTIVE_CARD_MAX_COLUMNS, readableColumnCount || 2));
};

/**
 * Renders the quick-swap deck with dynamic item counts and archived controls.
 */
export function CharacterQuickSwapDeckSection({
  showCollapseToggle = true,
  showHelperText = true,
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
  quickSwapGridColumnCount,
  quickSwapArchiveGridColumnCount,
  onToggleCollapsed,
  onOpenUploadPicker,
  onRemoveItem,
  onRestoreArchivedItem,
  onLoadMoreArchived,
  onReferenceDragStart,
  onReferenceDragEnd,
  onOpenReferencePreview,
  resolveCharacterGridPreviewUrl,
  resolveQuickSwapPreviewUrl,
  onCardPreviewError,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: CharacterQuickSwapDeckSectionProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const activeScrollRef = useRef<HTMLDivElement | null>(null);
  const archiveGridRef = useRef<HTMLDivElement | null>(null);
  const [activeScrollTop, setActiveScrollTop] = useState(0);
  const [activeViewportHeight, setActiveViewportHeight] = useState(0);
  const [activeViewportWidth, setActiveViewportWidth] = useState(0);
  const [archiveScrollTop, setArchiveScrollTop] = useState(0);
  const [archiveViewportHeight, setArchiveViewportHeight] = useState(0);
  const [archiveViewportWidth, setArchiveViewportWidth] = useState(0);
  const [archiveMeasuredCardHeight, setArchiveMeasuredCardHeight] = useState<number | null>(null);
  const effectiveQuickSwapGridColumnCount = useMemo(
    () => resolveActiveGridColumnCount(activeViewportWidth, quickSwapGridColumnCount),
    [activeViewportWidth, quickSwapGridColumnCount]
  );

  useEffect(() => {
    const node = activeScrollRef.current;
    if (!node) return;
    const syncMetrics = () => {
      setActiveViewportHeight(node.clientHeight);
      setActiveViewportWidth(node.clientWidth);
    };
    syncMetrics();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(syncMetrics);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [effectiveQuickSwapGridColumnCount]);

  useEffect(() => {
    if (!isArchiveOpen) return;
    const node = archiveGridRef.current;
    if (!node) return;
    const syncMetrics = () => {
      setArchiveViewportHeight(node.clientHeight);
      setArchiveViewportWidth(node.clientWidth);
    };
    syncMetrics();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(syncMetrics);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [isArchiveOpen, quickSwapArchiveGridColumnCount, archivedItems.length]);

  const activeCardWidth = useMemo(
    () =>
      resolveCardWidth({
        viewportWidth: activeViewportWidth,
        columnCount: effectiveQuickSwapGridColumnCount,
        gapPx: ACTIVE_GRID_GAP_PX,
        maxWidthPx: ACTIVE_CARD_MAX_WIDTH_PX,
      }),
    [activeViewportWidth, effectiveQuickSwapGridColumnCount]
  );
  const activeCardHeight = activeCardWidth * ACTIVE_CARD_ASPECT_HEIGHT_MULTIPLIER;
  const activeRenderableCount = activeItems.length + 1;
  const shouldVirtualizeActive =
    activeViewportHeight > 0 &&
    activeRenderableCount >
      Math.max(1, effectiveQuickSwapGridColumnCount) * ACTIVE_VIRTUALIZE_MIN_ROWS;
  const activeWindow = useMemo(
    () =>
      shouldVirtualizeActive
        ? resolveVirtualGridWindow({
            itemCount: activeRenderableCount,
            columnCount: effectiveQuickSwapGridColumnCount,
            viewportHeight: activeViewportHeight,
            scrollTop: activeScrollTop,
            rowHeight: activeCardHeight,
            rowGap: ACTIVE_GRID_GAP_PX,
            overscanRows: GRID_OVERSCAN_ROWS,
          })
        : {
            startIndex: 0,
            endIndexExclusive: activeRenderableCount,
            paddingTop: 0,
            paddingBottom: 0,
          },
    [
      activeCardHeight,
      activeRenderableCount,
      activeScrollTop,
      activeViewportHeight,
      effectiveQuickSwapGridColumnCount,
      shouldVirtualizeActive,
    ]
  );

  const visibleActiveEntries = useMemo(
    () =>
      sliceVirtualGridEntries(
        activeItems,
        activeWindow.startIndex,
        Math.min(activeItems.length, activeWindow.endIndexExclusive)
      ),
    [activeItems, activeWindow.endIndexExclusive, activeWindow.startIndex]
  );
  const shouldRenderUploadPlaceholder =
    activeItems.length >= activeWindow.startIndex &&
    activeItems.length < activeWindow.endIndexExclusive;
  const activeScrollStyle = useMemo<QuickSwapScrollStyle>(
    () => ({
      "--character-quickswap-columns": String(effectiveQuickSwapGridColumnCount),
    }),
    [effectiveQuickSwapGridColumnCount]
  );

  const archiveEstimatedCardHeight = useMemo(() => {
    const cardWidth = resolveCardWidth({
      viewportWidth: archiveViewportWidth,
      columnCount: quickSwapArchiveGridColumnCount,
      gapPx: ARCHIVE_GRID_GAP_PX,
      maxWidthPx: 100000,
    });
    return cardWidth * ARCHIVE_CARD_IMAGE_HEIGHT_MULTIPLIER + ARCHIVE_CARD_ESTIMATED_CHROME_PX;
  }, [archiveViewportWidth, quickSwapArchiveGridColumnCount]);
  const archiveCardHeight = archiveMeasuredCardHeight ?? archiveEstimatedCardHeight;
  const shouldVirtualizeArchive =
    isArchiveOpen &&
    archiveViewportHeight > 0 &&
    archivedItems.length >
      Math.max(1, quickSwapArchiveGridColumnCount) * ARCHIVE_VIRTUALIZE_MIN_ROWS;
  const archiveWindow = useMemo(
    () =>
      shouldVirtualizeArchive
        ? resolveVirtualGridWindow({
            itemCount: archivedItems.length,
            columnCount: quickSwapArchiveGridColumnCount,
            viewportHeight: archiveViewportHeight,
            scrollTop: archiveScrollTop,
            rowHeight: archiveCardHeight,
            rowGap: ARCHIVE_GRID_GAP_PX,
            overscanRows: GRID_OVERSCAN_ROWS,
          })
        : {
            startIndex: 0,
            endIndexExclusive: archivedItems.length,
            paddingTop: 0,
            paddingBottom: 0,
          },
    [
      archiveCardHeight,
      archiveScrollTop,
      archiveViewportHeight,
      archivedItems.length,
      quickSwapArchiveGridColumnCount,
      shouldVirtualizeArchive,
    ]
  );
  const visibleArchivedEntries = useMemo(
    () =>
      sliceVirtualGridEntries(
        archivedItems,
        archiveWindow.startIndex,
        archiveWindow.endIndexExclusive
      ),
    [archiveWindow.endIndexExclusive, archiveWindow.startIndex, archivedItems]
  );

  const handleArchiveCardMeasure = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const measuredHeight = node.getBoundingClientRect().height;
    if (measuredHeight > 0) {
      setArchiveMeasuredCardHeight(measuredHeight);
    }
  }, []);

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
          <div className="character-section-title-copy">
            <h3 className="character-section-title">QuickSwap Deck</h3>
            {!isCollapsed && showHelperText ? (
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

        <div
          ref={activeScrollRef}
          className="character-quickswap-active-scroll"
          style={activeScrollStyle}
          onScroll={(event) => {
            setActiveScrollTop((event.currentTarget as HTMLDivElement).scrollTop);
          }}
        >
          <div
            className="character-reference-upload-grid character-reference-upload-grid--drop-card"
            role="list"
            aria-label="Uploaded references"
            style={
              shouldVirtualizeActive
                ? {
                    paddingTop: `${activeWindow.paddingTop}px`,
                    paddingBottom: `${activeWindow.paddingBottom}px`,
                  }
                : undefined
            }
          >
            {visibleActiveEntries.map(({ item, absoluteIndex }) => (
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
                  aria-label={`Remove reference ${absoluteIndex + 1}`}
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
                    onOpenReferencePreview(absoluteIndex, null);
                  }}
                  title="Double-click to preview this reference image"
                >
                  <Image
                    src={
                      (resolveQuickSwapPreviewUrl
                        ? resolveQuickSwapPreviewUrl(item, 320)
                        : resolveCharacterGridPreviewUrl(item.previewUrl, 320)) ?? item.previewUrl
                    }
                    alt={`Reference ${absoluteIndex + 1}`}
                    className="character-reference-upload-image"
                    width={320}
                    height={240}
                    onError={(event) => {
                      onCardPreviewError?.(
                        item,
                        event.currentTarget.currentSrc || event.currentTarget.src || null
                      );
                    }}
                    unoptimized
                  />
                </div>
              </article>
            ))}

            {(!shouldVirtualizeActive || shouldRenderUploadPlaceholder) && (
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
                <span className="character-reference-upload-placeholder-label">
                  Click to upload
                </span>
              </button>
            )}
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
                ref={archiveGridRef}
                className="character-quickswap-archive-grid"
                role="list"
                aria-label="Archived references"
                onScroll={(event) => {
                  setArchiveScrollTop((event.currentTarget as HTMLDivElement).scrollTop);
                }}
                style={
                  shouldVirtualizeArchive
                    ? {
                        paddingTop: `${archiveWindow.paddingTop}px`,
                        paddingBottom: `${archiveWindow.paddingBottom}px`,
                      }
                    : undefined
                }
              >
                {visibleArchivedEntries.map(({ item, absoluteIndex }) => (
                  <article
                    key={item.id}
                    role="listitem"
                    className="character-quickswap-archive-card"
                    ref={
                      absoluteIndex === archiveWindow.startIndex
                        ? handleArchiveCardMeasure
                        : undefined
                    }
                  >
                    <div className="character-reference-upload-image-wrap">
                      <Image
                        src={
                          (resolveQuickSwapPreviewUrl
                            ? resolveQuickSwapPreviewUrl(item, 220)
                            : resolveCharacterGridPreviewUrl(item.previewUrl, 220)) ??
                          item.previewUrl
                        }
                        alt="Archived reference"
                        className="character-reference-upload-image"
                        width={220}
                        height={180}
                        onError={(event) => {
                          onCardPreviewError?.(
                            item,
                            event.currentTarget.currentSrc || event.currentTarget.src || null
                          );
                        }}
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
