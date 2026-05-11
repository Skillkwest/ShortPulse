import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMediaLibraryRouteRuntime } from "../useMediaLibraryRouteRuntime";

const makeMediaRow = (
  id: string,
  overrides: Partial<{
    filename: string;
    storage_path: string;
    file_type: string;
    source: string | null;
    created_at: string | null;
    signedUrl: string | null;
  }> = {}
) => ({
  id,
  filename: overrides.filename ?? `${id}.png`,
  storage_path: overrides.storage_path ?? `user-1/uploads/${id}.png`,
  file_type: overrides.file_type ?? "image/png",
  source: overrides.source ?? "upload",
  created_at: overrides.created_at ?? "2026-03-28T00:00:00.000Z",
  signedUrl: overrides.signedUrl ?? null,
});

const makePromptRow = (id: string) => ({
  id,
  title: `Prompt ${id}`,
  prompt_text: `Prompt text ${id}`,
  created_at: "2026-03-28T00:00:00.000Z",
});

describe("useMediaLibraryRouteRuntime", () => {
  it("stores route media-tab cache data across all tabs in one runtime surface", () => {
    const { result } = renderHook(() =>
      useMediaLibraryRouteRuntime({
        activeMediaTab: "uploaded_images",
      })
    );

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_images: {
          ...prev.uploaded_images,
          rows: [makeMediaRow("image-1")],
          pagesLoaded: 2,
          hasMore: true,
        },
        uploaded_videos: {
          ...prev.uploaded_videos,
          rows: [makeMediaRow("video-1", { file_type: "video/mp4" })],
          pagesLoaded: 1,
          hasMore: false,
        },
      }));
    });

    expect(result.current.mediaTabCache.uploaded_images.rows.map((row) => row.id)).toEqual([
      "image-1",
    ]);
    expect(result.current.mediaTabCache.uploaded_images.pagesLoaded).toBe(2);
    expect(result.current.mediaTabCache.uploaded_images.hasMore).toBe(true);
    expect(result.current.mediaTabCache.uploaded_videos.rows.map((row) => row.id)).toEqual([
      "video-1",
    ]);
    expect(result.current.files.map((row) => row.id)).toEqual(["image-1"]);
  });

  it("treats semantically identical route media-tab cache updates as a runtime no-op", () => {
    const { result } = renderHook(() =>
      useMediaLibraryRouteRuntime({
        activeMediaTab: "uploaded_images",
      })
    );

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_images: {
          ...prev.uploaded_images,
          rows: [makeMediaRow("image-1")],
          pagesLoaded: 1,
        },
      }));
    });

    const previousRuntimeState = result.current.runtimeState;

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_images: {
          ...prev.uploaded_images,
          rows: [
            {
              ...makeMediaRow("image-1"),
            },
          ],
          pagesLoaded: 1,
        },
      }));
    });

    expect(result.current.runtimeState).toBe(previousRuntimeState);
  });

  it("keeps route prompts stable when only media-tab cache changes", () => {
    const { result } = renderHook(() =>
      useMediaLibraryRouteRuntime({
        activeMediaTab: "uploaded_images",
      })
    );

    act(() => {
      result.current.setPrompts([makePromptRow("prompt-1")]);
    });

    const previousPrompts = result.current.prompts;

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_images: {
          ...prev.uploaded_images,
          rows: [makeMediaRow("image-1")],
        },
      }));
    });

    expect(result.current.prompts).toBe(previousPrompts);
  });

  it("keeps active route media cache content stable when only a different tab changes", () => {
    const { result } = renderHook(() =>
      useMediaLibraryRouteRuntime({
        activeMediaTab: "uploaded_images",
      })
    );

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_images: {
          ...prev.uploaded_images,
          rows: [makeMediaRow("image-1")],
        },
      }));
    });

    const previousActiveMediaCache = result.current.activeMediaCache;
    const previousFiles = result.current.files;

    act(() => {
      result.current.setMediaTabCache((prev) => ({
        ...prev,
        uploaded_videos: {
          ...prev.uploaded_videos,
          rows: [makeMediaRow("video-1", { file_type: "video/mp4" })],
        },
      }));
    });

    expect(result.current.activeMediaCache).toStrictEqual(previousActiveMediaCache);
    expect(result.current.files).toStrictEqual(previousFiles);
  });
});
