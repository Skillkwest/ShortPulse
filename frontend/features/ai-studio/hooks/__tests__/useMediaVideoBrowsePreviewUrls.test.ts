import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { useMediaVideoBrowsePreviewUrls } from "../useMediaVideoBrowsePreviewUrls";

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

describe("useMediaVideoBrowsePreviewUrls", () => {
  const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  const makeVideoRow = (overrides: Record<string, unknown> = {}) => ({
    id: "video-1",
    filename: "clip-1.mp4",
    storage_path: "user-1/uploads/clip-1.mp4",
    preview_storage_path: "user-1/uploads/clip-1.mp4",
    file_type: "video/mp4",
    created_at: "2026-04-08T18:00:00.000Z",
    signedUrl: "https://cdn.example.com/clip-1.mp4",
    poster_variant_path: "https://cdn.example.com/clip-1-poster.jpg",
    ...overrides,
  });

  it("skips batch signing when a row already has signed hover and poster previews", async () => {
    const { result } = renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [makeVideoRow()],
        currentUserId: "user-1",
      })
    );

    await waitFor(() => {
      expect(result.current.signedPosterUrlById).toEqual({});
    });

    expect(result.current.signedVideoUrlById).toEqual({});
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("signs hover video paths when the row only has a poster image preview", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user-1/uploads/clip-1.mp4", "https://cdn.example.com/signed/clip-1.mp4"]])
    );

    const { result } = renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [makeVideoRow({ signedUrl: "https://cdn.example.com/clip-1-poster.jpg" })],
        currentUserId: "user-1",
      })
    );

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: "media_library",
          storagePaths: ["user-1/uploads/clip-1.mp4"],
          surface: "media-library-panel",
        })
      )
    );

    await waitFor(() =>
      expect(result.current.signedVideoUrlById).toEqual({
        "video-1": "https://cdn.example.com/signed/clip-1.mp4",
      })
    );
  });

  it("signs poster storage paths when no renderable poster url exists yet", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/video-1/poster_720.jpg",
          "https://cdn.example.com/signed/clip-1-poster.jpg",
        ],
      ])
    );

    const { result } = renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [
          makeVideoRow({
            poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
          }),
        ],
        currentUserId: "user-1",
      })
    );

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: "media_library",
          storagePaths: ["user-1/variants/videos/video-1/poster_720.jpg"],
          surface: "media-library-panel",
        })
      )
    );

    await waitFor(() =>
      expect(result.current.signedPosterUrlById).toEqual({
        "video-1": "https://cdn.example.com/signed/clip-1-poster.jpg",
      })
    );
  });
});
