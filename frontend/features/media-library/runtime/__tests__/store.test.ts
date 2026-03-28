import { describe, expect, it } from "vitest";
import {
  applyMediaSignedUrls,
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
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
