import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clearBreadcrumbs, getBreadcrumbsSnapshot } from "../../../../../lib/clientBreadcrumbs";
import { AI_STUDIO_CANVAS_ITEM_HARD_CAP } from "../../../logic/sessionSnapshotCanvas";
import type {
  PrepareCanvasMediaLibraryDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropReference,
} from "../canvasTypes";
import {
  CanvasHarness,
  createTransfer,
  mockViewportRect,
  SeededCanvasHarness,
} from "./canvasTestHarness";

const dispatchDropAtPoint = ({
  viewport,
  dataTransfer,
  clientX,
  clientY,
}: {
  viewport: HTMLElement;
  dataTransfer: DataTransfer;
  clientX: number;
  clientY: number;
}) => {
  const event = createEvent.drop(viewport);
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: dataTransfer,
  });
  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: clientX,
  });
  Object.defineProperty(event, "clientY", {
    configurable: true,
    value: clientY,
  });
  fireEvent(viewport, event);
};

describe("Canvas drop behavior", () => {
  it("activates drop state during dragover for media-library type hints without reading payload data", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const transfer = {
      files: { length: 0, item: () => null } as unknown as FileList,
      types: ["text/shortpulse-media-library-marker", "text/shortpulse-media-library-kind"],
      getData: vi.fn(() => {
        throw new Error("payload read should not be required");
      }),
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.dragOver(viewport, { dataTransfer: transfer });

    expect(viewport).toHaveClass("is-drop-active");
    expect(transfer.getData).not.toHaveBeenCalled();
  });

  it("activates drop state during dragover for internal custom-type payloads", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const transfer = {
      files: { length: 0, item: () => null } as unknown as FileList,
      types: ["text/reference-id", "text/reference-output-id", "text/reference-origin"],
      getData: () => "",
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.dragOver(viewport, { dataTransfer: transfer });

    expect(viewport).toHaveClass("is-drop-active");
  });

  it("does not block internal dragover packets when browser includes Files type with zero files", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const transfer = {
      files: { length: 0, item: () => null } as unknown as FileList,
      types: ["Files", "text/reference-id", "text/reference-output-id", "text/reference-origin"],
      getData: () => "",
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.dragOver(viewport, { dataTransfer: transfer });

    expect(viewport).toHaveClass("is-drop-active");
  });

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

  it("shows controlled unavailable UI when canvas image media fails to render", async () => {
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

    fireEvent.drop(viewport, {
      dataTransfer: {
        files,
        types: ["Files"],
        getData: () => "",
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer,
      clientX: 300,
      clientY: 200,
    });

    const image = await screen.findByAltText("Desktop file image");
    fireEvent.error(image);

    expect(screen.queryByAltText("Desktop file image")).not.toBeInTheDocument();
    expect(screen.getByText("Media unavailable")).toBeInTheDocument();
  });

  it("reports canvas image render failures to the page media authority owner", async () => {
    const onCanvasMediaRenderError = vi.fn();
    const resolveCanvasDropFiles = vi.fn(async () => [
      {
        kind: "image" as const,
        outputId: "output-file-drop-1",
        mediaId: "media-file-drop-1",
        src: "https://example.com/file-drop.png",
        alt: "Desktop file image",
        width: 1280,
        height: 720,
      },
    ]);

    render(
      <CanvasHarness
        resolveCanvasDropFiles={resolveCanvasDropFiles}
        onCanvasMediaRenderError={onCanvasMediaRenderError}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const file = new File(["desktop"], "desktop-drop.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;

    fireEvent.drop(viewport, {
      dataTransfer: {
        files,
        types: ["Files"],
        getData: () => "",
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer,
      clientX: 300,
      clientY: 200,
    });

    const image = await screen.findByAltText("Desktop file image");
    fireEvent.error(image);

    expect(onCanvasMediaRenderError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        outputId: "output-file-drop-1",
        mediaId: "media-file-drop-1",
        src: "https://example.com/file-drop.png",
      })
    );
  });

  it("routes media-library image drops through the async library-drop preparer when provided", async () => {
    const prepareCanvasMediaLibraryDrop = vi.fn(async (payload) => {
      if (payload.kind !== "libraryMedia") return null;
      return {
        kind: "image" as const,
        outputId: "library-out-1",
        mediaId: payload.payload.id,
        src: payload.payload.url,
        alt: "Prepared library image",
        width: payload.payload.width,
        height: payload.payload.height,
      };
    }) satisfies PrepareCanvasMediaLibraryDrop;

    render(<CanvasHarness prepareCanvasMediaLibraryDrop={prepareCanvasMediaLibraryDrop} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryMedia",
        "text/shortpulse-media-library-id": "media-lib-1",
        "text/shortpulse-media-library-url": "https://example.com/library-image.png",
        "text/shortpulse-media-library-file-type": "image",
        "text/shortpulse-media-library-filename": "Library Image",
        "text/shortpulse-media-library-width": "1600",
        "text/shortpulse-media-library-height": "900",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(prepareCanvasMediaLibraryDrop).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByAltText("Prepared library image")).toBeInTheDocument();
  });

  it("creates an audio card from a media-library audio drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryMedia",
        "text/shortpulse-media-library-id": "media-audio-1",
        "text/shortpulse-media-library-url": "https://example.com/library-audio.mp3",
        "text/shortpulse-media-library-file-type": "audio",
        "text/shortpulse-media-library-filename": "Library Audio",
        "text/shortpulse-media-library-companion-art-url":
          "https://example.com/library-audio-cover.webp",
        "text/shortpulse-media-library-companion-art-storage-path":
          "user-1/audio/library-audio-cover.webp",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "audio");
    expect(Number(item.getAttribute("data-width"))).toBe(160);
    expect(Number(item.getAttribute("data-height"))).toBe(200);
    expect(screen.getByRole("button", { name: "Play Library Audio" })).toBeInTheDocument();
    expect(
      item.querySelector(".reference-card-audio-shell")?.getAttribute("style") ?? ""
    ).toContain("library-audio-cover.webp");
  });

  it("creates a video item from a media-library video drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryMedia",
        "text/shortpulse-media-library-id": "media-video-1",
        "text/shortpulse-media-library-url": "https://example.com/library-video.mp4",
        "text/shortpulse-media-library-file-type": "video",
        "text/shortpulse-media-library-filename": "Library Video",
        "text/shortpulse-media-library-preview-poster-url":
          "https://example.com/library-video-poster.webp",
        "text/shortpulse-media-library-width": "1920",
        "text/shortpulse-media-library-height": "1080",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "video");
    const video = item.querySelector("video");
    expect(video).toHaveAttribute("src", "https://example.com/library-video.mp4");
    expect(video).toHaveAttribute("poster", "https://example.com/library-video-poster.webp");
    expect(video).toHaveAttribute("aria-label", "Library Video");
  });

  it("sizes poster-backed media-library videos from poster dimensions when drag dimensions are missing", async () => {
    const OriginalImage = globalThis.Image;
    class LandscapePosterImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;

      set src(_value: string) {
        this.naturalWidth = 1920;
        this.naturalHeight = 1080;
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal("Image", LandscapePosterImage);

    try {
      const prepareCanvasMediaLibraryDrop = vi.fn(async (payload) => {
        if (payload.kind !== "libraryMedia") return null;
        return {
          kind: "video" as const,
          outputId: "library-video-1",
          mediaId: payload.payload.id,
          videoUrl: payload.payload.url,
          posterUrl: payload.payload.previewPosterUrl ?? null,
          title: payload.payload.filename ?? null,
        };
      }) satisfies PrepareCanvasMediaLibraryDrop;

      render(<CanvasHarness prepareCanvasMediaLibraryDrop={prepareCanvasMediaLibraryDrop} />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
          "text/shortpulse-media-library-kind": "libraryMedia",
          "text/shortpulse-media-library-id": "media-video-1",
          "text/shortpulse-media-library-url": "https://example.com/library-video.mp4",
          "text/shortpulse-media-library-file-type": "video",
          "text/shortpulse-media-library-filename": "Library Video",
          "text/shortpulse-media-library-preview-poster-url":
            "https://example.com/library-video-poster.webp",
        }),
        clientX: 300,
        clientY: 200,
      });

      const item = await screen.findByTestId(/canvas-item-/);
      expect(item).toHaveAttribute("data-kind", "video");
      expect(Number(item.getAttribute("data-width"))).toBe(275);
      expect(Number(item.getAttribute("data-height"))).toBeCloseTo(154.69, 2);
    } finally {
      vi.stubGlobal("Image", OriginalImage);
    }
  });

  it("shows controlled unavailable UI when canvas video media fails to render", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryMedia",
        "text/shortpulse-media-library-id": "media-video-1",
        "text/shortpulse-media-library-url": "https://example.com/library-video.mp4",
        "text/shortpulse-media-library-file-type": "video",
        "text/shortpulse-media-library-filename": "Library Video",
        "text/shortpulse-media-library-preview-poster-url":
          "https://example.com/library-video-poster.webp",
        "text/shortpulse-media-library-width": "1920",
        "text/shortpulse-media-library-height": "1080",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const video = item.querySelector("video");
    expect(video).toHaveAttribute("src", "https://example.com/library-video.mp4");
    expect(video).toHaveAttribute("poster", "https://example.com/library-video-poster.webp");

    fireEvent.error(video as HTMLVideoElement);

    expect(item.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByText("Media unavailable")).toBeInTheDocument();
  });

  it("routes media-library prompt drops through the async library-drop preparer when provided", async () => {
    const prepareCanvasMediaLibraryDrop = vi.fn(async (payload) => {
      if (payload.kind !== "libraryPrompt") return null;
      return {
        kind: "text" as const,
        outputId: "prompt-library-1",
        text: payload.payload.promptText,
      };
    }) satisfies PrepareCanvasMediaLibraryDrop;

    render(<CanvasHarness prepareCanvasMediaLibraryDrop={prepareCanvasMediaLibraryDrop} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-lib-1",
        "text/shortpulse-media-library-prompt": "Prompt from media library",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(prepareCanvasMediaLibraryDrop).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Prompt from media library")).toBeInTheDocument();
  });

  it("routes dropped external media references through the async dropped-media resolver", async () => {
    const resolveCanvasDroppedMediaReference = vi.fn(async (payload) => ({
      kind: "image" as const,
      outputId: "external-media-1",
      mediaId: null,
      src: payload.url,
      alt: "External media",
      width: 1200,
      height: 800,
    })) satisfies ResolveCanvasDroppedMediaReference;

    render(
      <CanvasHarness resolveCanvasDroppedMediaReference={resolveCanvasDroppedMediaReference} />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/uri-list": "https://example.com/external-image.png",
        "text/plain": "https://example.com/external-image.png",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(resolveCanvasDroppedMediaReference).toHaveBeenCalledWith({
        url: "https://example.com/external-image.png",
        mimeType: "image/*",
      });
    });
    expect(await screen.findByAltText("External media")).toBeInTheDocument();
  });

  it("renders dropped external videos as canvas video items", async () => {
    const resolveCanvasDroppedMediaReference = vi.fn(async (payload) => ({
      kind: "video" as const,
      outputId: "external-video-1",
      mediaId: null,
      videoUrl: payload.url,
      posterUrl: "https://example.com/external-video-poster.webp",
      title: "External video",
      width: 1280,
      height: 720,
    })) satisfies ResolveCanvasDroppedMediaReference;

    render(
      <CanvasHarness resolveCanvasDroppedMediaReference={resolveCanvasDroppedMediaReference} />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/uri-list": "https://example.com/external-video.mp4",
        "text/plain": "https://example.com/external-video.mp4",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const video = item.querySelector("video");
    expect(item).toHaveAttribute("data-kind", "video");
    expect(video).toHaveAttribute("src", "https://example.com/external-video.mp4");
    expect(video).toHaveAttribute("poster", "https://example.com/external-video-poster.webp");
    expect(video).toHaveAttribute("aria-label", "External video");
  });

  it("renders dropped external videos without posters as muted canvas video previews", async () => {
    const resolveCanvasDroppedMediaReference = vi.fn(async (payload) => ({
      kind: "video" as const,
      outputId: "external-video-1",
      mediaId: null,
      videoUrl: payload.url,
      posterUrl: null,
      title: "Posterless video",
      width: 1280,
      height: 720,
    })) satisfies ResolveCanvasDroppedMediaReference;

    render(
      <CanvasHarness resolveCanvasDroppedMediaReference={resolveCanvasDroppedMediaReference} />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/uri-list": "https://example.com/external-video.mp4",
        "text/plain": "https://example.com/external-video.mp4",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const video = item.querySelector("video");
    expect(video).toBeTruthy();
    expect(video).toHaveAttribute("src", "https://example.com/external-video.mp4");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("aria-label", "Posterless video");
    expect(video?.muted).toBe(true);
    expect(item.querySelector(".canvas-scene-item__video-placeholder")).toBeNull();
  });

  it("prioritizes internal reference payloads over file fallback when both are present", async () => {
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
      types: ["Files", "text/reference-id", "text/reference-output-id", "text/reference-origin"],
      getData: (type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-version") return "1";
        if (type === "text/reference-id") return "img-1";
        if (type === "text/reference-output-id") return "img-1";
        if (type === "text/reference-source-surface") return "all-refs";
        return "";
      },
      dropEffect: "copy",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(viewport, {
      dataTransfer: transfer,
      clientX: 300,
      clientY: 200,
    });

    expect(await screen.findByAltText("Reference image")).toBeInTheDocument();
    expect(resolveCanvasDropFiles).not.toHaveBeenCalled();
    expect(screen.queryByAltText("Desktop file image")).toBeNull();
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

  it("creates an audio card from an internal reference-grid drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "aud-1",
        "text/reference-output-id": "aud-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "audio");
    expect(Number(item.getAttribute("data-width"))).toBe(160);
    expect(Number(item.getAttribute("data-height"))).toBe(200);
    expect(screen.getByRole("button", { name: "Play Reference audio" })).toBeInTheDocument();
    expect(
      item.querySelector(".reference-card-audio-shell")?.getAttribute("style") ?? ""
    ).toContain("reference-audio-cover.webp");
  });

  it("creates a video item from an internal reference-grid drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "vid-1",
        "text/reference-output-id": "vid-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "video");
    const video = item.querySelector("video");
    expect(video).toHaveAttribute("src", "https://example.com/reference-video.mp4");
    expect(video).toHaveAttribute("poster", "https://example.com/reference-video-poster.webp");
    expect(video).toHaveAttribute("aria-label", "Reference video");
    expect(Number(item.getAttribute("data-width"))).toBe(275);
    expect(Number(item.getAttribute("data-height"))).toBeCloseTo(154.69, 2);
  });

  it("measures viewport geometry only once for internal reference-grid drops", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    const rectSpy = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 600,
      bottom: 400,
      width: 600,
      height: 400,
      toJSON: () => ({}),
    }));
    Object.defineProperty(viewport, "getBoundingClientRect", {
      configurable: true,
      value: rectSpy,
    });

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
    expect(rectSpy).toHaveBeenCalledTimes(1);
  });

  it("preprocesses internal drops before insertion when a preparer is provided", async () => {
    const prepareResolvedInternalCanvasDrop = vi.fn(async (_payload, resolved) => {
      if (!resolved) return null;
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

  it("records a breadcrumb when an internal drop payload cannot be resolved", async () => {
    clearBreadcrumbs();
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "missing-output",
        "text/reference-output-id": "missing-output",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      const breadcrumbs = getBreadcrumbsSnapshot().filter(
        (crumb) => crumb.message === "canvas.internal_drop.unresolved"
      );
      expect(breadcrumbs.length).toBeGreaterThan(0);
      const latest = breadcrumbs[breadcrumbs.length - 1];
      expect(latest.level).toBe("warn");
      expect(latest.data?.reason).toBe("resolve_miss");
      expect(latest.data?.outputId).toBe("missing-output");
    });
    clearBreadcrumbs();
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

      dispatchDropAtPoint({
        viewport,
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
      const pendingItem = screen.getByTestId(/canvas-pending-item-/);
      expect(pendingItem).toHaveStyle({
        "--canvas-item-x": "240px",
        "--canvas-item-y": "160px",
      });
      act(() => {
        pendingFrameCallback?.(16);
      });
      expect(await screen.findByText("Prompt reference")).toBeInTheDocument();
      const finalItem = await screen.findByTestId(/canvas-item-/);
      expect(Number(finalItem.getAttribute("data-x"))).toBe(240);
      expect(Number(finalItem.getAttribute("data-y"))).toBe(160);
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

    dispatchDropAtPoint({
      viewport,
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
    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "text");
    expect(Number(item.getAttribute("data-x"))).toBe(240);
    expect(Number(item.getAttribute("data-y"))).toBe(160);
  });

  it("creates a text item from an external plain-text drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/plain": "External note",
      }),
      clientX: 220,
      clientY: 140,
    });

    expect(await screen.findByText("External note")).toBeInTheDocument();
    const item = await screen.findByTestId(/canvas-item-/);
    expect(Number(item.getAttribute("data-x"))).toBe(220);
    expect(Number(item.getAttribute("data-y"))).toBe(140);
  });

  it("anchors media-library prompt drops at the transformed pointer position", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 40, y: 20, zoom: 2 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-lib-zoomed",
        "text/shortpulse-media-library-prompt": "Zoomed prompt",
      }),
      clientX: 300,
      clientY: 220,
    });

    expect(await screen.findByText("Zoomed prompt")).toBeInTheDocument();
    const item = await screen.findByTestId(/canvas-item-/);
    expect(Number(item.getAttribute("data-x"))).toBe(130);
    expect(Number(item.getAttribute("data-y"))).toBe(100);
  });

  it("does not change stored geometry of existing items when a text item is dropped", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "existing-image",
              kind: "image",
              x: 120,
              y: 90,
              z: 1,
              selected: false,
              outputId: "image-1",
              sourceSurface: null,
              mediaId: "media-image-1",
              src: "https://example.com/existing-image.png",
              alt: "Existing image",
              width: 220,
              height: 124,
            },
            {
              id: "existing-text",
              kind: "text",
              x: 40,
              y: 70,
              z: 2,
              selected: true,
              outputId: null,
              sourceSurface: null,
              text: "Existing note",
              width: 260,
              height: 120,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/plain": "New note",
      }),
      clientX: 220,
      clientY: 140,
    });

    expect(await screen.findByText("New note")).toBeInTheDocument();
    const newTextItem = screen
      .getAllByTestId(/canvas-item-/)
      .find((item) => item.textContent?.includes("New note"));
    expect(newTextItem).toBeDefined();
    const resolvedNewTextItem = newTextItem as HTMLElement;
    expect(resolvedNewTextItem).toHaveAttribute("data-x", "220");
    expect(resolvedNewTextItem).toHaveAttribute("data-y", "140");
    const existingImage = screen.getByTestId("canvas-item-existing-image");
    expect(existingImage).toHaveAttribute("data-x", "120");
    expect(existingImage).toHaveAttribute("data-y", "90");
    expect(existingImage).toHaveAttribute("data-width", "220");
    expect(existingImage).toHaveAttribute("data-height", "124");
    const existingItem = screen.getByTestId("canvas-item-existing-text");
    expect(existingItem).toHaveAttribute("data-x", "40");
    expect(existingItem).toHaveAttribute("data-y", "70");
    expect(existingItem).toHaveAttribute("data-width", "260");
    expect(existingItem).toHaveAttribute("data-height", "120");
  });

  it("keeps repeated internal prompt drops as independent text bubbles", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const internalTransfer = createTransfer({
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-version": "1",
      "text/reference-id": "txt-1",
      "text/reference-output-id": "txt-1",
      "text/reference-source-surface": "all-refs",
    });

    dispatchDropAtPoint({
      viewport,
      dataTransfer: internalTransfer,
      clientX: 240,
      clientY: 160,
    });

    await screen.findByText("Prompt reference");

    dispatchDropAtPoint({
      viewport,
      dataTransfer: internalTransfer,
      clientX: 320,
      clientY: 220,
    });

    await waitFor(() => {
      const items = screen.getAllByTestId(/canvas-item-/);
      expect(items).toHaveLength(2);
    });
    const items = screen.getAllByTestId(/canvas-item-/);
    const promptItems = items.filter((item) => item.getAttribute("data-kind") === "text");
    expect(promptItems).toHaveLength(2);
    const positions = promptItems.map((item) => ({
      x: Number(item.getAttribute("data-x")),
      y: Number(item.getAttribute("data-y")),
    }));
    expect(positions).toEqual(
      expect.arrayContaining([
        { x: 240, y: 160 },
        { x: 320, y: 220 },
      ])
    );
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
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: Array.from({ length: AI_STUDIO_CANVAS_ITEM_HARD_CAP }, (_, index) => ({
            id: `seeded-text-${index + 1}`,
            kind: "text" as const,
            x: index,
            y: index,
            z: index + 1,
            selected: index === AI_STUDIO_CANVAS_ITEM_HARD_CAP - 1,
            outputId: null,
            sourceSurface: null,
            text: `Seeded note ${index + 1}`,
            width: 260,
          })),
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    await waitFor(() => {
      expect(screen.getAllByTestId(/canvas-item-/)).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    });

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Overflow note",
      }),
      clientX: 220,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.getAllByTestId(/canvas-item-/)).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    });
    expect(screen.queryByText("Overflow note")).not.toBeInTheDocument();
  });
});
