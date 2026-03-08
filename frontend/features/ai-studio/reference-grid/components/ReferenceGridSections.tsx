import React from "react";
import type { StudioOutput } from "../../types";
import { CanvasPropertiesPanel } from "../../components/canvas/CanvasPropertiesPanel";
import type { CanvasPropertiesPanelProps } from "../../components/canvas/useAiStudioCanvasWorkspaceState";
import type { ExpertEditStyleTile } from "../../components/edit/expertEditStyles";
import { resolveStylePreviewBackgroundImage } from "../../components/edit/expertEditStyles";
import { ReferenceGridArchiveControls } from "./ReferenceGridArchiveControls";

type HorizontalSplitViewModel = {
  isAllRefsExpanded: boolean;
  topSectionStyle?: React.CSSProperties;
  dividerProps: React.HTMLAttributes<HTMLDivElement>;
  snapToInventoryExpanded: () => void;
  snapToAllRefsExpanded: (targetTopHeightPx?: number) => void;
  isInventoryExpanded: boolean;
  bottomSectionStyle?: React.CSSProperties;
};

type ReferenceGridSectionsProps = {
  isCuratedSplitEnabled: boolean;
  isCuratedDropActive: boolean;
  showQuickSlotSection: boolean;
  showReferenceGridSection: boolean;
  showStylesSection: boolean;
  showHeader: boolean;
  archiveCount: number;
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
  selectedTool: string | null;
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
  selectedTool,
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
  const styleTiles = stylesPanel?.styles ?? [];
  const hasInventorySections =
    showQuickSlotSection || showReferenceGridSection || showStylesSection;
  const showCanvasInventoryDivider = showRailCanvasSection && hasInventorySections;
  const showQuickSlotReferenceDivider = showQuickSlotSection && showReferenceGridSection;
  const showStylesReferenceDivider = showStylesSection && showReferenceGridSection;
  const showQuickSlotStylesDivider =
    showStylesSection && showQuickSlotSection && !showReferenceGridSection;
  const showStylesInventoryDivider = showStylesReferenceDivider || showQuickSlotStylesDivider;
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
  const shouldShowArchiveControls = showReferenceGridSection && !isCuratedSplitEnabled;
  const showEmptyState = !showRailCanvasSection && !hasInventorySections;
  return (
    <>
      {shouldShowArchiveControls ? (
        <ReferenceGridArchiveControls
          archiveCount={archiveCount}
          showHeader={showHeader}
          isArchivePanelOpen={isArchivePanelOpen}
          archivedOutputs={archivedOutputs}
          onToggleArchivePanel={onToggleArchivePanel}
          onTriggerFileSelect={onTriggerFileSelect}
          onOpenMediaLibrary={onOpenMediaLibrary}
          onRestoreArchivedOutput={onRestoreArchivedOutput}
          onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
        />
      ) : null}
      <div className={`reference-grid-sections${isCuratedSplitEnabled ? " is-curated-split" : ""}`}>
        {showRailCanvasSection && railCanvasProps ? (
          <>
            <div
              ref={railCanvasSectionRef}
              className={`reference-rail-canvas-section${showCanvasInventoryDivider && railCanvasSplit.isAllRefsExpanded ? " is-inventory-expanded" : ""}`}
              style={showCanvasInventoryDivider ? railCanvasSplit.topSectionStyle : undefined}
            >
              <div ref={railCanvasHeaderRef} className="reference-rail-canvas-header">
                <p className="eyebrow">Canvas</p>
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
              showCanvasInventoryDivider && railCanvasSplit.isInventoryExpanded
                ? " is-canvas-expanded"
                : ""
            }`}
            style={showCanvasInventoryDivider ? railCanvasSplit.bottomSectionStyle : undefined}
          >
            {showQuickSlotSection ? (
              <>
                <div
                  ref={curatedSectionRef}
                  className={`reference-curated-section${isCuratedDropActive ? " is-drop-active" : ""}${
                    (showQuickSlotReferenceDivider && horizontalSplit.isAllRefsExpanded) ||
                    (showQuickSlotStylesDivider && stylesSplit.isAllRefsExpanded)
                      ? " is-all-refs-expanded"
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
                  <div ref={curatedHeaderRef} className="reference-curated-header">
                    <p className="eyebrow">Quick Slot Inventory</p>
                  </div>
                  <div
                    className="reference-curated-scroll"
                    onScroll={handleCuratedScroll}
                    ref={curatedScrollContainerRef}
                  >
                    <div
                      className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
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
                className={`reference-all-refs-section${allRefsInventoryExpanded ? " is-inventory-expanded" : ""}`}
                style={
                  showStylesReferenceDivider
                    ? stylesSplit.topSectionStyle
                    : showQuickSlotReferenceDivider
                      ? horizontalSplit.bottomSectionStyle
                      : undefined
                }
              >
                <div ref={allRefsHeaderRef}>
                  {isCuratedSplitEnabled ? (
                    <ReferenceGridArchiveControls
                      archiveCount={archiveCount}
                      showHeader={showHeader}
                      isArchivePanelOpen={isArchivePanelOpen}
                      archivedOutputs={archivedOutputs}
                      hideUploadActions={allRefsInventoryExpanded}
                      onToggleArchivePanel={onToggleArchivePanel}
                      onTriggerFileSelect={onTriggerFileSelect}
                      onOpenMediaLibrary={onOpenMediaLibrary}
                      onRestoreArchivedOutput={onRestoreArchivedOutput}
                      onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
                    />
                  ) : null}
                </div>
                <div
                  className="reference-canvas-scroll"
                  onScroll={handleAllRefsScroll}
                  ref={scrollContainerRef}
                >
                  <div
                    className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
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
                  className={`reference-all-refs-section${allRefsInventoryExpanded ? " is-inventory-expanded" : ""}`}
                  style={stylesSplit.topSectionStyle}
                >
                  <div ref={allRefsHeaderRef}>
                    {isCuratedSplitEnabled ? (
                      <ReferenceGridArchiveControls
                        archiveCount={archiveCount}
                        showHeader={showHeader}
                        isArchivePanelOpen={isArchivePanelOpen}
                        archivedOutputs={archivedOutputs}
                        hideUploadActions={allRefsInventoryExpanded}
                        onToggleArchivePanel={onToggleArchivePanel}
                        onTriggerFileSelect={onTriggerFileSelect}
                        onOpenMediaLibrary={onOpenMediaLibrary}
                        onRestoreArchivedOutput={onRestoreArchivedOutput}
                        onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
                      />
                    ) : null}
                  </div>
                  <div
                    className="reference-canvas-scroll"
                    onScroll={handleAllRefsScroll}
                    ref={scrollContainerRef}
                  >
                    <div
                      className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
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
                        const targetTopHeightPx =
                          headerNode instanceof HTMLElement ? headerNode.offsetHeight : undefined;
                        stylesSplit.snapToAllRefsExpanded(targetTopHeightPx);
                      }}
                    >
                      Styles ↑
                    </button>
                  </div>
                ) : null}
                <section
                  id="reference-rail-styles-section"
                  className={`reference-styles-section${
                    showStylesReferenceDivider && stylesSplit.isAllRefsExpanded
                      ? " is-reference-grid-expanded"
                      : ""
                  }`}
                  style={showStylesInventoryDivider ? stylesSplit.bottomSectionStyle : undefined}
                  aria-label="Styles"
                >
                  <div ref={stylesHeaderRef} className="reference-styles-header">
                    <p className="eyebrow">Styles</p>
                    <p className="tiny subdued helper-text">
                      Choose a style preset now. Drag-and-drop workflow support is coming soon.
                    </p>
                  </div>
                  <div className="reference-styles-scroll">
                    <div className="reference-styles-grid" role="list" aria-label="Style options">
                      {styleTiles.map((style) => {
                        const isSelected =
                          !style.placeholder && stylesPanel?.selectedStyleId === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            className={`reference-styles-tile ${
                              isSelected ? "is-selected" : ""
                            } ${style.placeholder ? "is-placeholder" : ""}`.trim()}
                            aria-label={`Style tile: ${style.title}${
                              style.placeholder ? " (coming soon)" : ""
                            }`}
                            aria-pressed={style.placeholder ? undefined : isSelected}
                            disabled={style.placeholder}
                            onClick={() => {
                              if (style.placeholder) return;
                              stylesPanel?.onSelectStyle?.(style.id);
                            }}
                          >
                            <span className="reference-styles-tile-title">{style.title}</span>
                            <span
                              className="reference-styles-tile-preview"
                              style={
                                style.previewUrl
                                  ? {
                                      backgroundImage: resolveStylePreviewBackgroundImage(
                                        style.previewUrl
                                      ),
                                    }
                                  : undefined
                              }
                              aria-hidden="true"
                            >
                              {style.placeholder ? (
                                <span className="reference-styles-tile-coming-soon">
                                  Coming soon
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {showStylesSection && !showNestedReferenceStylesStack ? (
              <>
                {showStylesInventoryDivider ? (
                  <div
                    className="reference-grid-horizontal-divider-wrap reference-grid-horizontal-divider-wrap--styles"
                    {...stylesSplit.dividerProps}
                  >
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
                        const targetTopHeightPx =
                          headerNode instanceof HTMLElement ? headerNode.offsetHeight : undefined;
                        stylesSplit.snapToAllRefsExpanded(targetTopHeightPx);
                      }}
                    >
                      Styles ↑
                    </button>
                  </div>
                ) : null}
                <section
                  id="reference-rail-styles-section"
                  className={`reference-styles-section${
                    showStylesReferenceDivider && stylesSplit.isAllRefsExpanded
                      ? " is-reference-grid-expanded"
                      : ""
                  }`}
                  style={showStylesInventoryDivider ? stylesSplit.bottomSectionStyle : undefined}
                  aria-label="Styles"
                >
                  <div ref={stylesHeaderRef} className="reference-styles-header">
                    <p className="eyebrow">Styles</p>
                    <p className="tiny subdued helper-text">
                      Choose a style preset now. Drag-and-drop workflow support is coming soon.
                    </p>
                  </div>
                  <div className="reference-styles-scroll">
                    <div className="reference-styles-grid" role="list" aria-label="Style options">
                      {styleTiles.map((style) => {
                        const isSelected =
                          !style.placeholder && stylesPanel?.selectedStyleId === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            className={`reference-styles-tile ${
                              isSelected ? "is-selected" : ""
                            } ${style.placeholder ? "is-placeholder" : ""}`.trim()}
                            aria-label={`Style tile: ${style.title}${
                              style.placeholder ? " (coming soon)" : ""
                            }`}
                            aria-pressed={style.placeholder ? undefined : isSelected}
                            disabled={style.placeholder}
                            onClick={() => {
                              if (style.placeholder) return;
                              stylesPanel?.onSelectStyle?.(style.id);
                            }}
                          >
                            <span className="reference-styles-tile-title">{style.title}</span>
                            <span
                              className="reference-styles-tile-preview"
                              style={
                                style.previewUrl
                                  ? {
                                      backgroundImage: resolveStylePreviewBackgroundImage(
                                        style.previewUrl
                                      ),
                                    }
                                  : undefined
                              }
                              aria-hidden="true"
                            >
                              {style.placeholder ? (
                                <span className="reference-styles-tile-coming-soon">
                                  Coming soon
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        ) : null}
        {showEmptyState ? (
          <div className="reference-grid-panel-empty" role="status" aria-live="polite">
            <p className="preview-title">Right-rail panels are hidden.</p>
            <p className="subdued tiny helper-text">
              Use the header toggles to show Canvas, Quick Slot Inventory, Reference Grid, or
              Styles.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * @deprecated Use `ReferenceGridSections`.
 */
export type ReferenceCanvasSectionsProps = ReferenceGridSectionsProps;

/**
 * @deprecated Use `ReferenceGridSections`.
 */
export const ReferenceCanvasSections = ReferenceGridSections;
