import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_LIBRARY_PANEL_DENSITY_CONFIG } from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { MediaLibraryMediaGrid } from "../media-library-modal/MediaLibraryMediaGrid";

const useMediaMasonryVirtualizationMock = vi.fn();
const useMediaGridVideoBudgetControllerMock = vi.fn();

vi.mock("../../../media-library/hooks/useMediaMasonryVirtualization", () => ({
  useMediaMasonryVirtualization: (...args: unknown[]) => useMediaMasonryVirtualizationMock(...args),
}));

vi.mock("../../../media-library/hooks/useMediaGridVideoBudgetController", () => ({
  useMediaGridVideoBudgetController: (...args: unknown[]) =>
    useMediaGridVideoBudgetControllerMock(...args),
}));

describe("MediaLibraryMediaGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMediaMasonryVirtualizationMock.mockImplementation(({ items }: { items: unknown[] }) => ({
      containerRef: { current: null },
      isVirtualized: false,
      totalHeight: 0,
      renderItems: items.map((item, index) => ({
        id: `item-${index}`,
        item,
        index,
      })),
    }));
    useMediaGridVideoBudgetControllerMock.mockReturnValue({
      getVideoNodeRef: () => () => undefined,
      isVideoAutoplayEnabled: () => false,
      resolveVideoSource: (_id: string, src: string | null | undefined) => src ?? null,
    });
  });

  const baseProps = (): React.ComponentProps<typeof MediaLibraryMediaGrid> => ({
    activeMedia: [
      {
        id: "video-1",
        filename: "clip-1.mp4",
        storage_path: "user-1/uploads/clip-1.mp4",
        file_type: "video/mp4",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/clip-1-poster.jpg",
        poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
        preview_variant_path: null,
      },
    ],
    selectedIds: new Set<string>(),
    optimizerFallbackMediaIds: new Set<string>(),
    adaptivePressureLevel: 0 as const,
    adaptivePreviewQualityEnabled: false,
    resolveCardPreviewUrl: vi.fn(
      ({ signedUrl }: { signedUrl: string | null | undefined }) => signedUrl ?? null
    ),
    scrollContainerRef: { current: null },
    getMediaCardRef: () => () => undefined,
    onSelectMediaFile: vi.fn(),
    onMediaDoubleClick: vi.fn(),
    onMediaDragStart: vi.fn(),
    onMediaDragEnd: vi.fn(),
    onToggleMediaSelection: vi.fn(),
    showRemoveAction: false,
    onRemoveMediaFromFolder: vi.fn(),
    showDeleteAction: false,
    onDeleteMediaFromLibrary: vi.fn(),
    onDownloadMediaFile: vi.fn(),
    onMediaContextMenu: vi.fn(),
    onMediaPreviewError: vi.fn(),
    onMediaPaint: vi.fn(),
    onSignedUrlLoaded: vi.fn(),
  });

  it("renders poster-backed video rows as image cards instead of mounting video", () => {
    render(<MediaLibraryMediaGrid {...baseProps()} />);

    expect(screen.getByAltText("clip-1.mp4")).toBeInTheDocument();
    expect(document.querySelector("video.media-thumb")).toBeNull();
  });

  it("applies panel density config without changing the default grid path", () => {
    const props = baseProps();
    const { container, rerender } = render(<MediaLibraryMediaGrid {...props} />);

    expect(useMediaMasonryVirtualizationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetColumnWidth: 220,
        maxColumnCount: undefined,
      })
    );
    expect(container.querySelector(".media-library-panel-density-grid")).toBeNull();

    rerender(
      <MediaLibraryMediaGrid {...props} densityConfig={MEDIA_LIBRARY_PANEL_DENSITY_CONFIG} />
    );

    const grid = container.querySelector(".media-library-modal-grid");
    expect(useMediaMasonryVirtualizationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetColumnWidth: 188,
        maxColumnCount: 5,
      })
    );
    expect(grid).toHaveClass("media-library-panel-density-grid");
    expect(grid).toHaveStyle({
      "--media-library-modal-preview-width": "188px",
      "--media-library-panel-density-max-columns": "5",
    });
    expect(props.resolveCardPreviewUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cardLongEdgePx: 188,
      })
    );
  });

  it("keeps real video previews mounted when a durable video preview path exists", () => {
    const props = baseProps();
    props.activeMedia = [
      {
        ...props.activeMedia[0],
        signedUrl: "https://cdn.example.com/clip-1-preview.mp4",
        preview_variant_path: "user-1/variants/videos/video-1/preview_loop_360p.mp4",
      },
    ];

    render(<MediaLibraryMediaGrid {...props} />);

    const video = document.querySelector("video.media-thumb");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "https://cdn.example.com/clip-1-preview.mp4");
  });

  it("uses a fixed visual aspect ratio when the assignment layout contract is enabled", () => {
    const props = baseProps();
    props.activeMedia = [
      {
        id: "image-1",
        filename: "portrait.png",
        storage_path: "user-1/uploads/portrait.png",
        file_type: "image/png",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/portrait.png",
        width: 1024,
        height: 2048,
      },
    ];

    const { container } = render(
      <MediaLibraryMediaGrid {...props} fixedVisualAspectRatio={4 / 5} />
    );

    const latestVirtualizationArgs = useMediaMasonryVirtualizationMock.mock.calls.at(-1)?.[0];
    expect(latestVirtualizationArgs?.getAspectRatio(props.activeMedia[0])).toBe(4 / 5);

    const image = screen.getByAltText("portrait.png");
    expect(image).toHaveStyle({ aspectRatio: "0.8" });
    expect(container.querySelector(".media-library-modal-grid")).toBeInTheDocument();
  });
});
