import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
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

  it("applies direct preview_variant hover urls locally without batch signing", async () => {
    const { result } = renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [
          makeVideoRow({
            signedUrl: null,
            preview_variant_path: "https://cdn.example.com/clip-1-hover.mp4",
          }),
        ],
        currentUserId: "user-1",
      })
    );

    await waitFor(() =>
      expect(result.current.signedVideoUrlById).toEqual({
        "video-1": "https://cdn.example.com/clip-1-hover.mp4",
      })
    );

    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("signs preview_variant storage paths instead of treating them as direct hover urls", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/video-1/preview_loop_360p.mp4",
          "https://cdn.example.com/signed/clip-1-hover.mp4",
        ],
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
            signedUrl: null,
            preview_variant_path: "user-1/variants/videos/video-1/preview_loop_360p.mp4",
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
          storagePaths: expect.arrayContaining([
            "user-1/variants/videos/video-1/preview_loop_360p.mp4",
            "user-1/variants/videos/video-1/poster_720.jpg",
          ]),
          surface: "media-library-panel",
        })
      )
    );

    await waitFor(() =>
      expect(result.current.signedVideoUrlById).toEqual({
        "video-1": "https://cdn.example.com/signed/clip-1-hover.mp4",
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

  it("skips hover signing when a direct preview_variant hover url already exists", async () => {
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
            signedUrl: null,
            preview_variant_path: "https://cdn.example.com/clip-1-hover.mp4",
            poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
          }),
        ],
        currentUserId: "user-1",
      })
    );

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePaths: ["user-1/variants/videos/video-1/poster_720.jpg"],
        })
      )
    );

    await waitFor(() =>
      expect(result.current.signedVideoUrlById).toEqual({
        "video-1": "https://cdn.example.com/clip-1-hover.mp4",
      })
    );
  });

  it("limits panel video signing to visible rows when visible ids are provided", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/video-1/poster_720.jpg",
          "https://cdn.example.com/signed/clip-1-poster.jpg",
        ],
      ])
    );
    const visibleMediaIdsRef = {
      current: new Set<string>(["video-1"]),
    } as React.MutableRefObject<Set<string>>;

    renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [
          makeVideoRow({
            signedUrl: null,
            poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
          }),
          makeVideoRow({
            id: "video-2",
            filename: "clip-2.mp4",
            storage_path: "user-1/uploads/clip-2.mp4",
            preview_storage_path: "user-1/uploads/clip-2.mp4",
            signedUrl: null,
            poster_variant_path: "user-1/variants/videos/video-2/poster_720.jpg",
          }),
        ],
        currentUserId: "user-1",
        surface: "media-library-panel",
        visibleMediaIdsRef,
      })
    );

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePaths: expect.arrayContaining([
            "user-1/uploads/clip-1.mp4",
            "user-1/variants/videos/video-1/poster_720.jpg",
          ]),
          surface: "media-library-panel",
        })
      )
    );
    const panelStoragePaths =
      getSignedMediaUrlsBatchMock.mock.calls.at(-1)?.[0]?.storagePaths ?? [];
    expect(panelStoragePaths).not.toContain("user-1/uploads/clip-2.mp4");
    expect(panelStoragePaths).not.toContain("user-1/variants/videos/video-2/poster_720.jpg");
  });

  it("keeps modal video signing unchanged when visible ids are provided", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/video-1/poster_720.jpg",
          "https://cdn.example.com/signed/clip-1-poster.jpg",
        ],
        [
          "user-1/variants/videos/video-2/poster_720.jpg",
          "https://cdn.example.com/signed/clip-2-poster.jpg",
        ],
      ])
    );
    const visibleMediaIdsRef = {
      current: new Set<string>(["video-1"]),
    } as React.MutableRefObject<Set<string>>;

    renderHook(() =>
      useMediaVideoBrowsePreviewUrls({
        mediaRows: [
          makeVideoRow({
            signedUrl: null,
            poster_variant_path: "user-1/variants/videos/video-1/poster_720.jpg",
          }),
          makeVideoRow({
            id: "video-2",
            filename: "clip-2.mp4",
            storage_path: "user-1/uploads/clip-2.mp4",
            preview_storage_path: "user-1/uploads/clip-2.mp4",
            signedUrl: null,
            poster_variant_path: "user-1/variants/videos/video-2/poster_720.jpg",
          }),
        ],
        currentUserId: "user-1",
        surface: "media-library-modal",
        visibleMediaIdsRef,
      })
    );

    await waitFor(() =>
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePaths: expect.arrayContaining([
            "user-1/uploads/clip-1.mp4",
            "user-1/variants/videos/video-1/poster_720.jpg",
            "user-1/uploads/clip-2.mp4",
            "user-1/variants/videos/video-2/poster_720.jpg",
          ]),
          surface: "media-library-modal",
        })
      )
    );
  });
});
