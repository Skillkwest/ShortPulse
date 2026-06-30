import { readFileSync } from "node:fs";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_LIBRARY_PANEL_DENSITY_CONFIG } from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { MediaLibraryMediaGrid } from "../media-library-modal/MediaLibraryMediaGrid";
import {
  MediaLibraryVisualMediaCard,
  buildMediaLibraryCardActionLabels,
} from "../media-library-modal/MediaLibraryMediaCard";

const useMediaMasonryVirtualizationMock = vi.fn();
const useMediaGridVideoBudgetControllerMock = vi.fn();
const aiStudioModalsStylesheet = readFileSync("styles/ai-studio-modals.css", "utf8");
const mediaLibraryPanelStylesheet = readFileSync(
  "styles/ai-studio-media-library-panel.css",
  "utf8"
);
const MANUAL_WORKFLOW_RELOAD_FLAG = "NEXT_PUBLIC_AI_STUDIO_MANUAL_WORKFLOW_RELOAD_ENABLED";
const originalManualWorkflowReloadFlag = process.env[MANUAL_WORKFLOW_RELOAD_FLAG];

vi.mock("../../../media-library/hooks/useMediaMasonryVirtualization", () => ({
  useMediaMasonryVirtualization: (...args: unknown[]) => useMediaMasonryVirtualizationMock(...args),
}));

vi.mock("../../../media-library/hooks/useMediaGridVideoBudgetController", () => ({
  useMediaGridVideoBudgetController: (...args: unknown[]) =>
    useMediaGridVideoBudgetControllerMock(...args),
}));

