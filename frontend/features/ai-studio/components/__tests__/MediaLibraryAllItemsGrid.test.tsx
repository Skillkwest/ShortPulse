import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { MediaLibraryAllItemsGrid } from "../media-library-modal/MediaLibraryAllItemsGrid";

const useMediaMasonryVirtualizationMock = vi.fn();

vi.mock("../../../media-library/hooks/useMediaMasonryVirtualization", () => ({
  useMediaMasonryVirtualization: (...args: unknown[]) => useMediaMasonryVirtualizationMock(...args),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

describe("MediaLibraryAllItemsGrid", () => {
  const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

  beforeEach(() => {
    vi.clearAllMocks();
    useMediaMasonryVirtualizationMock.mockImplementation(({ items }: { items: unknown[] }) => ({
      containerRef: { current: null },
      isVirtualized: false,
      totalHeight: 0,
      columnCount: 1,
      renderItems: items.map((item, index) => ({
        id: `item-${index}`,
        item,
        index,
      })),
    }));
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  const baseProps = () => ({
    mediaRows: [
      {
        id: "video-1",
        filename: "clip-1.mp4",
        storage_path: "user-1/uploads/clip-1.mp4",
        preview_storage_path: "user-1/uploads/clip-1.mp4",
        file_type: "video/mp4",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/clip-1.mp4",
        poster_variant_path: "https://cdn.example.com/clip-1-poster.jpg",
      },
    ],
    promptRows: [],
    selectedIds: new Set<string>(),
    optimizerFallbackMediaIds: new Set<string>(),
    adaptivePressureLevel: 0 as const,
    adaptivePreviewQualityEnabled: true,
    resolveCardPreviewUrl: vi.fn(({ signedUrl }: { signedUrl: string | null | undefined }) => {
      const resolved = signedUrl ?? null;
      if (!resolved) return null;
      return resolved.includes("poster") ? `${resolved}?optimized=1` : resolved;
    }),
    scrollContainerRef: { current: null },
    getMediaCardRef: () => () => undefined,
    onSelectMediaFile: vi.fn(),
    onSelectPromptCard: vi.fn(),
    onMediaDoubleClick: vi.fn(),
    onMediaDragStart: vi.fn(),
    onPromptDragStart: vi.fn(),
    onMediaDragEnd: vi.fn(),
    onPromptDragEnd: vi.fn(),
    showRemoveAction: false,
    onRemoveMediaFromFolder: vi.fn(),
    onRemovePromptFromFolder: vi.fn(),
    showDeleteAction: false,
    onDeleteMediaFromLibrary: vi.fn(),
    onDeletePromptFromLibrary: vi.fn(),
    onDownloadMediaFile: vi.fn(),
    onMediaContextMenu: vi.fn(),
    onMediaPreviewError: vi.fn(),
    onMediaPaint: vi.fn(),
    onSignedUrlLoaded: vi.fn(),
    currentUserId: "user-1",
  });

  it("renders video cards as poster-first in the mixed all-media feed", () => {
    const { container } = render(<MediaLibraryAllItemsGrid {...baseProps()} />);

    const poster = screen.getByAltText("clip-1.mp4");
    expect(poster).toHaveAttribute("src", "https://cdn.example.com/clip-1-poster.jpg?optimized=1");

    const hoverVideo = container.querySelector("video");
    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo).toHaveAttribute("src", "https://cdn.example.com/clip-1.mp4");
    expect(hoverVideo).not.toHaveClass("is-visible");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("attaches and plays the hover video preview on pointer enter", async () => {
    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        signedUrl: "https://cdn.example.com/clip-1-poster.jpg",
      },
    ];
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user-1/uploads/clip-1.mp4", "https://cdn.example.com/signed/clip-1.mp4"]])
    );

    render(<MediaLibraryAllItemsGrid {...props} />);

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: "media_library",
          storagePaths: ["user-1/uploads/clip-1.mp4"],
          surface: "media-library-panel",
        })
      )
    );

    const [cardButton] = screen.getAllByRole("button");
    fireEvent.pointerEnter(cardButton);

    await waitFor(() => {
      expect(document.querySelector("video")).not.toBeNull();
    });

    const hoverVideo = document.querySelector("video");
    expect(hoverVideo).toHaveAttribute("src", "https://cdn.example.com/signed/clip-1.mp4");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.pointerLeave(cardButton);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("applies the virtualized masonry shell when the mixed feed is virtualized", () => {
    useMediaMasonryVirtualizationMock.mockImplementationOnce(({ items }: { items: unknown[] }) => ({
      containerRef: { current: null },
      isVirtualized: true,
      totalHeight: 640,
      columnCount: 2,
      renderItems: items.map((item, index) => ({
        id: `item-${index}`,
        item,
        index,
        style: { position: "absolute", top: `${index * 100}px`, left: "0px", width: "188px" },
      })),
    }));

    const { container } = render(<MediaLibraryAllItemsGrid {...baseProps()} />);
    const grid = container.querySelector(".media-library-panel-all-items-grid");

    expect(grid).toHaveClass("media-library-modal-grid-virtualized");
    expect(grid).toHaveStyle({ height: "640px" });
  });

  it("reports poster image loads as signed-url and paint completion for video cards", () => {
    const props = baseProps();
    render(<MediaLibraryAllItemsGrid {...props} />);

    const poster = screen.getByAltText("clip-1.mp4");
    fireEvent.load(poster);

    expect(props.onSignedUrlLoaded).toHaveBeenCalledWith("video-1");
    expect(props.onMediaPaint).toHaveBeenCalledWith("image");
  });

  it("routes video posters through the adaptive preview resolver in the mixed feed", () => {
    const props = baseProps();
    render(<MediaLibraryAllItemsGrid {...props} />);

    expect(props.resolveCardPreviewUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        signedUrl: "https://cdn.example.com/clip-1-poster.jpg",
        fileType: "image/jpeg",
      })
    );
    expect(screen.getByAltText("clip-1.mp4")).toHaveAttribute(
      "src",
      "https://cdn.example.com/clip-1-poster.jpg?optimized=1"
    );
  });

  it("signs poster storage paths and routes them through the adaptive preview resolver", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/video-1/poster_720.jpg",
          "https://cdn.example.com/signed/clip-1-poster.jpg",
        ],
        ["user-1/uploads/clip-1.mp4", "https://cdn.example.com/signed/clip-1.mp4"],
      ])
    );

    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    await waitFor(() => expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(2));

    expect(getSignedMediaUrlsBatchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/uploads/clip-1.mp4"],
        surface: "media-library-panel",
      })
    );
    expect(getSignedMediaUrlsBatchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/variants/videos/video-1/poster_720.jpg"],
        surface: "media-library-panel",
      })
    );

    await waitFor(() =>
      expect(screen.getByAltText("clip-1.mp4")).toHaveAttribute(
        "src",
        "https://cdn.example.com/signed/clip-1-poster.jpg?optimized=1"
      )
    );

    expect(props.resolveCardPreviewUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        signedUrl: "https://cdn.example.com/signed/clip-1-poster.jpg",
        fileType: "image/jpeg",
      })
    );
  });

  it("falls back to a visible video preview when a saved video has no poster asset", async () => {
    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        poster_variant_path: null,
        thumb_variant_path: null,
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);

    const hoverVideo = container.querySelector("video");
    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo).toHaveAttribute("src", "https://cdn.example.com/clip-1.mp4");
    expect(screen.queryByAltText("clip-1.mp4")).toBeNull();

    const [cardButton] = screen.getAllByRole("button");
    fireEvent.pointerEnter(cardButton);
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    fireEvent.pointerLeave(cardButton);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});
