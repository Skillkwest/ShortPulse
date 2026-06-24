import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMediaLibraryPanelRuntime } from "../useMediaLibraryPanelRuntime";

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

describe("useMediaLibraryPanelRuntime", () => {
  it("normalizes panel media rows while preserving item-type filtering", () => {
    type PanelItemType = "all" | "images" | "videos" | "audio" | "prompts";
    const { result, rerender } = renderHook(
      ({ itemType }: { itemType: PanelItemType }) => useMediaLibraryPanelRuntime({ itemType }),
      {
        initialProps: { itemType: "all" as PanelItemType },
      }
    );

    act(() => {
      result.current.setMediaRows([
        makeMediaRow("image-1", {
          file_type: "image/png",
          created_at: "2026-03-29T00:00:00.000Z",
        }),
        makeMediaRow("private-video", {
          filename: "private-video.mp4",
          storage_path: "user-1/private/private-video.mp4",
          file_type: "video/mp4",
          created_at: "2026-03-28T00:00:00.000Z",
        }),
        makeMediaRow("ai-image", {
          filename: "ai-image.png",
          source: "ai_studio",
          file_type: "image/png",
          created_at: "2026-03-27T00:00:00.000Z",
        }),
        makeMediaRow("audio-1", {
          filename: "audio-1.mp3",
          storage_path: "user-1/uploads/audio-1.mp3",
          file_type: "audio/mpeg",
          created_at: "2026-03-26T00:00:00.000Z",
        }),
      ]);
    });

    expect(result.current.mediaRows.map((row) => row.id)).toEqual([
      "image-1",
      "private-video",
      "ai-image",
      "audio-1",
    ]);

    rerender({ itemType: "images" });
    expect(result.current.mediaRows.map((row) => row.id)).toEqual(["image-1", "ai-image"]);

    rerender({ itemType: "videos" });
    expect(result.current.mediaRows.map((row) => row.id)).toEqual(["private-video"]);

    rerender({ itemType: "audio" });
    expect(result.current.mediaRows.map((row) => row.id)).toEqual(["audio-1"]);
  });

  it("preserves panel media row order instead of re-sorting on read", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "all" }));

    act(() => {
      result.current.setMediaRows([
        makeMediaRow("older-video", {
          file_type: "video/mp4",
          created_at: "2026-03-20T00:00:00.000Z",
        }),
        makeMediaRow("newer-image", {
          file_type: "image/png",
          created_at: "2026-03-29T00:00:00.000Z",
        }),
      ]);
    });

    expect(result.current.mediaRows.map((row) => row.id)).toEqual(["older-video", "newer-image"]);
    expect(result.current.runtimeState.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual([
      "older-video",
      "newer-image",
    ]);
  });

  it("appends panel media rows through the runtime without duplicating existing rows", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "all" }));

    act(() => {
      result.current.setMediaRows([makeMediaRow("image-1")]);
    });

    act(() => {
      result.current.appendMediaRows([
        makeMediaRow("video-1", {
          filename: "video-1.mp4",
          storage_path: "user-1/uploads/video-1.mp4",
          file_type: "video/mp4",
        }),
        makeMediaRow("image-1", {
          filename: "image-1-updated.png",
        }),
      ]);
    });

    expect(result.current.mediaRows.map((row) => row.id)).toEqual(["image-1", "video-1"]);
    expect(result.current.mediaRows[0]?.filename).toBe("image-1-updated.png");
    expect(result.current.runtimeState.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual([
      "image-1",
      "video-1",
    ]);
    expect(
      result.current.runtimeState.surfaceStateByKind.panel.orderedViews.mediaIdsByTab
        .uploaded_videos
    ).toEqual(["video-1"]);
  });

  it("stores panel prompt rows in the shared runtime surface", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "prompts" }));

    act(() => {
      result.current.setPromptRows([makePromptRow("prompt-1"), makePromptRow("prompt-2")]);
    });

    expect(result.current.promptRows.map((row) => row.id)).toEqual(["prompt-1", "prompt-2"]);
    expect(result.current.runtimeState.surfaceStateByKind.panel.orderedViews.promptIds).toEqual([
      "prompt-1",
      "prompt-2",
    ]);
  });

  it("treats identical panel prompt rows as a runtime no-op", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "prompts" }));

    act(() => {
      result.current.setPromptRows([makePromptRow("prompt-1")]);
    });

    const previousRuntimeState = result.current.runtimeState;

    act(() => {
      result.current.setPromptRows([
        {
          ...makePromptRow("prompt-1"),
        },
      ]);
    });

    expect(result.current.runtimeState).toBe(previousRuntimeState);
  });

  it("keeps panel mediaRows stable when only prompt rows change", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "all" }));

    act(() => {
      result.current.setMediaRows([makeMediaRow("image-1")]);
    });

    const previousMediaRows = result.current.mediaRows;

    act(() => {
      result.current.setPromptRows([makePromptRow("prompt-1")]);
    });

    expect(result.current.mediaRows).toBe(previousMediaRows);
  });

  it("keeps panel promptRows stable when only media rows change", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "prompts" }));

    act(() => {
      result.current.setPromptRows([makePromptRow("prompt-1")]);
    });

    const previousPromptRows = result.current.promptRows;

    act(() => {
      result.current.setMediaRows([makeMediaRow("image-1")]);
    });

    expect(result.current.promptRows).toBe(previousPromptRows);
  });

  it("stores panel scope cache and signed preview state in the shared runtime surface", () => {
    const { result } = renderHook(() => useMediaLibraryPanelRuntime({ itemType: "all" }));

    act(() => {
      result.current.setMediaRows([makeMediaRow("image-1")]);
      result.current.setMediaScopeCache((prev) => ({
        ...prev,
        hasMore: true,
        loading: true,
        resolvedScopeKey: "folder-a|all|woman",
        libraryTotalCount: 654,
      }));
      result.current.setSignedUrls(new Map([["image-1", "https://signed.test/image-1.png"]]));
      result.current.setError("Unable to load media.");
    });

    expect(result.current.mediaScopeCache).toMatchObject({
      hasMore: true,
      loading: true,
      resolvedScopeKey: "folder-a|all|woman",
      libraryTotalCount: 654,
    });
    expect(result.current.mediaRows[0]?.signedUrl).toBe("https://signed.test/image-1.png");
    expect(result.current.error).toBe("Unable to load media.");
  });
});
