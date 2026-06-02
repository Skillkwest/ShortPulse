import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaLibraryPanelSelectionController } from "../useMediaLibraryPanelSelectionController";

const resolveSignedSelectionUrlMock = vi.fn();

vi.mock("../../../media-library/logic/mediaPreviewResolver", () => ({
  resolveSignedSelectionUrl: (...args: unknown[]) => resolveSignedSelectionUrlMock(...args),
}));

describe("useMediaLibraryPanelSelectionController", () => {
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
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath,
      })
    );

    const file = {
      id: "file-1",
      filename: "first.png",
      file_type: "image/png",
      storage_path: "user-1/media/original.png",
      preview_storage_path: "user-1/media/variants/thumb.png",
      signedUrl: "https://signed.example.com/preview.png",
      metadata: null,
      source: "upload",
    };

    act(() => {
      result.current.handleMediaCardDoubleClick(file);
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

  it("records an error when preview modal resolution fails", async () => {
    resolveSignedSelectionUrlMock.mockReset();
    resolveSignedSelectionUrlMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        detailSurface: "media-library-panel",
        currentUserIdRef: { current: "user-1" },
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
});
