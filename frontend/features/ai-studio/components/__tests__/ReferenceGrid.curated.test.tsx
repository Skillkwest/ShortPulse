/**
 * Curated split-grid interaction tests for ReferenceGrid.
 * Validates add/dedupe/reorder/remove behavior and curated drop rejection rules.
 */
import { act, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";
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

const installRafQueue = () => {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
    callbacks.delete(frameId);
  });

  const flushNextFrame = () => {
    const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!next) return false;
    const [frameId, callback] = next;
    callbacks.delete(frameId);
    callback(0);
    return true;
  };

  const flushAllFrames = (limit = 80) => {
    let remaining = limit;
    while (remaining > 0 && flushNextFrame()) {
      remaining -= 1;
    }
  };

  return { flushNextFrame, flushAllFrames };
};

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

const createRailCanvasProps = (): ReferenceGridProps["railCanvasProps"] => ({
  instanceId: "rail",
  camera: { x: 0, y: 0, zoom: 1 },
  items: [],
  pendingItems: [],
  viewportRef: { current: null },
  isDropActive: false,
  draftTextEntry: null,
  editingTextItemId: null,
  editingTextValue: "",
  onViewportKeyDown: vi.fn(),
  onViewportDoubleClick: vi.fn(),
  onViewportPointerDown: vi.fn(),
  onViewportPointerMove: vi.fn(),
  onViewportPointerUp: vi.fn(),
  onViewportPointerCancel: vi.fn(),
  onViewportDragEnter: vi.fn(),
  onViewportDragOver: vi.fn(),
  onViewportDragLeave: vi.fn(),
  onViewportDrop: vi.fn(),
  onViewportWheel: vi.fn(),
  onItemPointerDown: vi.fn(),
  onItemPointerMove: vi.fn(),
  onItemPointerUp: vi.fn(),
  onItemPointerCancel: vi.fn(),
  onItemContextMenu: vi.fn(),
  onItemDoubleClick: vi.fn(),
  onPinTextItem: vi.fn(),
  onDraftTextChange: vi.fn(),
  onDraftTextKeyDown: vi.fn(),
  onDraftTextBlur: vi.fn(),
  onTextItemEditChange: vi.fn(),
  onTextItemEditKeyDown: vi.fn(),
  onTextItemEditBlur: vi.fn(),
});

