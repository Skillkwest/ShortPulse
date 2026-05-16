import React from "react";
import type { StudioOutput } from "../../types";
import { CanvasPropertiesPanel } from "../../components/canvas/CanvasPropertiesPanel";
import type { CanvasPropertiesPanelProps } from "../../components/canvas/useAiStudioCanvasWorkspaceState";
import type { ExpertEditStyleTile } from "../../components/edit/expertEditStyles";
import { ReferenceGridArchiveControls } from "./ReferenceGridArchiveControls";
import { ReferenceStylesChooser } from "./ReferenceStylesChooser";

type HorizontalSplitViewModel = {
  isAllRefsExpanded: boolean;
  topSectionHeightPx: number;
  bottomSectionHeightPx: number;
  topSectionStyle?: React.CSSProperties;
  dividerProps: React.HTMLAttributes<HTMLDivElement>;
  snapToInventoryExpanded: () => void;
  snapToAllRefsExpanded: (targetTopHeightPx?: number) => void;
  isInventoryExpanded: boolean;
  bottomSectionStyle?: React.CSSProperties;
};
const STYLES_REFERENCE_GRID_UPLOAD_HIDE_BUFFER_PX = 44;
const STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX = 24;
const QUICK_SLOT_COLLAPSE_TOP_HEIGHT_PX = 24;
const QUICK_SLOT_HIDE_CONTENT_BUFFER_PX = 44;
const CANVAS_COLLAPSE_TOP_HEIGHT_PX = 24;
const CANVAS_HIDE_CONTENT_BUFFER_PX = 44;

type ReferenceGridSectionsProps = {
  isCuratedSplitEnabled: boolean;
  isCuratedDropActive: boolean;
  showQuickSlotSection: boolean;
  showReferenceGridSection: boolean;
  showStylesSection: boolean;
  showHeader: boolean;
  archiveCount: number;
  topNotice?: string | null;
  isArchivePanelOpen: boolean;
  archivedOutputs: StudioOutput[];
  onToggleArchivePanel: () => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
  railCanvasProps?: CanvasPropertiesPanelProps;
  showRailCanvasSection: boolean;
  railCanvasSplit: HorizontalSplitViewModel;
  stylesSplit: HorizontalSplitViewModel;
  referenceGridStylesStackRef: React.MutableRefObject<HTMLDivElement | null>;
  stylesPanel?: {
    isOpen: boolean;
    selectedStyleId: string | null;
    styles: readonly ExpertEditStyleTile[];
    onSelectStyle?: (styleId: string | null) => void;
  };
  railCanvasSectionRef: React.MutableRefObject<HTMLDivElement | null>;
  railCanvasHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
  horizontalSplit: HorizontalSplitViewModel;
  inventoryStackRef: React.MutableRefObject<HTMLDivElement | null>;
  curatedSectionRef: React.MutableRefObject<HTMLDivElement | null>;
  curatedHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
  allRefsHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
  stylesHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
  curatedScrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  curatedGridRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  gridRef: React.MutableRefObject<HTMLDivElement | null>;
  handleCuratedSectionDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleCuratedSectionDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedSectionDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedSectionDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handleCuratedScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  handleAllRefsScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  isWideLayout: boolean;
  curatedGridStyle: React.CSSProperties;
  gridStyle: React.CSSProperties;
  curatedOutputsLength: number;
  outputsLength: number;
  curatedTopSpacerHeight: number;
  curatedBottomSpacerHeight: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  curatedCardNodes: React.ReactNode[];
  allRefsCardNodes: React.ReactNode[];
};

/**
 * Layout-only view for split/non-split reference-grid sections.
 */
