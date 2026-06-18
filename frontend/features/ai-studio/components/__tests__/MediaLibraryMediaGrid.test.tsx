import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: vi.fn(),
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
        layoutMode: "masonry",
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
        layoutMode: "masonry",
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

  it("uses chronological layout mode for panel surfaces", () => {
    const props = baseProps();
    render(
      <MediaLibraryMediaGrid
        {...props}
        surface="media-library-panel"
        densityConfig={MEDIA_LIBRARY_PANEL_DENSITY_CONFIG}
      />
    );

    expect(useMediaMasonryVirtualizationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layoutMode: "chronological-grid",
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

  it("requests a missing signed audio URL and starts playback from one play click", async () => {
    const props = baseProps();
    props.activeMedia = [
      {
        id: "audio-1",
        filename: "voice-note.mp3",
        storage_path: "user-1/uploads/voice-note.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: null,
        metadata: { durationMs: 8_000 },
      },
    ];
    props.onRequestSignedUrl = vi.fn().mockResolvedValue("https://cdn.example.com/voice-note.mp3");

    const { container } = render(<MediaLibraryMediaGrid {...props} />);
    const audioNode = container.querySelector(".reference-card-audio");

    expect(audioNode).not.toBeNull();
    expect(audioNode).not.toHaveAttribute("src");
    await waitFor(() => {
      expect(props.onRequestSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "audio-1" })
      );
    });
    await waitFor(() => {
      expect(audioNode).toHaveAttribute("src", "https://cdn.example.com/voice-note.mp3");
    });
    vi.mocked(props.onRequestSignedUrl).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Play audio voice-note.mp3" }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    expect(props.onRequestSignedUrl).not.toHaveBeenCalled();
    expect(audioNode).toHaveAttribute("src", "https://cdn.example.com/voice-note.mp3");
  });

  it("renders signed audio download and delete together in the hover action row", () => {
    const props = baseProps();
    props.showDeleteAction = true;
    props.activeMedia = [
      {
        id: "audio-1",
        filename: "voice-note.mp3",
        storage_path: "user-1/uploads/voice-note.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note.mp3",
        metadata: { durationMs: 8_000 },
      },
    ];

    const { container } = render(<MediaLibraryMediaGrid {...props} />);

    const downloadButton = screen.getByRole("button", { name: "Download audio voice-note.mp3" });
    const deleteButton = screen.getByRole("button", { name: "Delete voice-note.mp3 from library" });
    const actionRow = downloadButton.parentElement;

    expect(actionRow).toHaveClass("media-library-panel-card-actions");
    expect(actionRow).toContainElement(deleteButton);
    expect(container.querySelector(".reference-card-audio-download")).toBeNull();

    fireEvent.click(downloadButton);

    expect(props.onDownloadMediaFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "audio-1" })
    );
    expect(props.onSelectMediaFile).not.toHaveBeenCalled();
    expect(props.onToggleMediaSelection).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(props.onDeleteMediaFromLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ id: "audio-1" })
    );
  });

  it("shows workflow reload actions only for restorable AI Studio media rows", () => {
    const onReloadWorkflowFromMedia = vi.fn();
    const props = baseProps();
    const workflowReload = {
      version: 1,
      source: "ai_studio_generation",
      capturedAt: "2026-06-06T14:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      restoreBehavior: "navigate_and_hydrate",
      projectId: "project-1",
      createMode: "standard",
      pulse: null,
      prompt: {
        display: "A glass fox in a desert observatory",
      },
      model: {
        id: "fal-ai/imagen4/preview",
      },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "16:9",
        imageResolution: "1K",
        referenceInputs: [],
        internalMediaRefs: [],
      },
    };
    props.activeMedia = [
      {
        id: "image-1",
        filename: "glass-fox.png",
        storage_path: "user-1/media-library/glass-fox.png",
        file_type: "image/png",
        source: "ai_studio",
        source_ref: "generation-1",
        created_at: "2026-06-06T14:01:00.000Z",
        signedUrl: "https://cdn.example.com/glass-fox.png",
        metadata: {
          workflow_reload: workflowReload,
        },
      },
    ];

    const { rerender } = render(
      <MediaLibraryMediaGrid {...props} onReloadWorkflowFromMedia={onReloadWorkflowFromMedia} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload workflow for glass-fox.png" }));

    expect(onReloadWorkflowFromMedia).toHaveBeenCalledWith(props.activeMedia[0]);

    rerender(
      <MediaLibraryMediaGrid
        {...props}
        activeMedia={[
          {
            ...props.activeMedia[0],
            source: "upload",
            metadata: null,
          },
        ]}
        onReloadWorkflowFromMedia={onReloadWorkflowFromMedia}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Reload workflow for glass-fox.png" })
    ).not.toBeInTheDocument();
  });
});