describe("ReferenceGrid curated split", () => {
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reflects effective adaptive preview routing state on telemetry attribute", async () => {
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW", "false");
    vi.stubEnv("NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY", "true");
    vi.resetModules();
    const { ReferenceGrid: ReloadedReferenceGrid } = await import("../ReferenceGrid");

    const { container } = render(<ReloadedReferenceGrid {...createProps()} />);
    const telemetryRoot = container.querySelector(
      "[data-grid-surface='reference-grid']"
    ) as HTMLElement | null;
    expect(telemetryRoot).toBeTruthy();
    expect(telemetryRoot?.getAttribute("data-grid-adaptive-preview-enabled")).toBe("false");
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
      <ReferenceGrid
        {...createProps({
          outputs: [pendingOutput],
          activeOutputId: pendingOutput.id,
        })}
      />
    );

    const pendingCard = container.querySelector(".reference-card");
    expect(pendingCard?.classList.contains("is-loading")).toBe(true);
    expect(pendingCard?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".reference-spinner")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(container.querySelector(".reference-spinner")).toBeTruthy();
    expect(container.querySelector(".reference-loading-placeholder")).toBeNull();
  });

  it("uses hydration loading visuals for non-generated media placeholders", () => {
    const importedOutput: StudioOutput = {
      id: "imported-1",
      prompt: "Imported image",
      mode: "image",
      aspect: "1:1",
      model: "Upload",
      status: "ready",
      timestamp: "Library",
      mediaSource: "library",
      previewUrl: "https://example.com/imported.png",
    };
    const { container, queryByRole } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [importedOutput],
          activeOutputId: importedOutput.id,
        })}
      />
    );

    const importedCard = container.querySelector(".reference-card");
    expect(importedCard?.classList.contains("is-loading")).toBe(true);
    expect(importedCard?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".reference-spinner")).toBeTruthy();
    expect(container.querySelector(".reference-hydration-indicator")).toBeNull();
    expect(queryByRole("button", { name: "Describe" })).toBeNull();
    expect(container.querySelector(".reference-loading-placeholder")).toBeNull();
  });

  it("keeps spinner visible through deferred video load commit and then clears after RAF flush", () => {
    const { flushNextFrame, flushAllFrames } = installRafQueue();
    const importedOutput: StudioOutput = {
      id: "imported-raf-video-1",
      prompt: "Imported video",
      mode: "video",
      aspect: "16:9",
      model: "Upload",
      status: "ready",
      timestamp: "Library",
      mediaSource: "library",
      previewUrl: "https://example.com/imported-raf.mp4",
    };
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [importedOutput],
          activeOutputId: importedOutput.id,
        })}
      />
    );

    const videoNode = container.querySelector(".reference-card-video") as HTMLVideoElement | null;
    expect(videoNode).toBeTruthy();
    expect(container.querySelector(".reference-spinner")).toBeTruthy();
    expect(container.querySelector(".reference-hydration-indicator")).toBeNull();

    act(() => {
      fireEvent.loadedData(videoNode as HTMLVideoElement);
    });

    expect(container.querySelector(".reference-spinner")).toBeTruthy();

    act(() => {
      flushNextFrame();
    });

    expect(container.querySelector(".reference-spinner")).toBeTruthy();

    act(() => {
      flushAllFrames();
    });

    expect(container.querySelector(".reference-spinner")).toBeNull();
  });

  it("keeps overflow loading spinners animated", () => {
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
      <ReferenceGrid
        {...createProps({
          outputs: pendingOutputs,
          activeOutputId: pendingOutputs[0]?.id ?? null,
        })}
      />
    );

    const cards = Array.from(container.querySelectorAll(".reference-card"));
    expect(cards).toHaveLength(8);
    expect(container.querySelectorAll(".reference-spinner")).toHaveLength(8);
    expect(container.querySelectorAll(".reference-spinner.is-static")).toHaveLength(0);
    expect(cards[7]?.querySelector(".reference-spinner")).toBeTruthy();
  });

  it("keeps spinners animated as older generations finish", () => {
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
      <ReferenceGrid
        {...createProps({
          outputs: pendingOutputs,
          activeOutputId: pendingOutputs[0]?.id ?? null,
        })}
      />
    );

    expect(container.querySelectorAll(".reference-spinner.is-static")).toHaveLength(0);

    const resolvedOldestOutputs = pendingOutputs.slice(0, pendingOutputs.length - 1);

    rerender(
      <ReferenceGrid
        {...createProps({
          outputs: resolvedOldestOutputs,
          activeOutputId: resolvedOldestOutputs[0]?.id ?? null,
        })}
      />
    );

    expect(container.querySelectorAll(".reference-spinner.is-static")).toHaveLength(0);
    expect(container.querySelectorAll(".reference-spinner")).toHaveLength(7);
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

    const fallbackUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/images/generated-image.png?token=raw";
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
      <ReferenceGrid
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

  it("bypasses optimizer on same-source cross-card hydration after first optimizer failure", async () => {
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

    const fallbackUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/images/shared-source.png?token=raw";
    const generatedOutputOne: StudioOutput = {
      id: "generated-same-source-1",
      prompt: "Generated image 1",
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
    const generatedOutputTwo: StudioOutput = {
      ...generatedOutputOne,
      id: "generated-same-source-2",
      prompt: "Generated image 2",
    };

    const { container, rerender } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedOutputOne],
          activeOutputId: generatedOutputOne.id,
        })}
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    rerender(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedOutputTwo],
          activeOutputId: generatedOutputTwo.id,
        })}
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    const optimizerAttempts = requestedHydrationSources.filter((value) =>
      value.startsWith("/_next/image?")
    );
    expect(optimizerAttempts).toHaveLength(1);
    expect(
      requestedHydrationSources.filter((value) => value === fallbackUrl).length
    ).toBeGreaterThan(0);
    const telemetryRoot = container.querySelector(
      "[data-grid-optimizer-failover-bypass-count]"
    ) as HTMLElement | null;
    expect(telemetryRoot).toBeTruthy();
    expect(telemetryRoot?.getAttribute("data-grid-optimizer-failover-error-count")).toBe("1");
    const bypassCount = Number(
      telemetryRoot?.getAttribute("data-grid-optimizer-failover-bypass-count") ?? "0"
    );
    expect(bypassCount).toBeGreaterThanOrEqual(1);
  });

  it("applies adaptive local compression to uploaded blob image previews", async () => {
    vi.useFakeTimers();
    const requestedHydrationSources: string[] = [];
    const originalCreateObjectURL = (
      URL as typeof URL & { createObjectURL?: typeof URL.createObjectURL }
    ).createObjectURL;
    const originalRevokeObjectURL = (
      URL as typeof URL & { revokeObjectURL?: typeof URL.revokeObjectURL }
    ).revokeObjectURL;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToBlob = HTMLCanvasElement.prototype.toBlob;

    class MockHydrationImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = "async";
      naturalWidth = 2048;
      naturalHeight = 2048;
      #src = "";

      set src(value: string) {
        this.#src = value;
        requestedHydrationSources.push(value);
        if (!this.onload) return;
        setTimeout(() => this.onload?.(), 0);
      }

      get src() {
        return this.#src;
      }
    }

    let unmount: (() => void) | null = null;
    try {
      vi.stubGlobal("Image", MockHydrationImage as unknown as typeof Image);
      const createObjectUrlMock = vi.fn(() => "blob:compressed-preview");
      const revokeObjectUrlMock = vi.fn();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: createObjectUrlMock,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: revokeObjectUrlMock,
      });

      const mockCanvasContext = {
        drawImage: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      };
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: vi.fn(() => mockCanvasContext as unknown as CanvasRenderingContext2D),
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        configurable: true,
        value: vi.fn((callback: BlobCallback) => {
          callback(new Blob(["compressed"], { type: "image/webp" }));
        }),
      });

      const uploadedOutput: StudioOutput = {
        id: "upload-blob-1",
        prompt: "Uploaded image",
        mode: "image",
        aspect: "1:1",
        model: "Upload",
        status: "ready",
        timestamp: "Dropped",
        mediaSource: "upload",
        previewUrl: "blob:http://localhost:3000/upload-original",
        previewStoragePath: "blob:http://localhost:3000/upload-original",
        fullStoragePath: "blob:http://localhost:3000/upload-original",
      };

      const rendered = render(
        <ReferenceGrid
          {...createProps({
            outputs: [uploadedOutput],
            activeOutputId: uploadedOutput.id,
          })}
        />
      );
      const { container } = rendered;
      unmount = rendered.unmount;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120);
      });

      const imageNode = container.querySelector(".reference-card-image") as HTMLImageElement | null;
      expect(imageNode).toBeTruthy();
      expect(imageNode?.getAttribute("data-src")).toBe(
        "blob:http://localhost:3000/upload-original"
      );
      expect(imageNode?.getAttribute("src")).toBe("blob:compressed-preview");
      expect(requestedHydrationSources).toContain("blob:http://localhost:3000/upload-original");
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      unmount();
      unmount = null;
    } finally {
      if (unmount) {
        unmount();
      }
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        configurable: true,
        value: originalCanvasToBlob,
      });
    }
  });

  it("adds curated refs from all-refs internal drags", () => {
    const onAddCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceGrid
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
      <ReferenceGrid
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
      <ReferenceGrid
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

  it("reorders curated refs with keyboard arrows on focused cards", () => {
    const onReorderCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          curatedReferenceIds: ["out-1", "out-2"],
          onReorderCuratedReference,
          onSelectOutput,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const cards = curatedSection.querySelectorAll(".reference-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    const firstCard = cards[0] as HTMLElement;
    const secondCard = cards[1] as HTMLElement;

    firstCard.focus();
    fireEvent.keyDown(firstCard, { key: "ArrowDown" });
    expect(onReorderCuratedReference).toHaveBeenCalledWith("out-1", "out-2", "after");
    expect(onSelectOutput).toHaveBeenCalledWith("out-1");

    secondCard.focus();
    fireEvent.keyDown(secondCard, { key: "ArrowUp" });
    expect(onReorderCuratedReference).toHaveBeenCalledWith("out-2", "out-1", "before");
    expect(onSelectOutput).toHaveBeenCalledWith("out-2");
  });

  it("removes curated items with the explicit action button", () => {
    const onRemoveCuratedReference = vi.fn();
    const { getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          curatedReferenceIds: ["out-1"],
          onRemoveCuratedReference,
        })}
      />
    );

    fireEvent.click(getByLabelText("Remove from curated"));

    expect(onRemoveCuratedReference).toHaveBeenCalledWith("out-1");
  });

  it("fires the all refs download action for selected media cards", () => {
    const onDownload = vi.fn();
    const { getAllByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          onDownload,
        })}
      />
    );

    fireEvent.click(getAllByLabelText("Download reference")[0] as HTMLElement);
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "out-1" }));
  });

  it("shows curated remove and download actions in quick slot card actions for image media", () => {
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          curatedReferenceIds: ["out-1"],
          onSaveToLibrary: vi.fn(),
          onDownload: vi.fn(),
          onDeleteOutput: vi.fn(),
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const curatedQueries = within(curatedSection);

    expect(curatedQueries.getByLabelText("Remove from curated")).toBeInTheDocument();
    expect(curatedQueries.getByLabelText("Download reference")).toBeInTheDocument();
    expect(curatedQueries.queryByLabelText("Save to media library")).toBeNull();
    expect(curatedQueries.queryByLabelText("Remove reference from grid")).toBeNull();
  });

  it("shows curated download action for quick slot video media", () => {
    const videoOutput: StudioOutput = {
      id: "out-video",
      prompt: "Video",
      mode: "video",
      aspect: "16:9",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/video.mp4",
    };
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [videoOutput],
          activeOutputId: videoOutput.id,
          curatedReferenceIds: [videoOutput.id],
          onDownload: vi.fn(),
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const curatedQueries = within(curatedSection);

    expect(curatedQueries.getByLabelText("Download reference")).toBeInTheDocument();
    expect(curatedQueries.getByLabelText("Remove from curated")).toBeInTheDocument();
  });

  it("does not show curated download action for quick slot prompt-only cards", () => {
    const promptOutput: StudioOutput = {
      id: "out-prompt-only",
      prompt: "Prompt only",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewText: "Prompt reference",
    };
    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [promptOutput],
          activeOutputId: promptOutput.id,
          curatedReferenceIds: [promptOutput.id],
          onDownload: vi.fn(),
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const curatedQueries = within(curatedSection);

    expect(curatedQueries.queryByLabelText("Download reference")).toBeNull();
    expect(curatedQueries.getByLabelText("Remove from curated")).toBeInTheDocument();
  });

  it("rejects non-internal drops in curated section", () => {
    const onAddCuratedReference = vi.fn();
    const onReorderCuratedReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const { container } = render(
      <ReferenceGrid
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

  it("keeps hidden curated references in quick slots while excluding them from all refs", () => {
    const hiddenCurated: StudioOutput = {
      id: "out-hidden",
      prompt: "Hidden",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewText: "Hidden in quick slot only",
      hiddenInReferenceGrid: true,
    };
    const visibleAllRefs: StudioOutput = {
      id: "out-visible",
      prompt: "Visible",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewText: "Visible in all refs",
    };

    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [hiddenCurated, visibleAllRefs],
          curatedReferenceIds: [hiddenCurated.id],
          activeOutputId: hiddenCurated.id,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    expect(allRefsSection).toBeTruthy();
    const curatedQueries = within(curatedSection);
    const allRefsQueries = within(allRefsSection);

    expect(curatedQueries.getByText("Hidden in quick slot only")).toBeInTheDocument();
    expect(allRefsQueries.queryByText("Hidden in quick slot only")).toBeNull();
    expect(allRefsQueries.getByText("Visible in all refs")).toBeInTheDocument();
  });

  it("keeps explicitly suppressed curated references in quick slots while excluding them from all refs", () => {
    const suppressedCurated: StudioOutput = {
      id: "out-suppressed",
      prompt: "Suppressed",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewText: "Suppressed in quick slot only",
    };
    const visibleAllRefs: StudioOutput = {
      id: "out-visible-explicit",
      prompt: "Visible explicit",
      mode: "text",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewText: "Visible explicit all refs",
    };

    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [suppressedCurated, visibleAllRefs],
          curatedReferenceIds: [suppressedCurated.id],
          removedFromAllRefsIds: [suppressedCurated.id],
          activeOutputId: suppressedCurated.id,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    expect(allRefsSection).toBeTruthy();
    const curatedQueries = within(curatedSection);
    const allRefsQueries = within(allRefsSection);

    expect(curatedQueries.getByText("Suppressed in quick slot only")).toBeInTheDocument();
    expect(allRefsQueries.queryByText("Suppressed in quick slot only")).toBeNull();
    expect(allRefsQueries.getByText("Visible explicit all refs")).toBeInTheDocument();
  });

  it("shows save action for generated image references", () => {
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

    const { getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedImage],
          activeOutputId: generatedImage.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("shows reroll action for generated image references with replay snapshots", () => {
    const onRerollOutput = vi.fn();
    const generatedImage: StudioOutput = {
      id: "generated-image-reroll-1",
      prompt: "Generated image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/generated-image-reroll.png",
      mediaSource: "generated",
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        displayPrompt: "Generated image",
        submissionPrompt: "Generated image",
        aspect: "1:1",
        imageResolution: null,
        referenceInputs: [],
        capturedAt: "2026-02-25T00:00:00.000Z",
      },
    };

    const { getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedImage],
          activeOutputId: generatedImage.id,
          onRerollOutput,
        })}
      />
    );

    fireEvent.click(getByLabelText("Re-roll image"));
    expect(onRerollOutput).toHaveBeenCalledWith(expect.objectContaining({ id: generatedImage.id }));
  });

  it("hides reroll action when generated image references do not have replay snapshots", () => {
    const generatedImage: StudioOutput = {
      id: "generated-image-no-replay-1",
      prompt: "Generated image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/generated-image-no-replay.png",
      mediaSource: "generated",
    };

    const { queryByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedImage],
          activeOutputId: generatedImage.id,
          onRerollOutput: vi.fn(),
        })}
      />
    );

    expect(queryByLabelText("Re-roll image")).toBeNull();
  });

  it("hides reroll action for curated-only references", () => {
    const generatedImage: StudioOutput = {
      id: "generated-image-curated-only-1",
      prompt: "Generated image",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/generated-image-curated-only.png",
      mediaSource: "generated",
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        displayPrompt: "Generated image",
        submissionPrompt: "Generated image",
        aspect: "1:1",
        imageResolution: null,
        referenceInputs: [],
        capturedAt: "2026-02-25T00:00:00.000Z",
      },
    };

    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedImage],
          curatedReferenceIds: [generatedImage.id],
          removedFromAllRefsIds: [generatedImage.id],
          activeOutputId: generatedImage.id,
          onRerollOutput: vi.fn(),
        })}
      />
    );

    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const curatedQueries = within(curatedSection);
    expect(curatedQueries.queryByLabelText("Re-roll image")).toBeNull();
  });

  it("keeps save action for unsaved prompt references", () => {
    const onSaveToLibrary = vi.fn();
    const promptReference: StudioOutput = {
      id: "prompt-ref-1",
      prompt: "Prompt reference",
      mode: "text",
      aspect: "1:1",
      model: "Prompt",
      status: "ready",
      timestamp: "Now",
      previewText: "Unsaved prompt reference",
      mediaSource: "prompt",
    };

    const { getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [promptReference],
          activeOutputId: promptReference.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("hides save action when prompt references are already saved", () => {
    const onSaveToLibrary = vi.fn();
    const savedPromptReference: StudioOutput = {
      id: "prompt-ref-saved-1",
      prompt: "Saved prompt reference",
      mode: "text",
      aspect: "1:1",
      model: "Prompt",
      status: "ready",
      timestamp: "Now",
      previewText: "Saved prompt reference",
      mediaSource: "prompt",
      saveState: "saved",
    };

    const { getByLabelText, queryByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [savedPromptReference],
          activeOutputId: savedPromptReference.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Saved")).toBeInTheDocument();
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
      <ReferenceGrid
        {...createProps({
          outputs: [uploadedImage],
          activeOutputId: uploadedImage.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("hides save action when uploaded media is already saved", () => {
    const onSaveToLibrary = vi.fn();
    const savedUploadedImage: StudioOutput = {
      id: "upload-image-saved-1",
      prompt: "Uploaded image saved",
      mode: "image",
      aspect: "1:1",
      model: "Upload",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/uploaded-image-saved.png",
      mediaSource: "upload",
      saveState: "saved",
    };

    const { queryByLabelText, getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [savedUploadedImage],
          activeOutputId: savedUploadedImage.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Saved")).toBeInTheDocument();
    expect(queryByLabelText("Save to media library")).toBeNull();
  });

  it("shows save action for generated video references", () => {
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

    const { getByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [generatedVideo],
          activeOutputId: generatedVideo.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
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
      <ReferenceGrid
        {...createProps({
          outputs: [uploadedVideo],
          activeOutputId: uploadedVideo.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Save to media library")).toBeInTheDocument();
  });

  it("renders image cards for image mode outputs even when preview URL contains /videos/", () => {
    const uploadedImageWithVideoLikePath: StudioOutput = {
      id: "upload-image-video-like-path-1",
      prompt: "Uploaded image with video-like URL",
      mode: "image",
      aspect: "4:5",
      model: "Upload",
      status: "ready",
      timestamp: "Now",
      previewUrl:
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/videos/reference_asset_12345?token=abc123",
      mediaSource: "upload",
    };

    const { container } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [uploadedImageWithVideoLikePath],
          activeOutputId: uploadedImageWithVideoLikePath.id,
        })}
      />
    );

    expect(container.querySelector(".reference-card-video")).toBeNull();
    expect(container.querySelector(".reference-card-image")).not.toBeNull();
  });

  it("hides save action when uploaded video is already saved", () => {
    const onSaveToLibrary = vi.fn();
    const savedUploadedVideo: StudioOutput = {
      id: "upload-video-saved-1",
      prompt: "Uploaded video saved",
      mode: "video",
      aspect: "16:9",
      model: "Upload",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://example.com/uploaded-video-saved.mp4",
      mediaSource: "upload",
      saveState: "saved",
    };

    const { getByLabelText, queryByLabelText } = render(
      <ReferenceGrid
        {...createProps({
          outputs: [savedUploadedVideo],
          activeOutputId: savedUploadedVideo.id,
          onSaveToLibrary,
        })}
      />
    );

    expect(getByLabelText("Saved")).toBeInTheDocument();
    expect(queryByLabelText("Save to media library")).toBeNull();
  });

  it("snaps split toward inventory when clicking the divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceGrid {...createProps()} />);
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
    expect(divider).toHaveAttribute("aria-valuenow", "28");

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    expect(divider).toHaveAttribute("aria-valuenow", "88");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(false);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(true);
  });

  it("hides add-files and media-library actions when lower divider is at inventory-expanded bottom", () => {
    const { container, getByText } = render(<ReferenceGrid {...createProps()} />);
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

    expect(container.querySelector(".reference-grid-add-files-btn")).toBeTruthy();
    expect(container.querySelector(".reference-grid-media-library-btn")).toBeTruthy();

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    expect(container.querySelector(".reference-grid-add-files-btn")).toBeNull();
    expect(container.querySelector(".reference-grid-media-library-btn")).toBeNull();
  });

  it("snaps split toward all refs when clicking the all-refs divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceGrid {...createProps()} />);
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
    expect(divider).toHaveAttribute("aria-valuenow", "28");

    fireEvent.pointerDown(getByText("All Refs ↑"));
    fireEvent.click(getByText("All Refs ↑"));

    expect(divider).toHaveAttribute("aria-valuenow", "7");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(true);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(false);
  });

  it("collapses quick slots when resizing to the top bound", () => {
    const { container, getByRole } = render(<ReferenceGrid {...createProps()} />);
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

  it("renders a rail canvas section with a dedicated top divider", () => {
    const { container, getByRole, getByText } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );

    expect(getByText("Canvas")).toBeInTheDocument();
    expect(
      getByRole("separator", { name: "Resize Canvas and Quick Slot Inventory sections" })
    ).toBeInTheDocument();
    expect(container.querySelector(".reference-rail-canvas-section")).toBeTruthy();
    expect(container.querySelector(".reference-grid-inventory-stack")).toBeTruthy();
  });

  it("snaps the top canvas split toward canvas and inventory via top divider pills", () => {
    const { container, getByRole, getByText } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const divider = getByRole("separator", {
      name: "Resize Canvas and Quick Slot Inventory sections",
    });
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    const railSection = container.querySelector(".reference-rail-canvas-section") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(railSection).toBeTruthy();

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

    fireEvent.pointerDown(getByText("Canvas ↓"));
    fireEvent.click(getByText("Canvas ↓"));
    expect(divider).toHaveAttribute("aria-valuenow", "80");

    const railHeader = container.querySelector(".reference-rail-canvas-header") as HTMLElement;
    expect(railHeader).toBeTruthy();
    Object.defineProperty(railHeader, "offsetHeight", {
      configurable: true,
      value: 44,
    });

    fireEvent.pointerDown(getByText("Inventory ↑"));
    fireEvent.click(getByText("Inventory ↑"));
    expect(divider).toHaveAttribute("aria-valuenow", "7");
    expect(railSection.classList.contains("is-inventory-expanded")).toBe(true);
  });

  it("keeps lower divider clamped to its bounds while dragging top divider downward", () => {
    const { container, getByRole, getByText } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const topDivider = getByRole("separator", {
      name: "Resize Canvas and Quick Slot Inventory sections",
    });
    const lowerDivider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
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

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    fireEvent.pointerDown(topDivider, {
      button: 0,
      pointerId: 31,
      clientY: 120,
    });
    fireEvent.pointerMove(window, {
      pointerId: 31,
      clientY: 320,
    });

    const lowerNow = Number(lowerDivider.getAttribute("aria-valuenow"));
    const lowerMax = Number(lowerDivider.getAttribute("aria-valuemax"));
    expect(lowerNow).toBeLessThanOrEqual(lowerMax);

    fireEvent.pointerUp(window, {
      pointerId: 31,
      clientY: 320,
    });
  });

  it("does not inflate lower divider max ratio when inventory stack is undersized", () => {
    const { container, getByRole, getByText } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    const inventoryStack = container.querySelector(
      ".reference-grid-inventory-stack"
    ) as HTMLElement;
    const lowerDivider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    expect(panel).toBeTruthy();
    expect(inventoryStack).toBeTruthy();

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
    Object.defineProperty(inventoryStack, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 80,
        right: 600,
        bottom: 80,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    expect(lowerDivider).toHaveAttribute("aria-valuemax", "10");
    expect(lowerDivider).toHaveAttribute("aria-valuenow", "10");
  });

  it("pushes the top divider upward when lower divider is dragged past its top bound", () => {
    const { container, getByRole } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const topDivider = getByRole("separator", {
      name: "Resize Canvas and Quick Slot Inventory sections",
    });
    const lowerDivider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
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

    const topBefore = Number(topDivider.getAttribute("aria-valuenow"));
    expect(topBefore).toBeGreaterThan(0);

    fireEvent.pointerDown(lowerDivider, {
      button: 0,
      pointerId: 11,
      clientY: 220,
    });
    fireEvent.pointerMove(window, {
      pointerId: 11,
      clientY: -120,
    });
    fireEvent.pointerUp(window, {
      pointerId: 11,
      clientY: -120,
    });

    const topAfter = Number(topDivider.getAttribute("aria-valuenow"));
    expect(topAfter).toBeLessThan(topBefore);
  });

  it("keeps the top divider fixed while lower divider drag updates lower split", () => {
    const { container, getByRole } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const topDivider = getByRole("separator", {
      name: "Resize Canvas and Quick Slot Inventory sections",
    });
    const lowerDivider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
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

    const topBefore = Number(topDivider.getAttribute("aria-valuenow"));
    const lowerBefore = Number(lowerDivider.getAttribute("aria-valuenow"));

    fireEvent.pointerDown(lowerDivider, {
      button: 0,
      pointerId: 12,
      clientY: 220,
    });
    fireEvent.pointerMove(window, {
      pointerId: 12,
      clientY: 120,
    });
    fireEvent.pointerUp(window, {
      pointerId: 12,
      clientY: 120,
    });

    const topAfter = Number(topDivider.getAttribute("aria-valuenow"));
    const lowerAfter = Number(lowerDivider.getAttribute("aria-valuenow"));

    expect(topAfter).toBe(topBefore);
    expect(lowerAfter).not.toBe(lowerBefore);
  });

  it("does not move the top divider when lower divider is dragged downward", () => {
    const { container, getByRole } = render(
      <ReferenceGrid
        {...createProps({
          railCanvasProps: createRailCanvasProps(),
        })}
      />
    );
    const topDivider = getByRole("separator", {
      name: "Resize Canvas and Quick Slot Inventory sections",
    });
    const lowerDivider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
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

    const topBefore = Number(topDivider.getAttribute("aria-valuenow"));
    fireEvent.pointerDown(lowerDivider, {
      button: 0,
      pointerId: 13,
      clientY: 120,
    });
    fireEvent.pointerMove(window, {
      pointerId: 13,
      clientY: 220,
    });
    fireEvent.pointerUp(window, {
      pointerId: 13,
      clientY: 220,
    });
    const topAfter = Number(topDivider.getAttribute("aria-valuenow"));
    expect(topAfter).toBe(topBefore);
  });
});