export function ReferenceGridSections({
  isCuratedSplitEnabled,
  isCuratedDropActive,
  showQuickSlotSection,
  showReferenceGridSection,
  showStylesSection,
  showHeader,
  archiveCount,
  topNotice,
  isArchivePanelOpen,
  archivedOutputs,
  onToggleArchivePanel,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  railCanvasProps,
  showRailCanvasSection,
  railCanvasSplit,
  stylesSplit,
  referenceGridStylesStackRef,
  stylesPanel,
  railCanvasSectionRef,
  railCanvasHeaderRef,
  horizontalSplit,
  inventoryStackRef,
  curatedSectionRef,
  curatedHeaderRef,
  allRefsHeaderRef,
  stylesHeaderRef,
  curatedScrollContainerRef,
  curatedGridRef,
  scrollContainerRef,
  gridRef,
  handleCuratedSectionDrop,
  handleCuratedSectionDragOver,
  handleCuratedSectionDragEnter,
  handleCuratedSectionDragLeave,
  handleCuratedScroll,
  handleAllRefsScroll,
  isWideLayout,
  curatedGridStyle,
  gridStyle,
  curatedOutputsLength,
  outputsLength,
  curatedTopSpacerHeight,
  curatedBottomSpacerHeight,
  topSpacerHeight,
  bottomSpacerHeight,
  curatedCardNodes,
  allRefsCardNodes,
}: ReferenceGridSectionsProps) {
  const hasInventorySections =
    showQuickSlotSection || showReferenceGridSection || showStylesSection;
  const showCanvasInventoryDivider = showRailCanvasSection && hasInventorySections;
  const showQuickSlotReferenceDivider = showQuickSlotSection && showReferenceGridSection;
  const showStylesReferenceDivider = showStylesSection && showReferenceGridSection;
  const showQuickSlotStylesDivider =
    showStylesSection && showQuickSlotSection && !showReferenceGridSection;
  const showStylesInventoryDivider = showStylesReferenceDivider || showQuickSlotStylesDivider;
  const isQuickSlotNearCollapsedForReferenceGrid =
    showQuickSlotReferenceDivider &&
    horizontalSplit.topSectionHeightPx > 0 &&
    horizontalSplit.topSectionHeightPx <=
      QUICK_SLOT_COLLAPSE_TOP_HEIGHT_PX + QUICK_SLOT_HIDE_CONTENT_BUFFER_PX;
  const isQuickSlotNearCollapsedForStyles =
    showQuickSlotStylesDivider &&
    stylesSplit.topSectionHeightPx > 0 &&
    stylesSplit.topSectionHeightPx <=
      QUICK_SLOT_COLLAPSE_TOP_HEIGHT_PX + QUICK_SLOT_HIDE_CONTENT_BUFFER_PX;
  const isQuickSlotNearCollapsed =
    isQuickSlotNearCollapsedForReferenceGrid || isQuickSlotNearCollapsedForStyles;
  const isQuickSlotAllRefsExpanded =
    (showQuickSlotReferenceDivider && horizontalSplit.isAllRefsExpanded) ||
    (showQuickSlotStylesDivider && stylesSplit.isAllRefsExpanded);
  const isReferenceGridNearCollapsedForStyles =
    showStylesReferenceDivider &&
    stylesSplit.topSectionHeightPx > 0 &&
    stylesSplit.topSectionHeightPx <=
      STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX + STYLES_REFERENCE_GRID_UPLOAD_HIDE_BUFFER_PX;
  const isReferenceGridCollapsedForStyles =
    showStylesReferenceDivider &&
    (stylesSplit.isAllRefsExpanded || isReferenceGridNearCollapsedForStyles);
  const stylesInventoryDividerUpperSectionLabel = showStylesReferenceDivider
    ? "Reference Grid"
    : "Quick Slot Inventory";
  const allRefsInventoryExpanded = showStylesInventoryDivider
    ? stylesSplit.isInventoryExpanded
    : showQuickSlotReferenceDivider
      ? horizontalSplit.isInventoryExpanded
      : false;
  const showNestedReferenceStylesStack =
    showQuickSlotSection && showReferenceGridSection && showStylesSection;
  const canvasInventoryDividerTitle = showQuickSlotSection
    ? "Quick Slot Inventory"
    : showReferenceGridSection
      ? "Reference Grid"
      : "Styles";
  const showQuickSlotTitleInHeader = !showCanvasInventoryDivider;
  const showReferenceGridTitleInHeader =
    !showQuickSlotReferenceDivider && !showCanvasInventoryDivider;
  const isStylesDirectlyUnderCanvasDivider =
    showCanvasInventoryDivider &&
    showStylesSection &&
    !showQuickSlotSection &&
    !showReferenceGridSection;
  const showStylesTitleInHeader =
    !showStylesInventoryDivider && !isStylesDirectlyUnderCanvasDivider;
  const topVisiblePanel = showRailCanvasSection
    ? "canvas"
    : showQuickSlotSection
      ? "quick-slot"
      : showReferenceGridSection
        ? "reference-grid"
        : showStylesSection
          ? "styles"
          : null;
  const showTopHeaderDivider =
    topVisiblePanel === "canvas" ||
    topVisiblePanel === "quick-slot" ||
    topVisiblePanel === "reference-grid" ||
    topVisiblePanel === "styles";
  const showTopCanvasHeaderDivider = showTopHeaderDivider && topVisiblePanel === "canvas";
  const showTopQuickSlotHeaderDivider = showTopHeaderDivider && topVisiblePanel === "quick-slot";
  const showTopReferenceHeaderDivider =
    showTopHeaderDivider && topVisiblePanel === "reference-grid";
  const showTopStylesHeaderDivider = showTopHeaderDivider && topVisiblePanel === "styles";
  const isCanvasNearCollapsedForInventory =
    showCanvasInventoryDivider &&
    railCanvasSplit.topSectionHeightPx > 0 &&
    railCanvasSplit.topSectionHeightPx <=
      CANVAS_COLLAPSE_TOP_HEIGHT_PX + CANVAS_HIDE_CONTENT_BUFFER_PX;
  const isCanvasInventoryExpanded = showCanvasInventoryDivider && railCanvasSplit.isAllRefsExpanded;
  const hideReferenceGridUploadActionsBase =
    allRefsInventoryExpanded || isReferenceGridCollapsedForStyles;
  const hideReferenceGridUploadActions = hideReferenceGridUploadActionsBase;
  const showEmptyState = !showRailCanvasSection && !hasInventorySections;
  return (
    <>
      <div className={`reference-grid-sections${isCuratedSplitEnabled ? " is-curated-split" : ""}`}>
        {showRailCanvasSection && railCanvasProps ? (
          <>
            <div
              ref={railCanvasSectionRef}
              className={`reference-rail-canvas-section${
                isCanvasInventoryExpanded ? " is-inventory-expanded" : ""
              }${
                isCanvasNearCollapsedForInventory && !isCanvasInventoryExpanded
                  ? " is-divider-near-collapsed"
                  : ""
              }`}
              style={showCanvasInventoryDivider ? railCanvasSplit.topSectionStyle : undefined}
            >
              <div
                ref={railCanvasHeaderRef}
                className={`reference-rail-canvas-header${
                  showTopCanvasHeaderDivider ? " is-top-section-header" : ""
                }`}
              >
                <p className="eyebrow">Canvas</p>
                {showTopCanvasHeaderDivider ? (
                  <span className="reference-section-title-divider" aria-hidden="true" />
                ) : null}
              </div>
              <div className="reference-rail-canvas-body">
                <CanvasPropertiesPanel {...railCanvasProps} />
              </div>
            </div>
            {showCanvasInventoryDivider ? (
              <div
                className="reference-grid-horizontal-divider-wrap reference-grid-horizontal-divider-wrap--canvas-inventory"
                {...railCanvasSplit.dividerProps}
              >
                <span className="reference-grid-horizontal-divider-title" aria-hidden="true">
                  {canvasInventoryDividerTitle}
                </span>
                <button
                  type="button"
                  className="reference-grid-horizontal-divider-pill"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    railCanvasSplit.snapToInventoryExpanded();
                  }}
                >
                  Canvas ↓
                </button>
                <div className="reference-grid-horizontal-divider" />
                <button
                  type="button"
                  className="reference-grid-horizontal-divider-pill"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    const headerNode = railCanvasHeaderRef.current;
                    const targetTopHeightPx =
                      headerNode instanceof HTMLElement ? headerNode.offsetHeight : undefined;
                    railCanvasSplit.snapToAllRefsExpanded(targetTopHeightPx);
                  }}
                >
                  Inventory ↑
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        {hasInventorySections ? (
          <div
            ref={inventoryStackRef}
            className={`reference-grid-inventory-stack${
              showRailCanvasSection && railCanvasSplit.isInventoryExpanded
                ? " is-canvas-expanded"
                : ""
            }`}
            style={showRailCanvasSection ? railCanvasSplit.bottomSectionStyle : undefined}
          >
            {showQuickSlotSection ? (
              <>
                <div
                  ref={curatedSectionRef}
                  className={`reference-curated-section${
                    isCuratedDropActive ? " is-drop-active" : ""
                  }${isQuickSlotAllRefsExpanded ? " is-all-refs-expanded" : ""}${
                    isQuickSlotNearCollapsed && !isQuickSlotAllRefsExpanded
                      ? " is-divider-near-collapsed"
                      : ""
                  }`}
                  style={
                    showQuickSlotReferenceDivider
                      ? horizontalSplit.topSectionStyle
                      : showQuickSlotStylesDivider
                        ? stylesSplit.topSectionStyle
                        : undefined
                  }
                  onDrop={handleCuratedSectionDrop}
                  onDragOver={handleCuratedSectionDragOver}
                  onDragEnter={handleCuratedSectionDragEnter}
                  onDragLeave={handleCuratedSectionDragLeave}
                >
                  <div
                    ref={curatedHeaderRef}
                    className={`reference-curated-header${
                      showTopQuickSlotHeaderDivider ? " is-top-section-header" : ""
                    }${!showQuickSlotTitleInHeader ? " is-title-hidden" : ""}`}
                  >
                    {showQuickSlotTitleInHeader ? (
                      <>
                        <p className="eyebrow">Quick Slot Inventory</p>
                        {showTopQuickSlotHeaderDivider ? (
                          <span className="reference-section-title-divider" aria-hidden="true" />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <div
                    className="reference-curated-scroll"
                    onScroll={handleCuratedScroll}
                    ref={curatedScrollContainerRef}
                  >
                    <div
                      className={`reference-canvas-grid${isWideLayout ? " reference-canvas-grid--wide" : ""}`}
                      ref={curatedGridRef}
                      style={curatedGridStyle}
                    >
                      {curatedOutputsLength === 0 ? (
                        <div className="reference-curated-empty">
                          <p className="preview-title">
                            Drag &amp; drop references here from the Reference Grid.
                          </p>
                        </div>
                      ) : (
                        <>
                          {curatedTopSpacerHeight > 0 ? (
                            <div
                              className="reference-virtual-spacer"
                              style={{ height: curatedTopSpacerHeight }}
                            />
                          ) : null}
                          {curatedCardNodes}
                          {curatedBottomSpacerHeight > 0 ? (
                            <div
                              className="reference-virtual-spacer"
                              style={{ height: curatedBottomSpacerHeight }}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {showQuickSlotReferenceDivider ? (
                  <div
                    className="reference-grid-horizontal-divider-wrap"
                    {...horizontalSplit.dividerProps}
                  >
                    <span className="reference-grid-horizontal-divider-title" aria-hidden="true">
                      Reference Grid
                    </span>
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        horizontalSplit.snapToInventoryExpanded();
                      }}
                    >
                      Inventory ↓
                    </button>
                    <div className="reference-grid-horizontal-divider" />
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        const curatedHeaderNode = curatedSectionRef.current?.querySelector(
                          ".reference-curated-header"
                        );
                        const targetTopHeightPx =
                          curatedHeaderNode instanceof HTMLElement
                            ? curatedHeaderNode.offsetHeight
                            : undefined;
                        horizontalSplit.snapToAllRefsExpanded(targetTopHeightPx);
                      }}
                    >
                      All Refs ↑
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
            {showReferenceGridSection && !showNestedReferenceStylesStack ? (
              <div
                className={`reference-all-refs-section${allRefsInventoryExpanded ? " is-inventory-expanded" : ""}${
                  isReferenceGridCollapsedForStyles ? " is-reference-grid-collapsed" : ""
                }`}
                style={
                  showStylesReferenceDivider
                    ? stylesSplit.topSectionStyle
                    : showQuickSlotReferenceDivider
                      ? horizontalSplit.bottomSectionStyle
                      : undefined
                }
              >
                <div ref={allRefsHeaderRef}>
                  <ReferenceGridArchiveControls
                    archiveCount={archiveCount}
                    showHeader={showHeader}
                    showTitle={showReferenceGridTitleInHeader}
                    showTopTitleDivider={showTopReferenceHeaderDivider}
                    isArchivePanelOpen={isArchivePanelOpen}
                    archivedOutputs={archivedOutputs}
                    hideUploadActions={hideReferenceGridUploadActions}
                    onToggleArchivePanel={onToggleArchivePanel}
                    onTriggerFileSelect={onTriggerFileSelect}
                    onOpenMediaLibrary={onOpenMediaLibrary}
                    onRestoreArchivedOutput={onRestoreArchivedOutput}
                    onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
                  />
                </div>
                {topNotice ? (
                  <div className="inline-warning-hint reference-grid-top-warning">{topNotice}</div>
                ) : null}
                <div
                  className="reference-canvas-scroll"
                  onScroll={handleAllRefsScroll}
                  ref={scrollContainerRef}
                >
                  <div
                    className={`reference-canvas-grid${isWideLayout ? " reference-canvas-grid--wide" : ""}`}
                    ref={gridRef}
                    style={gridStyle}
                  >
                    {outputsLength === 0 ? (
                      <div className="reference-empty">
                        <p className="preview-title">
                          Upload or generate to see your references here.
                        </p>
                        <p className="subdued tiny helper-text">
                          New text prompts, images, and videos will appear in this grid.
                        </p>
                      </div>
                    ) : (
                      <>
                        {topSpacerHeight > 0 ? (
                          <div
                            className="reference-virtual-spacer"
                            style={{ height: topSpacerHeight }}
                          />
                        ) : null}
                        {allRefsCardNodes}
                        {bottomSpacerHeight > 0 ? (
                          <div
                            className="reference-virtual-spacer"
                            style={{ height: bottomSpacerHeight }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {showNestedReferenceStylesStack ? (
              <div
                ref={referenceGridStylesStackRef}
                className="reference-all-refs-styles-stack"
                style={
                  showQuickSlotReferenceDivider ? horizontalSplit.bottomSectionStyle : undefined
                }
              >
                <div
                  className={`reference-all-refs-section${allRefsInventoryExpanded ? " is-inventory-expanded" : ""}${
                    isReferenceGridCollapsedForStyles ? " is-reference-grid-collapsed" : ""
                  }`}
                  style={stylesSplit.topSectionStyle}
                >
                  <div ref={allRefsHeaderRef}>
                    <ReferenceGridArchiveControls
                      archiveCount={archiveCount}
                      showHeader={showHeader}
                      showTitle={showReferenceGridTitleInHeader}
                      showTopTitleDivider={showTopReferenceHeaderDivider}
                      isArchivePanelOpen={isArchivePanelOpen}
                      archivedOutputs={archivedOutputs}
                      hideUploadActions={hideReferenceGridUploadActions}
                      onToggleArchivePanel={onToggleArchivePanel}
                      onTriggerFileSelect={onTriggerFileSelect}
                      onOpenMediaLibrary={onOpenMediaLibrary}
                      onRestoreArchivedOutput={onRestoreArchivedOutput}
                      onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
                    />
                  </div>
                  {topNotice ? (
                    <div className="inline-warning-hint reference-grid-top-warning">
                      {topNotice}
                    </div>
                  ) : null}
                  <div
                    className="reference-canvas-scroll"
                    onScroll={handleAllRefsScroll}
                    ref={scrollContainerRef}
                  >
                    <div
                      className={`reference-canvas-grid${isWideLayout ? " reference-canvas-grid--wide" : ""}`}
                      ref={gridRef}
                      style={gridStyle}
                    >
                      {outputsLength === 0 ? (
                        <div className="reference-empty">
                          <p className="preview-title">
                            Upload or generate to see your references here.
                          </p>
                          <p className="subdued tiny helper-text">
                            New text prompts, images, and videos will appear in this grid.
                          </p>
                        </div>
                      ) : (
                        <>
                          {topSpacerHeight > 0 ? (
                            <div
                              className="reference-virtual-spacer"
                              style={{ height: topSpacerHeight }}
                            />
                          ) : null}
                          {allRefsCardNodes}
                          {bottomSpacerHeight > 0 ? (
                            <div
                              className="reference-virtual-spacer"
                              style={{ height: bottomSpacerHeight }}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {showStylesInventoryDivider ? (
                  <div
                    className="reference-grid-horizontal-divider-wrap reference-grid-horizontal-divider-wrap--styles"
                    {...stylesSplit.dividerProps}
                  >
                    <span className="reference-grid-horizontal-divider-title" aria-hidden="true">
                      Styles
                    </span>
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        stylesSplit.snapToInventoryExpanded();
                      }}
                    >
                      {stylesInventoryDividerUpperSectionLabel} ↓
                    </button>
                    <div className="reference-grid-horizontal-divider" />
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        const headerNode = showStylesReferenceDivider
                          ? allRefsHeaderRef.current
                          : curatedHeaderRef.current;
                        const targetTopHeightPx = showStylesReferenceDivider
                          ? STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX
                          : headerNode instanceof HTMLElement
                            ? headerNode.offsetHeight
                            : undefined;
                        stylesSplit.snapToAllRefsExpanded(targetTopHeightPx);
                      }}
                    >
                      Styles ↑
                    </button>
                  </div>
                ) : null}
                <ReferenceStylesChooser
                  showStylesReferenceDivider={showStylesReferenceDivider}
                  showStylesInventoryDivider={showStylesInventoryDivider}
                  showStylesTitleInHeader={showStylesTitleInHeader}
                  showTopStylesHeaderDivider={showTopStylesHeaderDivider}
                  stylesHeaderRef={stylesHeaderRef}
                  stylesPanel={stylesPanel}
                  isReferenceGridExpanded={stylesSplit.isAllRefsExpanded}
                  sectionStyle={stylesSplit.bottomSectionStyle}
                />
              </div>
            ) : null}
            {showStylesSection && !showNestedReferenceStylesStack ? (
              <>
                {showStylesInventoryDivider ? (
                  <div
                    className="reference-grid-horizontal-divider-wrap reference-grid-horizontal-divider-wrap--styles"
                    {...stylesSplit.dividerProps}
                  >
                    <span className="reference-grid-horizontal-divider-title" aria-hidden="true">
                      Styles
                    </span>
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        stylesSplit.snapToInventoryExpanded();
                      }}
                    >
                      {stylesInventoryDividerUpperSectionLabel} ↓
                    </button>
                    <div className="reference-grid-horizontal-divider" />
                    <button
                      type="button"
                      className="reference-grid-horizontal-divider-pill"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        const headerNode = showStylesReferenceDivider
                          ? allRefsHeaderRef.current
                          : curatedHeaderRef.current;
                        const targetTopHeightPx = showStylesReferenceDivider
                          ? STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX
                          : headerNode instanceof HTMLElement
                            ? headerNode.offsetHeight
                            : undefined;
                        stylesSplit.snapToAllRefsExpanded(targetTopHeightPx);
                      }}
                    >
                      Styles ↑
                    </button>
                  </div>
                ) : null}
                <ReferenceStylesChooser
                  showStylesReferenceDivider={showStylesReferenceDivider}
                  showStylesInventoryDivider={showStylesInventoryDivider}
                  showStylesTitleInHeader={showStylesTitleInHeader}
                  showTopStylesHeaderDivider={showTopStylesHeaderDivider}
                  stylesHeaderRef={stylesHeaderRef}
                  stylesPanel={stylesPanel}
                  isReferenceGridExpanded={stylesSplit.isAllRefsExpanded}
                  sectionStyle={stylesSplit.bottomSectionStyle}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {showEmptyState ? (
          <div className="reference-grid-panel-empty" role="status" aria-live="polite">
            <p className="preview-title">Right-rail panels are hidden.</p>
            <p className="subdued tiny helper-text">
              Use the canvas toggle or the header shortcuts to show Quick Slot Inventory, Reference
              Grid, or Styles.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
