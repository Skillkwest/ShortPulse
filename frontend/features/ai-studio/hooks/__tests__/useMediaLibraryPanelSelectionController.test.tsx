import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaLibraryPanelSelectionController } from "../useMediaLibraryPanelSelectionController";

const resolveSignedSelectionUrlMock = vi.fn();

vi.mock("../../../media-library/logic/mediaPreviewResolver", () => ({
  resolveSignedSelectionUrl: (...args: unknown[]) => resolveSignedSelectionUrlMock(...args),
}));

describe("useMediaLibraryPanelSelectionController", () => {
  const imageFile = {
    id: "file-1",
    filename: "first.png",
    file_type: "image/png",
    storage_path: "user-1/media/original.png",
    preview_storage_path: "user-1/media/variants/thumb.png",
    signedUrl: "https://signed.example.com/preview.png",
    metadata: null,
    source: "upload",
  };

  it("opens on the current preview url and promotes to the signed original url when available", async () => {
    resolveSignedSelectionUrlMock.mockResolvedValueOnce("https://signed.example.com/fallback.png");
    const signStoragePath = vi.fn(async (storagePath: string) =>
      storagePath === "user-1/media/original.png" ? "https://signed.example.com/full.png" : null
    );

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath,
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick(imageFile);
    });

    expect(result.current.detailModalItem?.file.id).toBe("file-1");
    expect(result.current.detailModalItem?.selectionTarget.surface).toBe("media-library-panel");
    expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/preview.png");
    expect(result.current.detailModalLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/full.png");
      expect(result.current.detailModalLoading).toBe(false);
    });
    expect(signStoragePath).toHaveBeenCalledWith("user-1/media/original.png", {
      forceRefresh: true,
    });
  });

  it("opens custom-folder media cards through the same preview modal path", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    resolveSignedSelectionUrlMock.mockResolvedValueOnce("https://signed.example.com/fallback.png");
    const signStoragePath = vi.fn(async (storagePath: string) =>
      storagePath === "user-1/media/original.png" ? "https://signed.example.com/full.png" : null
    );

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "folder-1",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath,
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick(imageFile);
    });

    expect(result.current.detailModalItem?.file.id).toBe("file-1");
    expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/preview.png");

    await waitFor(() => {
      expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/full.png");
      expect(result.current.detailModalLoading).toBe(false);
    });
  });

  it("does not mount poster image URLs as video modal sources", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    const videoFile = {
      id: "video-1",
      filename: "clip.mp4",
      file_type: "video/mp4",
      storage_path: "user-1/media/clip.mp4",
      preview_storage_path: "user-1/media/clip-preview.mp4",
      poster_variant_path: "user-1/media/clip-poster.jpg",
      signedUrl: "https://signed.example.com/clip-poster.jpg",
      metadata: null,
      source: "upload",
    };
    resolveSignedSelectionUrlMock.mockResolvedValueOnce(
      "https://signed.example.com/clip-poster.jpg"
    );
    const signStoragePath = vi.fn(async (storagePath: string) =>
      storagePath === "user-1/media/clip.mp4" ? "https://signed.example.com/clip.mp4" : null
    );

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [videoFile],
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => null),
        signStoragePath,
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick(videoFile);
    });

    expect(result.current.detailModalItem?.url).toBe("");
    expect(result.current.detailModalItem?.media.url).toBe("");
    expect(result.current.detailModalLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/clip.mp4");
      expect(result.current.detailModalItem?.media.url).toBe("https://signed.example.com/clip.mp4");
      expect(result.current.detailModalItem?.media.previewPosterUrl).toBe(
        "https://signed.example.com/clip-poster.jpg"
      );
      expect(result.current.detailModalLoading).toBe(false);
    });
  });

  it("preserves audio companion art and duration when selecting a media-library audio row", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    resolveSignedSelectionUrlMock.mockResolvedValueOnce("https://signed.example.com/audio.mp3");
    const onSelectMedia = vi.fn();
    const audioFile = {
      id: "audio-1",
      filename: "theme.mp3",
      file_type: "audio/mpeg",
      storage_path: "user-1/media/theme.mp3",
      preview_storage_path: "user-1/media/theme.mp3",
      signedUrl: null,
      metadata: {
        companionArtUrl: "https://signed.example.com/theme-cover.webp",
        duration_ms: 0,
        resolved_duration_seconds: 8,
      },
      companion_art_storage_path: "user-1/media/theme-cover.webp",
      source: "ai_studio",
      source_ref: "generation-1",
    };

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [audioFile],
        onSelectMedia,
        refreshSignedUrl: vi.fn(async () => null),
        signStoragePath: vi.fn(async () => null),
      })
    );

    await act(async () => {
      await result.current.handleSelectMediaFile(audioFile);
    });

    expect(onSelectMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "audio-1",
        url: "https://signed.example.com/audio.mp3",
        fileType: "audio",
        companionArtUrl: "https://signed.example.com/theme-cover.webp",
        companionArtStoragePath: "user-1/media/theme-cover.webp",
        durationMs: 8_000,
      })
    );
  });

  it("records an error when preview modal resolution fails", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    resolveSignedSelectionUrlMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [],
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => null),
        signStoragePath: vi.fn(async () => null),
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick({
        id: "file-1",
        filename: "first.png",
        file_type: "image/png",
        storage_path: "user-1/media/original.png",
        signedUrl: null,
        metadata: null,
        source: "upload",
      });
    });

    await waitFor(() => {
      expect(result.current.detailModalError).toBe("Failed to load preview.");
      expect(result.current.detailModalLoading).toBe(false);
    });
  });

  it("opens through a controlled shared detail-selection target when a matching row is available", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    const signStoragePath = vi.fn(async (storagePath: string) =>
      storagePath === "user-1/media/original.png" ? "https://signed.example.com/full.png" : null
    );
    const setDetailSelectionTarget = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        detailSelectionTarget: {
          kind: "media-file",
          fileId: imageFile.id,
          surface: "media-library-panel",
        },
        setDetailSelectionTarget,
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath,
      })
    );

    await waitFor(() => {
      expect(result.current.detailModalItem?.file.id).toBe(imageFile.id);
      expect(result.current.detailModalLoading).toBe(false);
      expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/full.png");
    });

    act(() => {
      result.current.closeDetailModal();
    });

    expect(setDetailSelectionTarget).toHaveBeenCalledWith(null);
  });

  it("opens a controlled shared detail-selection target for custom-folder media rows", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    const signStoragePath = vi.fn(async (storagePath: string) =>
      storagePath === "user-1/media/original.png" ? "https://signed.example.com/full.png" : null
    );
    const setDetailSelectionTarget = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "folder-1",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        detailSelectionTarget: {
          kind: "media-file",
          fileId: imageFile.id,
          surface: "media-library-panel",
        },
        setDetailSelectionTarget,
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath,
      })
    );

    await waitFor(() => {
      expect(result.current.detailModalItem?.file.id).toBe(imageFile.id);
      expect(result.current.detailModalLoading).toBe(false);
      expect(result.current.detailModalItem?.url).toBe("https://signed.example.com/full.png");
    });
  });

  it("publishes a shared detail-selection target instead of opening local state when externally controlled", () => {
    const setDetailSelectionTarget = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        detailSelectionTarget: null,
        setDetailSelectionTarget,
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath: vi.fn(async () => null),
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick(imageFile);
    });

    expect(setDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "media-file",
      fileId: imageFile.id,
      surface: "media-library-panel",
    });
    expect(result.current.detailModalItem).toBeNull();
  });

  it("publishes a shared detail-selection target from custom-folder media cards", () => {
    const setDetailSelectionTarget = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "folder-1",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
        mediaRows: [imageFile],
        detailSelectionTarget: null,
        setDetailSelectionTarget,
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath: vi.fn(async () => null),
      })
    );

    act(() => {
      result.current.handleMediaCardDoubleClick(imageFile);
    });

    expect(setDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "media-file",
      fileId: imageFile.id,
      surface: "media-library-panel",
    });
    expect(result.current.detailModalItem).toBeNull();
  });
});
