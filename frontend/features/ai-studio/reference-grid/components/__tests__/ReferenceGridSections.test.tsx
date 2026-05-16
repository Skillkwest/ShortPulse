import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceGridSections } from "../ReferenceGridSections";

vi.mock("../../../components/canvas/CanvasPropertiesPanel", () => ({
  CanvasPropertiesPanel: () => <div data-testid="canvas-properties-panel" />,
}));

vi.mock("../ReferenceGridArchiveControls", () => ({
  ReferenceGridArchiveControls: () => <div data-testid="reference-grid-archive-controls" />,
}));

vi.mock("../../../components/edit/expertEditStyles", () => ({
  resolveStylePreviewBackgroundImage: () => "none",
  prependNoneStyleTile: (tiles: unknown[]) => tiles,
}));

const createSplitViewModel = (
  overrides: Partial<Parameters<typeof ReferenceGridSections>[0]["railCanvasSplit"]> = {}
) => ({
  isAllRefsExpanded: false,
  topSectionHeightPx: 180,
  bottomSectionHeightPx: 420,
  topSectionStyle: { height: "180px", flexBasis: "180px" } as React.CSSProperties,
  dividerProps: {},
  snapToInventoryExpanded: vi.fn(),
  snapToAllRefsExpanded: vi.fn(),
  isInventoryExpanded: false,
  bottomSectionStyle: { height: "420px", flexBasis: "420px" } as React.CSSProperties,
  ...overrides,
});

const createProps = (): React.ComponentProps<typeof ReferenceGridSections> => ({
  isCuratedSplitEnabled: true,
  isCuratedDropActive: false,
  showQuickSlotSection: false,
  showReferenceGridSection: false,
  showStylesSection: false,
  showHeader: true,
  archiveCount: 0,
  topNotice: null,
  isArchivePanelOpen: false,
  archivedOutputs: [],
  onToggleArchivePanel: vi.fn(),
  onTriggerFileSelect: vi.fn(),
  onOpenMediaLibrary: vi.fn(),
  onRestoreArchivedOutput: vi.fn(),
  onRestoreAllArchivedOutputs: vi.fn(),
  railCanvasProps: {} as never,
  showRailCanvasSection: true,
  railCanvasSplit: createSplitViewModel(),
  stylesSplit: createSplitViewModel(),
  referenceGridStylesStackRef: { current: null },
  stylesPanel: undefined,
  railCanvasSectionRef: { current: null },
  railCanvasHeaderRef: { current: null },
  horizontalSplit: createSplitViewModel(),
  inventoryStackRef: { current: null },
  curatedSectionRef: { current: null },
  curatedHeaderRef: { current: null },
  allRefsHeaderRef: { current: null },
  stylesHeaderRef: { current: null },
  curatedScrollContainerRef: { current: null },
  curatedGridRef: { current: null },
  scrollContainerRef: { current: null },
  gridRef: { current: null },
  handleCuratedSectionDrop: vi.fn(),
  handleCuratedSectionDragOver: vi.fn(),
  handleCuratedSectionDragEnter: vi.fn(),
  handleCuratedSectionDragLeave: vi.fn(),
  handleCuratedScroll: vi.fn(),
  handleAllRefsScroll: vi.fn(),
  isWideLayout: false,
  curatedGridStyle: {},
  gridStyle: {},
  curatedOutputsLength: 0,
  outputsLength: 0,
  curatedTopSpacerHeight: 0,
  curatedBottomSpacerHeight: 0,
  topSpacerHeight: 0,
  bottomSpacerHeight: 0,
  curatedCardNodes: [],
  allRefsCardNodes: [],
});

describe("ReferenceGridSections", () => {
  it("lets the canvas section fill the rail when it is the only visible section", () => {
    const { container } = render(<ReferenceGridSections {...createProps()} />);

    expect(screen.getByTestId("canvas-properties-panel")).toBeInTheDocument();
    expect(
      container.querySelector(".reference-grid-horizontal-divider-wrap--canvas-inventory")
    ).toBeNull();
    expect(container.querySelector(".reference-rail-canvas-section")).not.toHaveStyle({
      height: "180px",
      flexBasis: "180px",
    });
  });

  it("keeps the split sizing when another rail section is visible below canvas", () => {
    const { container } = render(<ReferenceGridSections {...createProps()} showQuickSlotSection />);

    expect(
      container.querySelector(".reference-grid-horizontal-divider-wrap--canvas-inventory")
    ).not.toBeNull();
    expect(container.querySelector(".reference-rail-canvas-section")).toHaveStyle({
      height: "180px",
      flexBasis: "180px",
    });
  });

  it("labels the canvas divider with the first visible downstream section", () => {
    const { rerender } = render(
      <ReferenceGridSections {...createProps()} showReferenceGridSection />
    );

    expect(screen.getByText("Reference Grid")).toBeInTheDocument();
    expect(screen.queryByText("Quick Slot Inventory")).not.toBeInTheDocument();

    rerender(<ReferenceGridSections {...createProps()} showStylesSection />);

    expect(screen.getByText("Styles")).toBeInTheDocument();
    expect(screen.queryByText("Quick Slot Inventory")).not.toBeInTheDocument();
  });
});
