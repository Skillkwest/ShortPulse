import { describe, expect, it } from "vitest";
import {
  applyMediaSignedUrls,
  appendSurfaceMediaRows,
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaRowsByTabs,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
  selectSurfaceAggregateMediaRows,
  selectSurfaceMediaTabCacheRecord,
  selectSurfaceMediaRows,
  selectSurfacePromptRows,
  selectSurfaceSelectedIds,
  selectTotalCachedMediaBytes,
  setSurfaceAspectRatio,
  setSurfaceSelectedIds,
  setSurfaceSignedUrls,
} from "../store";

const makeMediaRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  filename: `${id}.png`,
  storage_path: `user/uploads/${id}.png`,
  file_type: "image",
  created_at: "2026-03-28T00:00:00.000Z",
  file_size: 128,
  ...overrides,
});

const makePromptRow = (id: string) => ({
  id,
  title: `Prompt ${id}`,
  prompt_text: `Prompt text ${id}`,
  created_at: "2026-03-28T00:00:00.000Z",
});

describe("media runtime store", () => {
  it("normalizes shared media rows while keeping per-surface ordering separate", () => {
    const shared = makeMediaRow("shared");
    const panelOnly = makeMediaRow("panel-only");
    const modalOnly = makeMediaRow("modal-only");

    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "panel",
      tab: "uploaded_images",
      rows: [shared, panelOnly],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [modalOnly, shared],
    });

    expect(Object.keys(state.mediaById).sort()).toEqual(["modal-only", "panel-only", "shared"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_images" }).map(
        (row) => row.id
      )
    ).toEqual(["shared", "panel-only"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "modal", tab: "uploaded_images" }).map(
        (row) => row.id
      )
    ).toEqual(["modal-only", "shared"]);
  });

  it("applies signed urls once and exposes them through every surface view", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "panel",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });

    state = applyMediaSignedUrls(state, new Map([["shared", "https://signed/shared.png"]]));

    expect(state.mediaById.shared?.signedUrl).toBe("https://signed/shared.png");
    expect(
      selectSurfaceMediaRows(state, { surface: "modal", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/shared.png");
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/shared.png");
  });

  it("can update preview signed urls for a single surface without mutating shared entities", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "panel",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });

    state = setSurfaceSignedUrls(state, {
      surface: "panel",
      signedUrlById: new Map([["shared", "https://signed/panel.png"]]),
    });

    expect(state.mediaById.shared?.signedUrl).toBeUndefined();
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/panel.png");
    expect(
      selectSurfaceMediaRows(state, { surface: "modal", tab: "uploaded_images" })[0]?.signedUrl
    ).toBeUndefined();
  });

  it("treats semantically identical ordered media rows and cache state as a no-op", () => {
    const initialRow = makeMediaRow("shared", {
      signedUrl: "https://signed/shared.png",
      preview_storage_path: "user/uploads/shared.png",
    });

    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [initialRow],
      cache: {
        loaded: true,
        loading: false,
        pagesLoaded: 1,
        query: "",
      },
    });

    const nextState = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [
        {
          ...initialRow,
        },
      ],
      cache: {
        loaded: true,
        loading: false,
        pagesLoaded: 1,
        query: "",
      },
    });

    expect(nextState).toBe(state);
  });

  it("reconstructs surface media-tab cache records from normalized rows and tab metadata", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [makeMediaRow("image-1")],
      cache: {
        loaded: true,
        loading: false,
        pagesLoaded: 2,
        query: "portrait",
        hasMore: true,
      },
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_videos",
      rows: [makeMediaRow("video-1", { file_type: "video/mp4" })],
      cache: {
        loaded: true,
        loading: false,
        pagesLoaded: 1,
        query: "",
        hasMore: false,
      },
    });

    const modalCache = selectSurfaceMediaTabCacheRecord(state, "modal");

    expect(modalCache.uploaded_images.rows.map((row) => row.id)).toEqual(["image-1"]);
    expect(modalCache.uploaded_images.pagesLoaded).toBe(2);
    expect(modalCache.uploaded_images.query).toBe("portrait");
    expect(modalCache.uploaded_images.hasMore).toBe(true);
    expect(modalCache.uploaded_videos.rows.map((row) => row.id)).toEqual(["video-1"]);
    expect(modalCache.uploaded_videos.pagesLoaded).toBe(1);
    expect(modalCache.private.rows).toEqual([]);
    expect(modalCache.ai_generations.rows).toEqual([]);
  });

  it("replaces multiple surface media tabs in one batched write", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaRowsByTabs(state, {
      surface: "panel",
      rowsByTab: {
        uploaded_images: [makeMediaRow("image-1")],
        uploaded_videos: [makeMediaRow("video-1", { file_type: "video/mp4" })],
        private: [makeMediaRow("private-1", { storage_path: "user/private/private-1.png" })],
        ai_generations: [makeMediaRow("ai-1", { source: "ai_studio" })],
      },
      cacheByTab: {
        uploaded_images: { loaded: true, pagesLoaded: 1 },
        uploaded_videos: { loaded: true, pagesLoaded: 1 },
      },
    });

    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_images" }).map(
        (row) => row.id
      )
    ).toEqual(["image-1"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_videos" }).map(
        (row) => row.id
      )
    ).toEqual(["video-1"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "private" }).map((row) => row.id)
    ).toEqual(["private-1"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "ai_generations" }).map(
        (row) => row.id
      )
    ).toEqual(["ai-1"]);
    expect(state.surfaceStateByKind.panel.cacheByTab.uploaded_images.pagesLoaded).toBe(1);
    expect(state.surfaceStateByKind.panel.cacheByTab.uploaded_videos.pagesLoaded).toBe(1);
  });

  it("preserves aggregate media order for mixed-tab panel rows", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaRowsByTabs(state, {
      surface: "panel",
      mediaIds: ["video-1", "image-1", "ai-1"],
      rowsByTab: {
        uploaded_images: [makeMediaRow("image-1")],
        uploaded_videos: [makeMediaRow("video-1", { file_type: "video/mp4" })],
        private: [],
        ai_generations: [makeMediaRow("ai-1", { source: "ai_studio" })],
      },
    });

    expect(state.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual([
      "video-1",
      "image-1",
      "ai-1",
    ]);
    expect(selectSurfaceAggregateMediaRows(state, "panel").map((row) => row.id)).toEqual([
      "video-1",
      "image-1",
      "ai-1",
    ]);
  });

  it("dedupes aggregate media ids during panel row replacement", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaRowsByTabs(state, {
      surface: "panel",
      mediaIds: ["image-1", "image-1", "video-1", "video-1"],
      rowsByTab: {
        uploaded_images: [
          makeMediaRow("image-1", { filename: "image-1-stale.png" }),
          makeMediaRow("image-1", { filename: "image-1-fresh.png" }),
        ],
        uploaded_videos: [
          makeMediaRow("video-1", {
            file_type: "video/mp4",
            filename: "video-1-stale.mp4",
          }),
          makeMediaRow("video-1", {
            file_type: "video/mp4",
            filename: "video-1-fresh.mp4",
          }),
        ],
        private: [],
        ai_generations: [],
      },
    });

    expect(state.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual(["image-1", "video-1"]);
    expect(state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_images).toEqual([
      "image-1",
    ]);
    expect(state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_videos).toEqual([
      "video-1",
    ]);
    expect(selectSurfaceAggregateMediaRows(state, "panel").map((row) => row.id)).toEqual([
      "image-1",
      "video-1",
    ]);
    expect(selectSurfaceAggregateMediaRows(state, "panel")[0]?.filename).toBe("image-1-fresh.png");
    expect(selectSurfaceAggregateMediaRows(state, "panel")[1]?.filename).toBe("video-1-fresh.mp4");
  });

  it("appends panel media rows without rebuilding unrelated tab order", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaRowsByTabs(state, {
      surface: "panel",
      mediaIds: ["image-1"],
      rowsByTab: {
        uploaded_images: [makeMediaRow("image-1")],
        uploaded_videos: [],
        private: [],
        ai_generations: [],
      },
    });

    const previousImageIds =
      state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_images;
    state = appendSurfaceMediaRows(state, {
      surface: "panel",
      rows: [makeMediaRow("video-1", { file_type: "video/mp4" })],
    });

    expect(state.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual(["image-1", "video-1"]);
    expect(state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_images).toBe(
      previousImageIds
    );
    expect(state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_videos).toEqual([
      "video-1",
    ]);
    expect(selectSurfaceAggregateMediaRows(state, "panel").map((row) => row.id)).toEqual([
      "image-1",
      "video-1",
    ]);
  });

  it("updates appended duplicate rows in place without duplicating aggregate order", () => {
    let state = createMediaLibraryRuntimeState();
    state = appendSurfaceMediaRows(state, {
      surface: "panel",
      rows: [makeMediaRow("audio-1", { file_type: "audio/mpeg", companion_art_status: "pending" })],
    });

    state = appendSurfaceMediaRows(state, {
      surface: "panel",
      rows: [
        makeMediaRow("audio-1", {
          file_type: "audio/mpeg",
          companion_art_status: "ready",
          companion_art_storage_path: "user/uploads/audio-1.png",
        }),
      ],
    });

    expect(state.surfaceStateByKind.panel.orderedViews.mediaIds).toEqual(["audio-1"]);
    expect(state.surfaceStateByKind.panel.orderedViews.mediaIdsByTab.uploaded_images).toEqual([
      "audio-1",
    ]);
    expect(selectSurfaceAggregateMediaRows(state, "panel")[0]).toMatchObject({
      id: "audio-1",
      companion_art_status: "ready",
      companion_art_storage_path: "user/uploads/audio-1.png",
    });
  });

  it("treats identical appended rows as a no-op", () => {
    const row = makeMediaRow("image-1");
    let state = createMediaLibraryRuntimeState();
    state = appendSurfaceMediaRows(state, {
      surface: "panel",
      rows: [row],
    });

    const nextState = appendSurfaceMediaRows(state, {
      surface: "panel",
      rows: [{ ...row }],
    });

    expect(nextState).toBe(state);
  });

  it("treats semantically identical prompt rows and promptsLoaded state as a no-op", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfacePromptRows(state, {
      surface: "panel",
      rows: [makePromptRow("prompt-1"), makePromptRow("prompt-2")],
      promptsLoaded: true,
    });

    const nextState = replaceSurfacePromptRows(state, {
      surface: "panel",
      rows: [
        {
          ...makePromptRow("prompt-1"),
        },
        {
          ...makePromptRow("prompt-2"),
        },
      ],
      promptsLoaded: true,
    });

    expect(nextState).toBe(state);
  });

  it("tracks prompts, selection, aspect ratio, and deduped byte totals per surface", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [
        makeMediaRow("shared", { file_size: 512 }),
        makeMediaRow("modal-only", { file_size: 64 }),
      ],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "panel",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared", { file_size: 512 })],
    });
    state = replaceSurfacePromptRows(state, {
      surface: "modal",
      rows: [makePromptRow("prompt-1"), makePromptRow("prompt-2")],
      promptsLoaded: true,
    });
    state = setSurfaceSelectedIds(state, {
      surface: "modal",
      selectedIds: ["shared", "prompt-2"],
    });
    state = setSurfaceAspectRatio(state, {
      surface: "modal",
      mediaId: "shared",
      aspectRatio: 16 / 9,
    });

    expect(selectSurfacePromptRows(state, "modal").map((row) => row.id)).toEqual([
      "prompt-1",
      "prompt-2",
    ]);
    expect(selectSurfaceSelectedIds(state, "modal")).toEqual(["shared", "prompt-2"]);
    expect(state.surfaceStateByKind.modal.preview.aspectRatioById.shared).toBe(16 / 9);
    expect(selectTotalCachedMediaBytes(state)).toBe(576);
    expect(state.surfaceStateByKind.modal.promptsLoaded).toBe(true);
  });
});
