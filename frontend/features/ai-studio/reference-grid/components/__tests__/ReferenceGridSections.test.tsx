import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  visibleItemCount: 0,
  topNotice: null,
  isArchivePanelOpen: false,
  archivedOutputs: [],
  onToggleArchivePanel: vi.fn(),
  onTriggerFileSelect: vi.fn(),
  onRestoreArchivedOutput: vi.fn(),
  onRestoreAllArchivedOutputs: vi.fn(),
  railCanvasProps: {
    camera: { x: 0, y: 0, zoom: 1.28 },
  } as never,
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the Canvas camera zoom badge in the Canvas header divider row", () => {
    const { container } = render(<ReferenceGridSections {...createProps()} showQuickSlotSection />);

    const header = container.querySelector<HTMLElement>(".reference-rail-canvas-header");
    const divider = container.querySelector<HTMLElement>(".reference-section-title-divider");
    const badge = screen.getByTestId("canvas-camera-zoom-badge");

    expect(header).toContainElement(badge);
    expect(header).toContainElement(divider);
    expect(badge).toHaveTextContent("128%");
    expect(badge).toHaveAttribute("aria-label", "Canvas zoom 128%");
  });

  it("updates the Canvas header zoom badge from the live Canvas props store", () => {
    const listeners = new Set<() => void>();
    let liveSnapshot = {
      camera: { x: 0, y: 0, zoom: 1.12 },
    };
    const railCanvasProps = {
      camera: liveSnapshot.camera,
      livePropsStore: {
        getSnapshot: () => liveSnapshot,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    } as never;

    render(
      <ReferenceGridSections
        {...createProps()}
        railCanvasProps={railCanvasProps}
        showQuickSlotSection
      />
    );

    expect(screen.getByTestId("canvas-camera-zoom-badge")).toHaveTextContent("112%");

    act(() => {
      liveSnapshot = {
        camera: { x: 0, y: 0, zoom: 0.37 },
      };
      listeners.forEach((listener) => listener());
    });

    expect(screen.getByTestId("canvas-camera-zoom-badge")).toHaveTextContent("37%");
  });

  it("shows the empty-state helper when no right-rail sections are visible", () => {
    render(
      <ReferenceGridSections
        {...createProps()}
        showRailCanvasSection={false}
        railCanvasProps={undefined}
      />
    );

    expect(screen.getByText("Right-rail panels are hidden.")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use the canvas toggle or the header shortcuts to show Quick Slot Inventory/i
      )
    ).toBeInTheDocument();
  });

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

  it("marks right-rail panel visibility changes so dividers can move smoothly", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <ReferenceGridSections {...createProps()} showQuickSlotSection />
    );
    const sections = container.querySelector(".reference-grid-sections");

    expect(sections).not.toHaveClass("is-panel-layout-animating");

    rerender(
      <ReferenceGridSections {...createProps()} showQuickSlotSection showReferenceGridSection />
    );

    expect(sections).toHaveClass("is-panel-layout-animating");

    act(() => {
      vi.advanceTimersByTime(320);
    });

    expect(sections).not.toHaveClass("is-panel-layout-animating");
  });

  it("removes canvas drop ownership when the canvas body is collapsed", () => {
    const { container } = render(
      <ReferenceGridSections
        {...createProps()}
        showQuickSlotSection
        railCanvasSplit={createSplitViewModel({
          topSectionHeightPx: 30,
          topSectionStyle: { height: "30px", flexBasis: "30px" },
        })}
      />
    );

    const canvasSection = container.querySelector(".reference-rail-canvas-section");
    expect(canvasSection).toHaveClass("is-divider-near-collapsed");
    expect(canvasSection).not.toHaveAttribute("data-right-rail-drop-surface");
    expect(screen.getByTestId("canvas-camera-zoom-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-properties-panel")).not.toBeInTheDocument();
  });

  it("does not mount the canvas body when the inventory section is expanded over canvas", () => {
    const { container } = render(
      <ReferenceGridSections
        {...createProps()}
        showQuickSlotSection
        railCanvasSplit={createSplitViewModel({
          isAllRefsExpanded: true,
        })}
      />
    );

    const canvasSection = container.querySelector(".reference-rail-canvas-section");
    expect(canvasSection).toHaveClass("is-inventory-expanded");
    expect(screen.getByTestId("canvas-camera-zoom-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-properties-panel")).not.toBeInTheDocument();
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
