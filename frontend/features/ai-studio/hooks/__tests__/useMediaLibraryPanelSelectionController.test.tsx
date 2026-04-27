import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaLibraryPanelSelectionController } from "../useMediaLibraryPanelSelectionController";

const resolveSignedSelectionUrlMock = vi.fn();

vi.mock("../../../media-library/logic/mediaPreviewResolver", () => ({
  resolveSignedSelectionUrl: (...args: unknown[]) => resolveSignedSelectionUrlMock(...args),
}));

describe("useMediaLibraryPanelSelectionController", () => {
  it("uses the resolved selection URL for preview modal state", async () => {
    resolveSignedSelectionUrlMock.mockResolvedValueOnce("https://signed.example.com/full.png");

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
        currentUserIdRef: { current: "user-1" },
        onSelectMedia: vi.fn(),
        refreshSignedUrl: vi.fn(async () => "https://signed.example.com/fallback.png"),
        signStoragePath: vi.fn(async () => null),
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

    expect(result.current.previewModalFile?.id).toBe("file-1");
    expect(result.current.previewModalUrl).toBe("https://signed.example.com/preview.png");
    expect(result.current.previewModalLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.previewModalUrl).toBe("https://signed.example.com/full.png");
      expect(result.current.previewModalLoading).toBe(false);
    });
  });

  it("records an error when preview modal resolution fails", async () => {
    resolveSignedSelectionUrlMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useMediaLibraryPanelSelectionController({
        activeFolderId: "all_items",
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
        signedUrl: "https://signed.example.com/preview.png",
        metadata: null,
        source: "upload",
      });
    });

    await waitFor(() => {
      expect(result.current.previewModalError).toBe("Failed to load preview.");
      expect(result.current.previewModalLoading).toBe(false);
    });
  });
});