describe("MediaLibraryMediaGrid", () => {
  beforeEach(() => {
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = "true";
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

  afterEach(() => {
    if (originalManualWorkflowReloadFlag === undefined) {
      delete process.env[MANUAL_WORKFLOW_RELOAD_FLAG];
      return;
    }
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = originalManualWorkflowReloadFlag;
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
    expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
    expect(document.querySelector("video.media-thumb")).toBeNull();
  });

  it("passes adaptive pressure into the shared video budget controller", () => {
    render(<MediaLibraryMediaGrid {...baseProps()} adaptivePressureLevel={2} />);

    expect(useMediaGridVideoBudgetControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pressureLevel: 2,
      })
    );
  });

  it("shows a video duration badge on video-tab grid cards when duration metadata exists", () => {
    const props = baseProps();
    props.activeMedia = [
      {
        ...props.activeMedia[0],
        metadata: { duration_ms: 15_000 },
      },
    ];

    render(<MediaLibraryMediaGrid {...props} />);

    expect(screen.getByText("0:15")).toBeInTheDocument();
  });

  it("keeps mixed-feed video duration badges in the media frame and out of the action row", () => {
    const file = {
      ...baseProps().activeMedia[0],
      metadata: { duration_ms: 15_000 },
    };

    const { container } = render(
      <MediaLibraryVisualMediaCard
        file={file}
        isSelected={false}
        previewAspectRatio={16 / 9}
        cardPreviewUrl="https://cdn.example.com/clip-1-poster.jpg"
        hoverVideoUrl="https://cdn.example.com/clip-1-preview.mp4"
        posterPreviewUrl="https://cdn.example.com/clip-1-poster.jpg"
        adaptivePressureLevel={0}
        fetchPriorityAttr="auto"
        getMediaCardRef={() => () => undefined}
        onSelectMediaFile={vi.fn()}
        onMediaDoubleClick={vi.fn()}
        onMediaDragStart={vi.fn()}
        onMediaDragEnd={vi.fn()}
        onToggleMediaSelection={vi.fn()}
        onMediaContextMenu={vi.fn()}
        onMediaPreviewError={vi.fn()}
        onMediaPaint={vi.fn()}
        onSignedUrlLoaded={vi.fn()}
        onRequestSignedUrl={vi.fn()}
        cacheAspectRatio={vi.fn()}
        showCardActions
        canShowDownloadAction
        canShowWorkflowReloadAction={false}
        canShowRemoveAction={false}
        canShowDeleteAction
        actionLabels={buildMediaLibraryCardActionLabels(file, {
          actionAriaLabel: "Video actions",
          downloadLabelPrefix: "Download media",
          removeLabel: "Remove clip-1.mp4 from folder",
          deleteLabel: "Delete clip-1.mp4 from library",
        })}
        dangerActionMode="exclusive"
        onDownloadMediaFile={vi.fn()}
        onDeleteMediaFromLibrary={vi.fn()}
        variant="mixed-feed"
      />
    );

    const durationBadge = screen.getByText("0:15");
    const actionRow = container.querySelector(".media-library-panel-card-actions");

    expect(durationBadge.closest(".media-library-panel-media-duration")).not.toBeNull();
    expect(durationBadge.closest(".media-library-panel-media-frame")).not.toBeNull();
    expect(actionRow).not.toBeNull();
    expect(actionRow).not.toContainElement(durationBadge);
  });

  it("restores poster visibility when pressure removes a mixed-feed hover video", () => {
    const file = {
      ...baseProps().activeMedia[0],
      metadata: { duration_ms: 15_000 },
    };
    const sharedProps = {
      file,
      isSelected: false,
      previewAspectRatio: 16 / 9,
      cardPreviewUrl: "https://cdn.example.com/clip-1-poster.jpg",
      posterPreviewUrl: "https://cdn.example.com/clip-1-poster.jpg",
      adaptivePressureLevel: 0 as const,
      fetchPriorityAttr: "auto" as const,
      getMediaCardRef: () => () => undefined,
      onSelectMediaFile: vi.fn(),
      onMediaDoubleClick: vi.fn(),
      onMediaDragStart: vi.fn(),
      onMediaDragEnd: vi.fn(),
      onToggleMediaSelection: vi.fn(),
      onMediaContextMenu: vi.fn(),
      onMediaPreviewError: vi.fn(),
      onMediaPaint: vi.fn(),
      onSignedUrlLoaded: vi.fn(),
      onRequestSignedUrl: vi.fn(),
      cacheAspectRatio: vi.fn(),
      showCardActions: true,
      canShowDownloadAction: true,
      canShowWorkflowReloadAction: false,
      canShowRemoveAction: false,
      canShowDeleteAction: true,
      actionLabels: buildMediaLibraryCardActionLabels(file, {
        actionAriaLabel: "Video actions",
        downloadLabelPrefix: "Download media",
        removeLabel: "Remove clip-1.mp4 from folder",
        deleteLabel: "Delete clip-1.mp4 from library",
      }),
      dangerActionMode: "exclusive" as const,
      onDownloadMediaFile: vi.fn(),
      onDeleteMediaFromLibrary: vi.fn(),
      variant: "mixed-feed" as const,
    };
    const { container, rerender } = render(
      <MediaLibraryVisualMediaCard
        {...sharedProps}
        hoverVideoUrl="https://cdn.example.com/clip-1-preview.mp4"
      />
    );

    const card = screen.getByRole("button", { name: "Select media clip-1.mp4" });
    const posterImage = container.querySelector(".media-library-panel-video-poster");

    fireEvent.pointerEnter(card);
    expect(posterImage).toHaveClass("is-hidden");

    rerender(<MediaLibraryVisualMediaCard {...sharedProps} hoverVideoUrl={null} />);

    expect(container.querySelector(".media-library-panel-video-poster")).not.toHaveClass(
      "is-hidden"
    );
  });

  it("marks selected image and video tab cards for the panel selection border", () => {
    const props = baseProps();
    props.selectedIds = new Set<string>(["video-1"]);

    const { container } = render(<MediaLibraryMediaGrid {...props} />);

    const shell = container.querySelector(".media-library-panel-media-card-shell");
    expect(shell).toHaveClass("is-active");
    expect(shell).toHaveClass("media-library-panel-media-card-shell--media-grid");
    expect(screen.getByRole("button", { name: "Deselect media clip-1.mp4" })).toBeInTheDocument();
  });

  it("applies panel density config without changing the default grid path", () => {
    const props = baseProps();
    const { container, rerender } = render(<MediaLibraryMediaGrid {...props} />);

    expect(useMediaMasonryVirtualizationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetColumnWidth: 220,
        maxColumnCount: undefined,
        layoutMode: "chronological-grid",
        minItemsToVirtualize: 24,
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
        minItemsToVirtualize: 1,
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

  it("uses packed masonry layout mode for panel density surfaces", () => {
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
        layoutMode: "masonry",
        minItemsToVirtualize: 1,
      })
    );
  });

  it("keeps the packed grid fallback in row-readable grid flow", () => {
    expect(aiStudioModalsStylesheet).toMatch(
      /\.media-library-modal-grid\.media-library-modal-grid-packed\s*{[^}]*display:\s*grid;/s
    );
    expect(aiStudioModalsStylesheet).toMatch(
      /\.media-library-modal-grid\.media-library-modal-grid-packed\s*{[^}]*grid-template-columns:\s*repeat\(/s
    );
    expect(aiStudioModalsStylesheet).toMatch(
      /\.media-library-modal-grid\.media-library-modal-grid-packed\.media-library-modal-grid-virtualized\s*{[^}]*display:\s*block;/s
    );
  });

  it("keeps the panel selected border wired for media-grid visual cards", () => {
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel-media-card-shell\.is-active\.media-library-panel-media-card-shell--media-grid\s+\.media-library-panel-media-card-button::after/s
    );
    expect(mediaLibraryPanelStylesheet).toMatch(
      /border:\s*2px solid rgba\(171, 233, 194, 0\.92\);/
    );
  });

  it("anchors media card actions top-right, workflow actions bottom-left, and duration badges bottom-right", () => {
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel-card-actions\s*{[^}]*top:\s*6px;[^}]*right:\s*6px;/s
    );
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel-card-actions--workflow\s*{[^}]*top:\s*auto;[^}]*right:\s*auto;[^}]*left:\s*6px;[^}]*bottom:\s*6px;/s
    );
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel\s+\.media-library-panel-media-duration\s*{[^}]*right:\s*10px;[^}]*bottom:\s*10px;/s
    );
  });

  it("keeps media-library selected markers visually aligned with Reference Grid check chips", () => {
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel-selection-toggle,\s*\.media-library-select-indicator\s*{[^}]*top:\s*6px;[^}]*left:\s*6px;[^}]*width:\s*20px;[^}]*height:\s*20px;[^}]*border-radius:\s*999px;/s
    );
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel-selection-toggle,\s*\.media-library-select-indicator\s*{[^}]*border:\s*1px solid rgba\(110, 231, 183, 0\.75\);[^}]*background:\s*rgba\(10, 14, 18, 0\.86\);[^}]*color:\s*#6ee7b7;/s
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
    expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toContainElement(
      video as HTMLElement
    );
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

  it("keeps audio cards square when the assignment layout contract is enabled", () => {
    const props = baseProps();
    props.activeMedia = [
      {
        id: "audio-1",
        filename: "voice-note.mp3",
        storage_path: "user-1/uploads/voice-note.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note.mp3",
        metadata: { aspect_ratio: 4 / 5 },
      },
    ];

    const { container } = render(
      <MediaLibraryMediaGrid {...props} fixedVisualAspectRatio={4 / 5} />
    );

    const latestVirtualizationArgs = useMediaMasonryVirtualizationMock.mock.calls.at(-1)?.[0];
    expect(latestVirtualizationArgs?.getAspectRatio(props.activeMedia[0])).toBe(1);

    const audioCard = container.querySelector(".media-library-panel-audio-reference-card");
    expect(audioCard).toHaveStyle({ aspectRatio: "1" });
    expect(screen.getByRole("button", { name: "Select audio voice-note.mp3" })).toBe(audioCard);
    expect(screen.getByText("voice-note.mp3")).toBeInTheDocument();
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

    const downloadButton = screen.getByRole("button", { name: "Download glass-fox.png" });
    const reloadButton = screen.getByRole("button", { name: "Reload workflow for glass-fox.png" });
    const topActionRow = downloadButton.parentElement;
    const workflowActionRow = reloadButton.parentElement;

    expect(topActionRow).toHaveClass("media-library-panel-card-actions");
    expect(topActionRow).not.toHaveClass("media-library-panel-card-actions--workflow");
    expect(workflowActionRow).toHaveClass("media-library-panel-card-actions");
    expect(workflowActionRow).toHaveClass("media-library-panel-card-actions--workflow");
    expect(workflowActionRow).not.toBe(topActionRow);

    fireEvent.click(reloadButton);

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
