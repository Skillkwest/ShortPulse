import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";
import type { StudioOutput } from "../../types";

vi.mock("../canvas/CanvasPropertiesPanel", () => ({
  CanvasPropertiesPanel: () => <div data-testid="canvas-properties-panel" />,
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
});
