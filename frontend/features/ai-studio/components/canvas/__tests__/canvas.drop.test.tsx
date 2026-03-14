import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResolveCanvasDropReference } from "../canvasTypes";
import { CanvasHarness, createTransfer, mockViewportRect } from "./canvasTestHarness";

describe("Canvas drop behavior", () => {
  it("creates image items from desktop file drops when file resolver is provided", async () => {
    const resolveCanvasDropFiles = vi.fn(async () => [
      {
        kind: "image" as const,
        outputId: null,
        mediaId: "media-file-drop-1",
        src: "https://example.com/file-drop.png",
        alt: "Desktop file image",
        width: 1280,
        height: 720,
      },
    ]);

    render(<CanvasHarness resolveCanvasDropFiles={resolveCanvasDropFiles} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const file = new File(["desktop"], "desktop-drop.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    const transfer = {
      files,
      types: ["Files"],
      getData: () => "",
      dropEffect: "copy",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(viewport, {
      dataTransfer: transfer,
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(resolveCanvasDropFiles).toHaveBeenCalledWith(files);
    });
    expect(await screen.findByAltText("Desktop file image")).toBeInTheDocument();
  });

  it("creates an image item from an internal reference-grid drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-1",
        "text/reference-output-id": "img-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    expect(await screen.findByAltText("Reference image")).toBeInTheDocument();
    const item = screen.getByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "image");
    expect(Number(item.getAttribute("data-width"))).toBe(275);
    expect(Number(item.getAttribute("data-height"))).toBeCloseTo(154.69, 2);
  });

  it("preprocesses internal drops before insertion when a preparer is provided", async () => {
    const prepareResolvedInternalCanvasDrop = vi.fn(async (_payload, resolved) => {
      if (resolved.kind !== "image") return resolved;
      return {
        ...resolved,
        alt: "Prepared internal image",
      };
    });

    render(<CanvasHarness prepareResolvedInternalCanvasDrop={prepareResolvedInternalCanvasDrop} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-1",
        "text/reference-output-id": "img-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    expect(await screen.findByAltText("Prepared internal image")).toBeInTheDocument();
    expect(prepareResolvedInternalCanvasDrop).toHaveBeenCalledTimes(1);
  });

  it("skips insertion when internal-drop preparer returns null", async () => {
    const prepareResolvedInternalCanvasDrop = vi.fn(async () => null);

    render(<CanvasHarness prepareResolvedInternalCanvasDrop={prepareResolvedInternalCanvasDrop} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-1",
        "text/reference-output-id": "img-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(prepareResolvedInternalCanvasDrop).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByAltText("Reference image")).toBeNull();
    expect(screen.queryAllByTestId(/canvas-item-/)).toHaveLength(0);
  });

  it("uses internal payload dimensions to size image drops before image decode", async () => {
    const payloadSizedResolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
      if (payload.outputId !== "img-payload-sized") return null;
      return {
        kind: "image",
        outputId: "img-payload-sized",
        mediaId: "media-sized",
        src: "https://example.com/payload-sized-reference.png",
        alt: "Payload-sized image",
        width: payload.width,
        height: payload.height,
        sourceSurface: payload.sourceSurface ?? null,
      };
    };
    render(<CanvasHarness resolveCanvasDropReference={payloadSizedResolveCanvasDropReference} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-payload-sized",
        "text/reference-output-id": "img-payload-sized",
        "text/reference-source-surface": "all-refs",
        "text/reference-width": "2000",
        "text/reference-height": "1000",
      }),
      clientX: 300,
      clientY: 200,
    });

    expect(await screen.findByAltText("Payload-sized image")).toBeInTheDocument();
    const item = screen.getByTestId(/canvas-item-/);
    expect(Number(item.getAttribute("data-width"))).toBe(275);
    expect(Number(item.getAttribute("data-height"))).toBe(137.5);
  });

  it("delays unknown-size image placeholder until dimensions resolve, then matches final ratio", async () => {
    const OriginalImage = globalThis.Image;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pendingImageOnload: (() => void) | null = null;
    let pendingFrameCallback: FrameRequestCallback | null = null;
    class MockImage {
      naturalWidth = 1920;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        pendingImageOnload = this.onload;
      }
    }
    (globalThis as { Image: typeof Image }).Image = MockImage as unknown as typeof Image;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      pendingFrameCallback = callback;
      return 1;
    }) as typeof window.requestAnimationFrame;
    try {
      const slowResolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
        if (payload.outputId !== "img-slow") return null;
        return {
          kind: "image",
          outputId: "img-slow",
          mediaId: "media-slow",
          src: "https://example.com/slow-reference.png",
          alt: "Slow reference image",
          sourceSurface: payload.sourceSurface ?? null,
        };
      };
      render(<CanvasHarness resolveCanvasDropReference={slowResolveCanvasDropReference} />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-version": "1",
          "text/reference-id": "img-slow",
          "text/reference-output-id": "img-slow",
          "text/reference-source-surface": "all-refs",
        }),
        clientX: 300,
        clientY: 200,
      });

      expect(screen.queryByTestId("canvas-loading-spinner")).toBeNull();
      await waitFor(() => expect(typeof pendingImageOnload).toBe("function"));
      act(() => {
        pendingImageOnload?.();
      });
      const pendingItem = await screen.findByTestId(/canvas-pending-item-/);
      await waitFor(() => {
        expect(screen.getByTestId("canvas-loading-spinner")).toBeInTheDocument();
      });
      expect(Number(pendingItem.getAttribute("style")?.match(/width:\s*([0-9.]+)px/)?.[1])).toBe(
        275
      );
      expect(Number(pendingItem.getAttribute("style")?.match(/height:\s*([0-9.]+)px/)?.[1])).toBe(
        154.69
      );
      act(() => {
        pendingFrameCallback?.(16);
      });
      expect(await screen.findByAltText("Slow reference image")).toBeInTheDocument();
      const finalItem = screen.getByTestId(/canvas-item-/);
      expect(Number(finalItem.getAttribute("data-width"))).toBe(275);
      expect(Number(finalItem.getAttribute("data-height"))).toBe(154.69);
      await waitFor(() => {
        expect(screen.queryByTestId("canvas-loading-spinner")).not.toBeInTheDocument();
      });
    } finally {
      (globalThis as { Image: typeof Image }).Image = OriginalImage;
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("shows a loading spinner placeholder while a text reference is resolving", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pendingFrameCallback: FrameRequestCallback | null = null;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      pendingFrameCallback = callback;
      return 1;
    }) as typeof window.requestAnimationFrame;
    try {
      render(<CanvasHarness />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-version": "1",
          "text/reference-id": "txt-1",
          "text/reference-output-id": "txt-1",
          "text/reference-source-surface": "all-refs",
        }),
        clientX: 240,
        clientY: 160,
      });

      expect(screen.getByTestId("canvas-loading-spinner")).toBeInTheDocument();
      expect(screen.queryByText("Prompt reference")).not.toBeInTheDocument();
      act(() => {
        pendingFrameCallback?.(16);
      });
      expect(await screen.findByText("Prompt reference")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId("canvas-loading-spinner")).not.toBeInTheDocument();
      });
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("creates a text item from an internal prompt drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "txt-1",
        "text/reference-output-id": "txt-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 240,
      clientY: 160,
    });

    expect(await screen.findByText("Prompt reference")).toBeInTheDocument();
    expect(await screen.findByTestId(/canvas-item-/)).toHaveAttribute("data-kind", "text");
  });

  it("creates a text item from an external plain-text drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "External note",
      }),
      clientX: 220,
      clientY: 140,
    });

    expect(await screen.findByText("External note")).toBeInTheDocument();
  });

  it("creates an image item from a media-library drag payload", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "application/x-shortpulse-media-library-item": JSON.stringify({
          kind: "libraryMedia",
          source: "mediaLibrary",
          payload: {
            id: "media-lib-1",
            url: "https://cdn.example.com/media-lib-1.png",
            previewUrl: "https://cdn.example.com/media-lib-1.png",
            fileType: "image",
          },
        }),
      }),
      clientX: 260,
      clientY: 180,
    });

    expect(await screen.findByAltText("Canvas media")).toBeInTheDocument();
    expect(await screen.findByTestId(/canvas-item-/)).toHaveAttribute("data-kind", "image");
  });

  it("uses media-library payload dimensions to preserve landscape ratio on drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "application/x-shortpulse-media-library-item": JSON.stringify({
          kind: "libraryMedia",
          source: "mediaLibrary",
          payload: {
            id: "media-lib-landscape",
            url: "https://cdn.example.com/media-lib-landscape.png",
            previewUrl: "https://cdn.example.com/media-lib-landscape.png",
            fileType: "image",
            width: 2000,
            height: 1000,
          },
        }),
      }),
      clientX: 260,
      clientY: 180,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(Number(item.getAttribute("data-width"))).toBe(275);
    expect(Number(item.getAttribute("data-height"))).toBe(137.5);
  });

  it("enforces a hard cap of 300 canvas items", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    for (let index = 0; index < 300; index += 1) {
      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/plain": `Note ${index + 1}`,
        }),
        clientX: 220,
        clientY: 140,
      });
    }

    await waitFor(() => {
      expect(screen.getAllByTestId(/canvas-item-/)).toHaveLength(300);
    });

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Overflow note",
      }),
      clientX: 220,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.getAllByTestId(/canvas-item-/)).toHaveLength(300);
    });
    expect(screen.queryByText("Overflow note")).not.toBeInTheDocument();
  });
});
