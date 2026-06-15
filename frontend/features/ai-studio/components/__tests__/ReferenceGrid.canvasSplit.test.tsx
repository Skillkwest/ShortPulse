import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";
import type { StudioOutput } from "../../types";

vi.mock("../canvas/CanvasPropertiesPanel", () => ({
  CanvasPropertiesPanel: ({
    onInteractionActiveChange,
  }: {
    onInteractionActiveChange?: (active: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="canvas-properties-panel"
      onPointerDown={() => onInteractionActiveChange?.(true)}
      onPointerUp={() => onInteractionActiveChange?.(false)}
    />
  ),
}));

class MockResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

class MockIntersectionObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

const outputs: StudioOutput[] = [
  {
    id: "out-1",
    prompt: "One",
    mode: "image",
    aspect: "1:1",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    previewUrl: "https://example.com/one.png",
  },
];

const createProps = (overrides: Partial<ReferenceGridProps> = {}): ReferenceGridProps => ({
  outputs,
  activeOutputId: "out-1",
  selectedTool: "image",
  onSelectOutput: vi.fn(),
  onOpenDetails: vi.fn(),
  curatedReferenceIds: [],
  onAddCuratedReference: vi.fn(),
  onRemoveCuratedReference: vi.fn(),
  onReorderCuratedReference: vi.fn(),
  onPasteTextReference: vi.fn(),
  ...overrides,
});

const createDragTransfer = (): DataTransfer =>
  ({
    files: { length: 0, item: () => null },
    types: [],
    effectAllowed: "copy",
    dropEffect: "copy",
    setData: vi.fn(),
    getData: vi.fn(() => ""),
    setDragImage: vi.fn(),
  }) as unknown as DataTransfer;

describe("ReferenceGrid canvas split", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the rail canvas at the compact default split instead of maxing its height", async () => {
    const { container } = render(
      <ReferenceGrid {...createProps({ railCanvasProps: {} as never })} />
    );

    const canvasSection = container.querySelector(".reference-rail-canvas-section");

    await waitFor(() => {
      expect(canvasSection).toHaveStyle({
        flexBasis: "30%",
      });
      expect(canvasSection).not.toHaveClass("is-inventory-expanded");
    });
  });

  it("suspends background visual work while the rail canvas is interacting", async () => {
    const onInteractionActiveChange = vi.fn();
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: { onInteractionActiveChange } as never,
        })}
      />
    );

    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "false");

    fireEvent.pointerDown(screen.getByTestId("canvas-properties-panel"));

    await waitFor(() => {
      expect(panel).toHaveAttribute("data-rail-canvas-interaction-active", "true");
      expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "true");
    });
    expect(onInteractionActiveChange).toHaveBeenLastCalledWith(true);

    fireEvent.pointerUp(screen.getByTestId("canvas-properties-panel"));

    await waitFor(() => {
      expect(panel).toHaveAttribute("data-rail-canvas-interaction-active", "false");
      expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "false");
    });
    expect(onInteractionActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("suspends background visual work while a reference card drag is active", async () => {
    const { container } = render(
      <ReferenceGrid {...createProps({ railCanvasProps: {} as never })} />
    );

    const panel = container.querySelector(".reference-canvas-panel");
    const card = container.querySelector(".reference-card");
    expect(card).toBeTruthy();
    expect(panel).toHaveAttribute("data-reference-card-drag-active", "false");
    expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "false");

    fireEvent.dragStart(card as HTMLElement, {
      dataTransfer: createDragTransfer(),
    });

    await waitFor(() => {
      expect(panel).toHaveAttribute("data-reference-card-drag-active", "true");
      expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "true");
    });

    fireEvent.dragEnd(card as HTMLElement, {
      dataTransfer: createDragTransfer(),
    });

    await waitFor(() => {
      expect(panel).toHaveAttribute("data-reference-card-drag-active", "false");
      expect(panel).toHaveAttribute("data-grid-background-visual-work-suspended", "false");
    });
  });
});
