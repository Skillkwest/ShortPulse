import { describe, expect, it } from "vitest";
import {
  applyMediaSignedUrls,
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaRowsByTabs,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
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
    const routeOnly = makeMediaRow("route-only");
    const modalOnly = makeMediaRow("modal-only");

    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "route",
      tab: "uploaded_images",
      rows: [shared, routeOnly],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [modalOnly, shared],
    });

    expect(Object.keys(state.mediaById).sort()).toEqual(["modal-only", "route-only", "shared"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "route", tab: "uploaded_images" }).map(
        (row) => row.id
      )
    ).toEqual(["shared", "route-only"]);
    expect(
      selectSurfaceMediaRows(state, { surface: "modal", tab: "uploaded_images" }).map(
        (row) => row.id
      )
    ).toEqual(["modal-only", "shared"]);
  });

  it("applies signed urls once and exposes them through every surface view", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "route",
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
      selectSurfaceMediaRows(state, { surface: "route", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/shared.png");
    expect(
      selectSurfaceMediaRows(state, { surface: "panel", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/shared.png");
  });

  it("can update preview signed urls for a single surface without mutating shared entities", () => {
    let state = createMediaLibraryRuntimeState();
    state = replaceSurfaceMediaTabRows(state, {
      surface: "route",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "modal",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared")],
    });

    state = setSurfaceSignedUrls(state, {
      surface: "route",
      signedUrlById: new Map([["shared", "https://signed/route.png"]]),
    });

    expect(state.mediaById.shared?.signedUrl).toBeUndefined();
    expect(
      selectSurfaceMediaRows(state, { surface: "route", tab: "uploaded_images" })[0]?.signedUrl
    ).toBe("https://signed/route.png");
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
      surface: "route",
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
      surface: "route",
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
      surface: "route",
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
      surface: "route",
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

    const routeCache = selectSurfaceMediaTabCacheRecord(state, "route");

    expect(routeCache.uploaded_images.rows.map((row) => row.id)).toEqual(["image-1"]);
    expect(routeCache.uploaded_images.pagesLoaded).toBe(2);
    expect(routeCache.uploaded_images.query).toBe("portrait");
    expect(routeCache.uploaded_images.hasMore).toBe(true);
    expect(routeCache.uploaded_videos.rows.map((row) => row.id)).toEqual(["video-1"]);
    expect(routeCache.uploaded_videos.pagesLoaded).toBe(1);
    expect(routeCache.private.rows).toEqual([]);
    expect(routeCache.ai_generations.rows).toEqual([]);
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
      surface: "route",
      tab: "uploaded_images",
      rows: [
        makeMediaRow("shared", { file_size: 512 }),
        makeMediaRow("route-only", { file_size: 64 }),
      ],
    });
    state = replaceSurfaceMediaTabRows(state, {
      surface: "panel",
      tab: "uploaded_images",
      rows: [makeMediaRow("shared", { file_size: 512 })],
    });
    state = replaceSurfacePromptRows(state, {
      surface: "route",
      rows: [makePromptRow("prompt-1"), makePromptRow("prompt-2")],
      promptsLoaded: true,
    });
    state = setSurfaceSelectedIds(state, {
      surface: "route",
      selectedIds: ["shared", "prompt-2"],
    });
    state = setSurfaceAspectRatio(state, {
      surface: "route",
      mediaId: "shared",
      aspectRatio: 16 / 9,
    });

    expect(selectSurfacePromptRows(state, "route").map((row) => row.id)).toEqual([
      "prompt-1",
      "prompt-2",
    ]);
    expect(selectSurfaceSelectedIds(state, "route")).toEqual(["shared", "prompt-2"]);
    expect(state.surfaceStateByKind.route.preview.aspectRatioById.shared).toBe(16 / 9);
    expect(selectTotalCachedMediaBytes(state)).toBe(576);
    expect(state.surfaceStateByKind.route.promptsLoaded).toBe(true);
  });
});
