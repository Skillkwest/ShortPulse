import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  resetAiStudioOutputStore,
  setAiStudioOutputStoreSnapshot,
} from "../../hooks/aiStudioOutputStore";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
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
    vi.useFakeTimers();
    vi.mocked(getSignedMediaUrlsBatch).mockResolvedValue(new Map());
    resetAiStudioOutputStore();
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      window.clearTimeout(frameId);
    });
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
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it("clears loading visual when a selector snapshot entry settles with media", async () => {
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

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["pending-1"],
        outputById: {
          "pending-1": makeOutput("pending-1", {
            mode: "image",
            previewText: undefined,
            previewUrl: "https://cdn.example.com/settled.png",
            resultUrls: ["https://cdn.example.com/settled.png"],
            taskState: "success",
            mediaSource: "generated",
          }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(container.querySelector(".reference-loading")).toBeNull();
  });

  it("keeps explicitly suppressed curated references in quick slots while excluding them from all refs", () => {
    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        curatedReferenceIds={["prompt-1"]}
        removedFromAllRefsIds={["prompt-1"]}
        onAddCuratedReference={() => undefined}
        onRemoveCuratedReference={() => undefined}
        onReorderCuratedReference={() => undefined}
      />
    );

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["prompt-1", "prompt-2"],
        outputById: {
          "prompt-1": makeOutput("prompt-1", { previewText: "Suppressed quick-slot ref" }),
          "prompt-2": makeOutput("prompt-2", { previewText: "Visible all-refs ref" }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    expect(allRefsSection).toBeTruthy();

    const curatedQueries = within(curatedSection);
    const allRefsQueries = within(allRefsSection);
    expect(curatedQueries.getByText("Suppressed quick-slot ref")).toBeInTheDocument();
    expect(allRefsQueries.queryByText("Suppressed quick-slot ref")).toBeNull();
    expect(allRefsQueries.getByText("Visible all-refs ref")).toBeInTheDocument();
  });

  it("renders restored quick-slot media from selector snapshot storage paths", async () => {
    vi.useRealTimers();
    vi.mocked(getSignedMediaUrlsBatch).mockResolvedValue(
      new Map([
        ["user-1/restored-preview.webp", "https://signed.example.com/restored-preview.webp"],
      ])
    );
    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        curatedReferenceIds={["restored-media-1"]}
        onAddCuratedReference={() => undefined}
        onRemoveCuratedReference={() => undefined}
        onReorderCuratedReference={() => undefined}
      />
    );

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["restored-media-1"],
        outputById: {
          "restored-media-1": makeOutput("restored-media-1", {
            mode: "image",
            previewText: undefined,
            previewUrl: undefined,
            resultUrls: [],
            mediaSource: "generated",
            savedMediaIds: ["media-restored-1"],
            previewStoragePath: "user-1/restored-preview.webp",
            fullStoragePath: "user-1/restored-full.png",
          }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: "media_library",
          storagePaths: ["user-1/restored-preview.webp"],
        })
      );
      const image = curatedSection.querySelector(
        ".reference-card-image"
      ) as HTMLImageElement | null;
      expect(image?.getAttribute("data-src")).toBe(
        "https://signed.example.com/restored-preview.webp"
      );
    });
    expect(within(curatedSection).queryByText(/Drag & drop references here/i)).toBeNull();
  });

  it("keeps hidden outputs out of all refs even when explicit suppression is active elsewhere", () => {
    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        curatedReferenceIds={["prompt-1"]}
        removedFromAllRefsIds={["prompt-1"]}
        onAddCuratedReference={() => undefined}
        onRemoveCuratedReference={() => undefined}
        onReorderCuratedReference={() => undefined}
      />
    );

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["prompt-1", "prompt-2", "prompt-3"],
        outputById: {
          "prompt-1": makeOutput("prompt-1", { previewText: "Suppressed quick-slot ref" }),
          "prompt-2": makeOutput("prompt-2", {
            previewText: "Still hidden from all refs",
            hiddenInReferenceGrid: true,
          }),
          "prompt-3": makeOutput("prompt-3", { previewText: "Visible all-refs ref" }),
        },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    expect(allRefsSection).toBeTruthy();

    const curatedQueries = within(curatedSection);
    const allRefsQueries = within(allRefsSection);
    expect(curatedQueries.getByText("Suppressed quick-slot ref")).toBeInTheDocument();
    expect(allRefsQueries.queryByText("Suppressed quick-slot ref")).toBeNull();
    expect(allRefsQueries.queryByText("Still hidden from all refs")).toBeNull();
    expect(allRefsQueries.getByText("Visible all-refs ref")).toBeInTheDocument();
  });
});
