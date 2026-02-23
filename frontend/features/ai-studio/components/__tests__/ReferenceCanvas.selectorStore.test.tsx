import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  resetAiStudioOutputStore,
  setAiStudioOutputStoreSnapshot,
} from "../../hooks/aiStudioOutputStore";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";

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

const baseProps: ReferenceGridProps = {
  activeOutputId: null,
  onSelectOutput: () => undefined,
  onOpenDetails: () => undefined,
  selectedTool: "create",
};

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "text",
  aspect: "9:16",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  previewText: `Prompt card ${id}`,
  mediaSource: "prompt",
  ...overrides,
});

describe("ReferenceGrid selector-store bridge", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
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

  it("renders prompt reference cards from selector snapshot when outputs prop is omitted", () => {
    render(<ReferenceGrid {...baseProps} />);

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["prompt-1"],
        outputById: {
          "prompt-1": makeOutput("prompt-1", { previewText: "Decoupled prompt reference" }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(screen.getByText("Decoupled prompt reference")).toBeInTheDocument();
  });

  it("shows loading visual for pending selector snapshot entries", () => {
    const { container } = render(<ReferenceGrid {...baseProps} />);

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["pending-1"],
        outputById: {
          "pending-1": makeOutput("pending-1", {
            mode: "image",
            previewText: undefined,
            previewUrl: undefined,
            taskState: "pending",
            mediaSource: "generated",
          }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(container.querySelector(".reference-loading")).toBeTruthy();
  });
});
