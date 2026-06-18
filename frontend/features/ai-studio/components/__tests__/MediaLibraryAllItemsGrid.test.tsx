import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_LIBRARY_PANEL_DENSITY_CONFIG } from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { __resetExclusiveSoundPlaybackForTests } from "../shared/exclusiveSoundPlayback";
import { MediaLibraryAllItemsGrid } from "../media-library-modal/MediaLibraryAllItemsGrid";

const useMediaMasonryVirtualizationMock = vi.fn();

vi.mock("../../../media-library/hooks/useMediaMasonryVirtualization", () => ({
  useMediaMasonryVirtualization: (...args: unknown[]) => useMediaMasonryVirtualizationMock(...args),
}));

describe("MediaLibraryAllItemsGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetExclusiveSoundPlaybackForTests();
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

  const baseProps = (): React.ComponentProps<typeof MediaLibraryAllItemsGrid> => ({
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
    signedPosterUrlById: {},
    signedVideoUrlById: {},
  });

  const readRenderedMediaCardOrder = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll(".media-library-panel-media-card-shell")).map((shell) => {
      const image = shell.querySelector("img[alt]");
      if (image instanceof HTMLImageElement) {
        return image.alt;
      }
      const audioPlayButton = shell.querySelector(".reference-card-audio-play");
      if (audioPlayButton instanceof HTMLButtonElement) {
        return audioPlayButton.getAttribute("aria-label") ?? "audio";
      }
      return "unknown";
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

  it("shows a video duration badge when duration metadata exists", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        metadata: { durationMs: 9_000 },
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    expect(screen.getByText("0:09")).toBeInTheDocument();
  });

  it("attaches and plays the provided hover video preview on pointer enter", async () => {
    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        signedUrl: "https://cdn.example.com/clip-1-poster.jpg",
      },
    ];
    props.signedVideoUrlById = {
      "video-1": "https://cdn.example.com/signed/clip-1.mp4",
    };

    render(<MediaLibraryAllItemsGrid {...props} />);

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
        style: {
          position: "absolute",
          top: `${index * 100}px`,
          left: "0px",
          width: "188px",
          height: "132px",
        },
      })),
    }));

    const { container } = render(<MediaLibraryAllItemsGrid {...baseProps()} />);
    const grid = container.querySelector(".media-library-panel-all-items-grid");
    const cardShell = container.querySelector(".media-library-panel-media-card-shell");
    const virtualizedWrapper = cardShell?.parentElement;

    expect(grid).toHaveClass("media-library-modal-grid-virtualized");
    expect(grid).toHaveStyle({ height: "640px" });
    expect(virtualizedWrapper).toHaveStyle({
      position: "absolute",
      top: "0px",
      left: "0px",
      width: "188px",
      height: "132px",
    });
  });

  it("applies panel density config to mixed grids and adaptive preview sizing", () => {
    const props = baseProps();
    const { container } = render(
      <MediaLibraryAllItemsGrid {...props} densityConfig={MEDIA_LIBRARY_PANEL_DENSITY_CONFIG} />
    );
    const grid = container.querySelector(".media-library-panel-all-items-grid");

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
    expect(props.resolveCardPreviewUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        cardLongEdgePx: 188,
      })
    );
  });

  it("uses a fixed visual aspect ratio when the assignment layout contract is enabled", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "image-1",
        filename: "portrait.png",
        storage_path: "user-1/uploads/portrait.png",
        preview_storage_path: "user-1/uploads/portrait.png",
        file_type: "image/png",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/portrait.png",
        width: 1024,
        height: 2048,
      },
    ];

    const { container } = render(
      <MediaLibraryAllItemsGrid {...props} fixedVisualAspectRatio={4 / 5} />
    );

    const latestVirtualizationArgs = useMediaMasonryVirtualizationMock.mock.calls.at(-1)?.[0];
    expect(
      latestVirtualizationArgs?.getAspectRatio({
        key: "media:image-1",
        kind: "media",
        id: "image-1",
        createdAt: 0,
        row: props.mediaRows[0],
      })
    ).toBe(4 / 5);

    const frame = container.querySelector(".media-library-panel-media-frame");
    expect(frame).toHaveStyle({ aspectRatio: "0.8" });
  });

  it("can prioritize preview-bearing visual media ahead of audio-heavy mixed chronology", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-2",
        filename: "audio-2.mp3",
        storage_path: "user-1/uploads/audio-2.mp3",
        preview_storage_path: "user-1/uploads/audio-2.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-10T18:00:00.000Z",
        signedUrl: null,
        metadata: null,
      },
      {
        id: "audio-1",
        filename: "audio-1.mp3",
        storage_path: "user-1/uploads/audio-1.mp3",
        preview_storage_path: "user-1/uploads/audio-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-09T18:00:00.000Z",
        signedUrl: null,
        metadata: null,
      },
      {
        id: "image-1",
        filename: "image-1.png",
        storage_path: "user-1/uploads/image-1.png",
        preview_storage_path: "user-1/uploads/image-1.png",
        file_type: "image/png",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/image-1.png",
      },
      {
        id: "video-1",
        filename: "video-1.mp4",
        storage_path: "user-1/uploads/video-1.mp4",
        preview_storage_path: "user-1/uploads/video-1.mp4",
        file_type: "video/mp4",
        created_at: "2026-04-07T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/video-1.mp4",
        poster_variant_path: "https://cdn.example.com/video-1-poster.jpg",
      },
    ];

    const { container } = render(
      <MediaLibraryAllItemsGrid {...props} preferVisualMediaFirst visualMediaPriorityCount={2} />
    );

    expect(readRenderedMediaCardOrder(container)).toEqual([
      "image-1.png",
      "video-1.mp4",
      "Play audio audio-2.mp3",
      "Play audio audio-1.mp3",
    ]);
  });

  it("applies virtualized layout styles to prompt cards in the mixed feed", () => {
    useMediaMasonryVirtualizationMock.mockImplementationOnce(({ items }: { items: unknown[] }) => ({
      containerRef: { current: null },
      isVirtualized: true,
      totalHeight: 640,
      columnCount: 2,
      renderItems: items.map((item, index) => ({
        id: `item-${index}`,
        item,
        index,
        style: {
          position: "absolute",
          top: `${index * 100}px`,
          left: `${index * 10}px`,
          width: "188px",
          height: "235px",
        },
      })),
    }));

    const props = baseProps();
    props.promptRows = [
      {
        id: "prompt-1",
        title: "Prompt One",
        prompt_text: "Cinematic portrait prompt",
        created_at: "2026-04-09T18:00:00.000Z",
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    const promptText = screen.getByText("Cinematic portrait prompt");
    const promptShell = promptText.closest(".media-library-panel-prompt-reference-shell");

    expect(promptShell).not.toBeNull();
    expect(promptShell).toHaveStyle({
      position: "absolute",
      top: "0px",
      left: "0px",
      width: "188px",
      height: "235px",
    });
  });

  it("reports poster image loads as signed-url and paint completion for video cards", () => {
    const props = baseProps();
    render(<MediaLibraryAllItemsGrid {...props} />);

    const poster = screen.getByAltText("clip-1.mp4");
    fireEvent.load(poster);

    expect(props.onSignedUrlLoaded).toHaveBeenCalledWith("video-1");
    expect(props.onMediaPaint).toHaveBeenCalledWith("image");
  });

  it("passes companion art through to audio card backgrounds", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note.wav",
        storage_path: "user-1/generations/audio/voice-note.wav",
        file_type: "audio/wav",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note.wav",
        companion_art_url: "https://cdn.example.com/voice-note-cover.png",
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);
    const audioShell = container.querySelector(".reference-card-audio-shell");

    expect(audioShell).not.toBeNull();
    expect(audioShell).toHaveStyle({
      backgroundImage: expect.stringContaining("voice-note-cover.png"),
    });
  });

  it("renders generated audio display titles from metadata", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/generations/audio/voice-note-1.mp3",
        preview_storage_path: "user-1/generations/audio/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-09T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note-1.mp3",
        metadata: {
          display_title: "City Take A1B2",
        },
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    expect(screen.getByText("City Take A1B2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play audio City Take A1B2" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download media City Take A1B2" })
    ).toBeInTheDocument();
  });

  it("uses metadata companion art fallbacks for audio card backgrounds", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note.wav",
        storage_path: "user-1/generations/audio/voice-note.wav",
        file_type: "audio/wav",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note.wav",
        metadata: {
          companionArtUrl: "https://cdn.example.com/voice-note-metadata-cover.png",
        },
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);
    const audioShell = container.querySelector(".reference-card-audio-shell");

    expect(audioShell).not.toBeNull();
    expect(audioShell).toHaveStyle({
      backgroundImage: expect.stringContaining("voice-note-metadata-cover.png"),
    });
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

  it("renders provided signed poster urls through the adaptive preview resolver", async () => {
    const props = baseProps();
    props.mediaRows = [
      {
        ...props.mediaRows[0],
        poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
      },
    ];
    props.signedPosterUrlById = {
      "video-1": "https://cdn.example.com/signed/clip-1-poster.jpg",
    };

    render(<MediaLibraryAllItemsGrid {...props} />);

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
    const rowWithoutPoster = { ...props.mediaRows[0] } as Record<string, unknown>;
    delete rowWithoutPoster.poster_variant_path;
    delete rowWithoutPoster.thumb_variant_path;
    props.mediaRows = [rowWithoutPoster as (typeof props.mediaRows)[number]];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);

    const hoverVideo = container.querySelector("video");
    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo).toHaveAttribute("src", "https://cdn.example.com/clip-1.mp4");
    expect(hoverVideo).toHaveAttribute("preload", "auto");
    expect(screen.queryByAltText("clip-1.mp4")).toBeNull();

    const [cardButton] = screen.getAllByRole("button");
    fireEvent.pointerEnter(cardButton);
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    fireEvent.pointerLeave(cardButton);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("avoids auto-preloading posterless video previews under adaptive pressure", () => {
    const props = baseProps();
    const rowWithoutPoster = { ...props.mediaRows[0] } as Record<string, unknown>;
    delete rowWithoutPoster.poster_variant_path;
    delete rowWithoutPoster.thumb_variant_path;
    props.mediaRows = [rowWithoutPoster as (typeof props.mediaRows)[number]];
    props.adaptivePressureLevel = 1;

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);

    const hoverVideo = container.querySelector("video");
    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo).toHaveAttribute("preload", "metadata");
  });

  it("renders audio cards with playable controls in the mixed all-media feed", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/uploads/voice-note-1.mp3",
        preview_storage_path: "user-1/uploads/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note-1.mp3",
        metadata: null,
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);
    const audioNode = container.querySelector(".reference-card-audio");
    const waveformBars = container.querySelectorAll(".reference-card-audio-wavebar");

    expect(screen.getByRole("button", { name: "Play audio voice-note-1.mp3" })).toBeInTheDocument();
    expect(audioNode).toHaveAttribute("src", "https://cdn.example.com/voice-note-1.mp3");
    expect(container.querySelector("audio[controls]")).toBeNull();
    expect(waveformBars.length).toBeGreaterThan(10);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByAltText("voice-note-1.mp3")).toBeNull();
  });

  it("renders mixed-feed audio download and delete together in the hover action row", () => {
    const props = baseProps();
    props.showDeleteAction = true;
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/uploads/voice-note-1.mp3",
        preview_storage_path: "user-1/uploads/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note-1.mp3",
        metadata: null,
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);

    const downloadButton = screen.getByRole("button", {
      name: "Download media voice-note-1.mp3",
    });
    const deleteButton = screen.getByRole("button", {
      name: "Delete media voice-note-1.mp3",
    });
    const actionRow = downloadButton.parentElement;

    expect(actionRow).toHaveClass("media-library-panel-card-actions");
    expect(actionRow).toContainElement(deleteButton);
    expect(container.querySelector(".reference-card-audio-download")).toBeNull();

    fireEvent.click(downloadButton);

    expect(props.onDownloadMediaFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "audio-1" })
    );
    expect(props.onSelectMediaFile).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(props.onDeleteMediaFromLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ id: "audio-1" })
    );
  });

  it("marks signed audio URLs as loaded when the player becomes ready", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/uploads/voice-note-1.mp3",
        preview_storage_path: "user-1/uploads/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note-1.mp3",
        metadata: null,
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);
    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;

    expect(audioNode).not.toBeNull();
    fireEvent.loadedMetadata(audioNode as HTMLAudioElement);
    expect(props.onSignedUrlLoaded).toHaveBeenCalledWith("audio-1");
    expect(props.onMediaPaint).not.toHaveBeenCalled();
  });

  it("does not open the preview modal when the inline audio play control is double-clicked", () => {
    const props = baseProps();
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/uploads/voice-note-1.mp3",
        preview_storage_path: "user-1/uploads/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: "https://cdn.example.com/voice-note-1.mp3",
        metadata: null,
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Play audio voice-note-1.mp3" }));

    expect(props.onMediaDoubleClick).not.toHaveBeenCalled();
  });

  it("requests a missing signed audio URL and starts playback from one play click", async () => {
    const props = baseProps();
    props.onRequestSignedUrl = vi
      .fn()
      .mockResolvedValue("https://cdn.example.com/voice-note-1.mp3");
    props.mediaRows = [
      {
        id: "audio-1",
        filename: "voice-note-1.mp3",
        storage_path: "user-1/uploads/voice-note-1.mp3",
        preview_storage_path: "user-1/uploads/voice-note-1.mp3",
        file_type: "audio/mpeg",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: null,
        metadata: { durationMs: 15000, source_mode: "sound-effects" },
      },
    ];

    const { container } = render(<MediaLibraryAllItemsGrid {...props} />);

    const audioNode = container.querySelector(".reference-card-audio");

    expect(audioNode).not.toBeNull();
    expect(audioNode).not.toHaveAttribute("src");
    expect(
      screen.getByRole("button", { name: "Loading Play audio voice-note-1.mp3" })
    ).toBeDisabled();
    expect(screen.getByText("0:15")).toBeInTheDocument();
    expect(container.querySelector('[data-media-duration-kind="sound-effects"]')).not.toBeNull();

    await waitFor(() => {
      expect(props.onRequestSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "audio-1" })
      );
    });
    await waitFor(() => {
      expect(audioNode).toHaveAttribute("src", "https://cdn.example.com/voice-note-1.mp3");
    });
    vi.mocked(props.onRequestSignedUrl).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Play audio voice-note-1.mp3" }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    expect(props.onRequestSignedUrl).not.toHaveBeenCalled();
    expect(audioNode).toHaveAttribute("src", "https://cdn.example.com/voice-note-1.mp3");
  });

  it("requests a signed preview when a mixed-feed image card would otherwise mount blank", async () => {
    const props = baseProps();
    props.onRequestSignedUrl = vi.fn().mockResolvedValue("https://cdn.example.com/image-1.png");
    props.mediaRows = [
      {
        id: "image-1",
        filename: "image-1.png",
        storage_path: "user-1/uploads/image-1.png",
        preview_storage_path: "user-1/uploads/image-1.png",
        file_type: "image/png",
        created_at: "2026-04-08T18:00:00.000Z",
        signedUrl: null,
      },
    ];

    render(<MediaLibraryAllItemsGrid {...props} />);

    await waitFor(() => {
      expect(props.onRequestSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "image-1" })
      );
    });
  });
});
