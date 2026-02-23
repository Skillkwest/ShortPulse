import React from "react";
import type { StudioOutput } from "../../types";
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
  showHeader: boolean;
  archiveCount: number;
  isArchivePanelOpen: boolean;
  archivedOutputs: StudioOutput[];
  onToggleArchivePanel: () => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
  horizontalSplit: HorizontalSplitViewModel;
  curatedSectionRef: React.MutableRefObject<HTMLDivElement | null>;
  curatedHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
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
  showHeader,
  archiveCount,
  isArchivePanelOpen,
  archivedOutputs,
  onToggleArchivePanel,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  horizontalSplit,
  curatedSectionRef,
  curatedHeaderRef,
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
  return (
    <>
      {!isCuratedSplitEnabled ? (
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
        {isCuratedSplitEnabled ? (
          <>
            <div
              ref={curatedSectionRef}
              className={`reference-curated-section${isCuratedDropActive ? " is-drop-active" : ""}${horizontalSplit.isAllRefsExpanded ? " is-all-refs-expanded" : ""}`}
              style={horizontalSplit.topSectionStyle}
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
          </>
        ) : null}
        <div
          className={`reference-all-refs-section${horizontalSplit.isInventoryExpanded ? " is-inventory-expanded" : ""}`}
          style={isCuratedSplitEnabled ? horizontalSplit.bottomSectionStyle : undefined}
        >
          {isCuratedSplitEnabled ? (
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
                  <p className="preview-title">Upload or generate to see your references here.</p>
                  <p className="subdued tiny helper-text">
                    New text prompts, images, and videos will appear in this grid.
                  </p>
                </div>
              ) : (
                <>
                  {topSpacerHeight > 0 ? (
                    <div className="reference-virtual-spacer" style={{ height: topSpacerHeight }} />
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
