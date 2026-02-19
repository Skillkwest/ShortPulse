/**
 * Curated split-grid interaction tests for ReferenceCanvas.
 * Validates add/dedupe/reorder/remove behavior and curated drop rejection rules.
 */
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceCanvas, type ReferenceCanvasProps } from "../ReferenceCanvas";
import type { StudioOutput } from "../../types";

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
  {
    id: "out-2",
    prompt: "Two",
    mode: "image",
    aspect: "1:1",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    previewUrl: "https://example.com/two.png",
  },
];

const makeTransfer = (data: Record<string, string>): DataTransfer =>
  ({
    files: { length: 0, item: () => null } as unknown as FileList,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const createProps = (overrides: Partial<ReferenceCanvasProps> = {}): ReferenceCanvasProps => ({
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

describe("ReferenceCanvas curated split", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: async () => undefined,
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
    vi.unstubAllGlobals();
  });

  it("keeps the primary pending output on spinner visuals after timeout fallback kicks in", () => {
    vi.useFakeTimers();
    const pendingOutput: StudioOutput = {
      id: "pending-1",
      prompt: "Pending image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      taskState: "running",
    };
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [pendingOutput],
          activeOutputId: pendingOutput.id,
        })}
      />
    );

    expect(container.querySelector(".reference-spinner")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(container.querySelector(".reference-spinner")).toBeTruthy();
    expect(container.querySelector(".reference-loading-placeholder")).toBeFalsy();
  });

  it("applies spinner slots in FIFO order and shows pending badges for queued generations", () => {
    const pendingOutputs: StudioOutput[] = Array.from({ length: 8 }, (_, index) => {
      const label = 8 - index;
      return {
        id: `pending-${label}`,
        prompt: `Pending ${label}`,
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        taskState: "running",
        mediaSource: "generated",
      };
    });

    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: pendingOutputs,
          activeOutputId: pendingOutputs[0]?.id ?? null,
        })}
      />
    );

    const cards = Array.from(container.querySelectorAll(".reference-card"));
    expect(cards).toHaveLength(8);
    expect(container.querySelectorAll(".reference-spinner")).toHaveLength(6);
    expect(container.querySelectorAll(".reference-loading-pending-label")).toHaveLength(2);
    expect(container.querySelectorAll(".reference-loading-pending-spinner")).toHaveLength(2);
    expect(cards[0]?.querySelector(".reference-loading-pending-label")).toBeTruthy();
    expect(cards[1]?.querySelector(".reference-loading-pending-label")).toBeTruthy();
    expect(cards[7]?.querySelector(".reference-spinner")).toBeTruthy();
  });

  it("promotes queued pending cards into spinner slots as older generations finish", () => {
    const pendingOutputs: StudioOutput[] = Array.from({ length: 8 }, (_, index) => {
      const label = 8 - index;
      return {
        id: `pending-${label}`,
        prompt: `Pending ${label}`,
        mode: "image",
        aspect: "1:1",
        model: "Model",
        status: "ready",
        timestamp: "Now",
        taskState: "running",
        mediaSource: "generated",
      };
    });
    const { container, rerender } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: pendingOutputs,
          activeOutputId: pendingOutputs[0]?.id ?? null,
        })}
      />
    );

    expect(container.querySelectorAll(".reference-loading-pending-label")).toHaveLength(2);

    const resolvedOldestOutputs = pendingOutputs.slice(0, pendingOutputs.length - 1);

    rerender(
      <ReferenceCanvas
        {...createProps({
          outputs: resolvedOldestOutputs,
          activeOutputId: resolvedOldestOutputs[0]?.id ?? null,
        })}
      />
    );

    expect(container.querySelectorAll(".reference-loading-pending-label")).toHaveLength(1);
    expect(container.querySelectorAll(".reference-loading-pending-spinner")).toHaveLength(1);
    expect(container.querySelectorAll(".reference-spinner")).toHaveLength(6);
  });

  it("renders fallback hydration source when optimized preview URL fails", async () => {
    vi.useFakeTimers();
    const requestedHydrationSources: string[] = [];
    class MockHydrationImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = "async";
      naturalWidth = 1024;
      naturalHeight = 1024;
      #src = "";

      set src(value: string) {
        this.#src = value;
        requestedHydrationSources.push(value);
        const callback = value.startsWith("/_next/image?") ? this.onerror : this.onload;
        if (!callback) return;
        setTimeout(() => callback(), 0);
      }

      get src() {
        return this.#src;
      }
    }

    vi.stubGlobal("Image", MockHydrationImage as unknown as typeof Image);

    const fallbackUrl = "https://cdn.example.com/generated-image.png?token=raw";
    const generatedOutput: StudioOutput = {
      id: "generated-1",
      prompt: "Generated image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      taskState: "success",
      previewStoragePath: fallbackUrl,
      fullStoragePath: fallbackUrl,
      previewUrl: fallbackUrl,
      resultUrls: [fallbackUrl],
    };

    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [generatedOutput],
          activeOutputId: generatedOutput.id,
        })}
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    const imageNode = container.querySelector(".reference-card-image") as HTMLImageElement | null;
    expect(imageNode).toBeTruthy();
    expect(imageNode?.getAttribute("data-src")?.startsWith("/_next/image?")).toBe(true);
    expect(imageNode?.getAttribute("src")).toBe(fallbackUrl);
    expect(
      requestedHydrationSources.filter((value) => value.startsWith("/_next/image?"))
    ).toHaveLength(1);
    expect(requestedHydrationSources.includes(fallbackUrl)).toBe(false);
  });

  it("adds curated refs from all-refs internal drags", () => {
    const onAddCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          onAddCuratedReference,
          onSelectOutput,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "all-refs",
      }),
    });

    expect(onAddCuratedReference).toHaveBeenCalledWith("out-2");
    expect(onSelectOutput).toHaveBeenCalledWith("out-2");
  });

  it("dedupes duplicate curated drops from all-refs and keeps focus", () => {
    const onAddCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-2"],
          onAddCuratedReference,
          onSelectOutput,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "all-refs",
      }),
    });

    expect(onAddCuratedReference).not.toHaveBeenCalled();
    expect(onSelectOutput).toHaveBeenCalledWith("out-2");
  });

  it("reorders curated refs on internal curated drops", () => {
    const onReorderCuratedReference = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-1", "out-2"],
          onReorderCuratedReference,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const targetCard = curatedSection.querySelector(".reference-card") as HTMLElement;
    expect(targetCard).toBeTruthy();
    Object.defineProperty(targetCard, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        toJSON: () => ({}),
      }),
    });

    fireEvent.drop(targetCard, {
      clientY: 10,
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "curated",
      }),
    });

    expect(onReorderCuratedReference).toHaveBeenCalledWith("out-2", "out-1", "after");
  });

  it("removes curated items with the explicit action button", () => {
    const onRemoveCuratedReference = vi.fn();
    const { getByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-1"],
          onRemoveCuratedReference,
        })}
      />
    );

    fireEvent.click(getByLabelText("Remove from curated"));

    expect(onRemoveCuratedReference).toHaveBeenCalledWith("out-1");
  });

  it("rejects non-internal drops in curated section", () => {
    const onAddCuratedReference = vi.fn();
    const onReorderCuratedReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          onAddCuratedReference,
          onReorderCuratedReference,
          onPasteTextReference,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/plain": "dropped text payload",
      }),
    });

    expect(onAddCuratedReference).not.toHaveBeenCalled();
    expect(onReorderCuratedReference).not.toHaveBeenCalled();
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("hides save action for generated image references", () => {
    const onSaveToLibrary = vi.fn();
    const generatedImage: StudioOutput = {
      id: "generated-image-1",
      prompt: "Generated image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/generated-image.png",
      mediaSource: "generated",
    };

    const { queryByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [generatedImage],
          activeOutputId: generatedImage.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(queryByLabelText("Save to media library")).toBeNull();
  });

  it("keeps save action for uploaded image references", () => {
    const onSaveToLibrary = vi.fn();
    const uploadedImage: StudioOutput = {
      id: "upload-image-1",
      prompt: "Uploaded image",
      mode: "image",
      aspect: "1:1",
      model: "Upload",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/uploaded-image.png",
      mediaSource: "upload",
    };

    const { getByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [uploadedImage],
          activeOutputId: uploadedImage.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("hides save action for generated video references", () => {
    const onSaveToLibrary = vi.fn();
    const generatedVideo: StudioOutput = {
      id: "generated-video-1",
      prompt: "Generated video",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/generated-video.mp4",
      mediaSource: "generated",
    };

    const { queryByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [generatedVideo],
          activeOutputId: generatedVideo.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(queryByLabelText("Save to media library")).toBeNull();
  });

  it("keeps save action for uploaded video references", () => {
    const onSaveToLibrary = vi.fn();
    const uploadedVideo: StudioOutput = {
      id: "upload-video-1",
      prompt: "Uploaded video",
      mode: "video",
      aspect: "16:9",
      model: "Upload",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/uploaded-video.mp4",
      mediaSource: "upload",
    };

    const { getByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          outputs: [uploadedVideo],
          activeOutputId: uploadedVideo.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("snaps split toward inventory when clicking the divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(allRefsSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });
    expect(divider).toHaveAttribute("aria-valuenow", "1");

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    expect(divider).toHaveAttribute("aria-valuenow", "88");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(false);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(true);
  });

  it("snaps split toward all refs when clicking the all-refs divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(allRefsSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });
    const curatedHeader = container.querySelector(".reference-curated-header") as HTMLElement;
    expect(curatedHeader).toBeTruthy();
    Object.defineProperty(curatedHeader, "offsetHeight", {
      configurable: true,
      value: 44,
    });
    expect(divider).toHaveAttribute("aria-valuenow", "1");

    fireEvent.pointerDown(getByText("All Refs ↑"));
    fireEvent.click(getByText("All Refs ↑"));

    expect(divider).toHaveAttribute("aria-valuenow", "7");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(true);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(false);
  });

  it("collapses quick slots when resizing to the top bound", () => {
    const { container, getByRole } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });

    fireEvent.keyDown(divider, { key: "Home" });

    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(true);
  });
});
