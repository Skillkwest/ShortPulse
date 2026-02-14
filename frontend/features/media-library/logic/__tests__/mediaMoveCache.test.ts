import { describe, expect, it } from "vitest";
import { createMediaTabCacheState } from "../mediaLibraryPageHelpers";
import { applyMovedRowsToMediaTabCache } from "../mediaMoveCache";

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  created_at: string;
};

const buildRow = (id: string, filename: string, storagePath: string, createdAt: string): Row => ({
  id,
  filename,
  storage_path: storagePath,
  created_at: createdAt,
});

describe("mediaMoveCache", () => {
  it("removes moved rows from all tabs and merges into destination when query matches", () => {
    const cache = createMediaTabCacheState<Row>();
    const moved = buildRow(
      "moved-1",
      "Cat portrait",
      "user/private/cat.png",
      "2026-02-14T10:00:00.000Z"
    );
    const sibling = buildRow(
      "stay-1",
      "Dog photo",
      "user/upload/dog.png",
      "2026-02-13T10:00:00.000Z"
    );
    cache.uploaded_images.rows = [moved, sibling];
    cache.private.rows = [];
    cache.private.query = "cat";
    cache.private.loadedAtMs = 5;

    const next = applyMovedRowsToMediaTabCache({
      cacheState: cache,
      movedRows: [moved],
      destinationTab: "private",
      nowMs: 1234,
    });

    expect(next.uploaded_images.rows.map((row) => row.id)).toEqual(["stay-1"]);
    expect(next.private.rows.map((row) => row.id)).toEqual(["moved-1"]);
    expect(next.private.loadedAtMs).toBe(1234);
    expect(next.uploaded_images.loadedAtMs).toBeNull();
  });

  it("does not inject moved rows into destination when destination query does not match", () => {
    const cache = createMediaTabCacheState<Row>();
    const moved = buildRow(
      "moved-2",
      "Landscape",
      "user/upload/landscape.png",
      "2026-02-14T12:00:00.000Z"
    );
    cache.uploaded_images.rows = [moved];
    cache.private.rows = [
      buildRow("keep-1", "Existing", "user/private/existing.png", "2026-02-10T10:00:00.000Z"),
    ];
    cache.private.query = "cat";

    const next = applyMovedRowsToMediaTabCache({
      cacheState: cache,
      movedRows: [moved],
      destinationTab: "private",
      nowMs: 3000,
    });

    expect(next.uploaded_images.rows).toEqual([]);
    expect(next.private.rows.map((row) => row.id)).toEqual(["keep-1"]);
    expect(next.private.loadedAtMs).toBe(3000);
  });

  it("returns the same cache object when no rows were moved", () => {
    const cache = createMediaTabCacheState<Row>();

    const next = applyMovedRowsToMediaTabCache({
      cacheState: cache,
      movedRows: [],
      destinationTab: "uploaded_images",
    });

    expect(next).toBe(cache);
  });
});
