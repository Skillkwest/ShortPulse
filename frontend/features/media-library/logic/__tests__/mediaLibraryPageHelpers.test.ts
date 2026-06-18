import { describe, expect, it } from "vitest";
import {
  createMediaTabCacheState,
  getMediaDataTabForRow,
  isMissingRelationError,
  mergePageRows,
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withMediaTabFilter,
} from "../mediaLibraryPageHelpers";

describe("mediaLibraryPageHelpers", () => {
  it("creates an empty cache for each media data tab", () => {
    const cache = createMediaTabCacheState<{ id: string }>();

    expect(Object.keys(cache).sort()).toEqual([
      "ai_generations",
      "private",
      "uploaded_images",
      "uploaded_videos",
    ]);
    expect(cache.uploaded_images.rows).toEqual([]);
    expect(cache.uploaded_images.loaded).toBe(false);
    expect(cache.uploaded_images.error).toBeNull();
    expect(cache.uploaded_images.pagesLoaded).toBe(0);
  });

  it("derives the correct media data tab from row metadata", () => {
    expect(
      getMediaDataTabForRow({
        source: "private_upload",
        storage_path: "abc",
        file_type: "image/png",
      })
    ).toBe("private");
    expect(
      getMediaDataTabForRow({
        source: "upload",
        storage_path: "u/private/x",
        file_type: "image/png",
      })
    ).toBe("private");
    expect(
      getMediaDataTabForRow({ source: "ai_studio", storage_path: "x", file_type: "image/png" })
    ).toBe("ai_generations");
    expect(
      getMediaDataTabForRow({ source: "upload", storage_path: "x", file_type: "video/mp4" })
    ).toBe("uploaded_videos");
    expect(
      getMediaDataTabForRow({ source: "upload", storage_path: "x", file_type: "image/png" })
    ).toBe("uploaded_images");
  });

  it("normalizes media search terms by removing reserved wildcard characters", () => {
    expect(normalizeMediaSearchTerm("  cat,  *(video)%  ")).toBe("cat video");
  });

  it("applies tab filter for uploaded videos", () => {
    const calls: Array<{ fn: string; column?: string; value?: string }> = [];
    const query = {
      eq(column: string, value: string) {
        calls.push({ fn: "eq", column, value });
        return query;
      },
      ilike(column: string, value: string) {
        calls.push({ fn: "ilike", column, value });
        return query;
      },
      not(column: string, operator: string, value: string) {
        calls.push({ fn: "not", column: `${column}:${operator}`, value });
        return query;
      },
      or(clause: string) {
        calls.push({ fn: "or", value: clause });
        return query;
      },
    };

    withMediaTabFilter(query, "uploaded_videos");
    withMediaTabFilter(query, "ai_generations");

    expect(calls).toEqual([
      { fn: "eq", column: "source", value: "upload" },
      { fn: "or", value: expect.stringContaining("storage_path.ilike.*.mp4") },
      { fn: "eq", column: "source", value: "ai_studio" },
    ]);
  });

  it("applies search or-clause only when a non-empty search term exists", () => {
    const clauses: string[] = [];
    const query = {
      or(clause: string) {
        clauses.push(clause);
        return query;
      },
    };

    withMediaSearchFilter(query, "   ");
    withMediaSearchFilter(query, "cat");

    expect(clauses).toEqual(["filename.ilike.*cat*,storage_path.ilike.*cat*"]);
  });

  it("merges page rows by id and sorts by created_at descending", () => {
    const merged = mergePageRows(
      [
        { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "b", created_at: "2026-01-03T00:00:00.000Z" },
      ],
      [
        { id: "a", created_at: "2026-01-05T00:00:00.000Z" },
        { id: "c", created_at: "2026-01-02T00:00:00.000Z" },
      ]
    );

    expect(merged.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("identifies missing relation errors", () => {
    expect(isMissingRelationError({ code: "42P01" })).toBe(true);
    expect(isMissingRelationError({ code: "42883" })).toBe(false);
    expect(isMissingRelationError("oops")).toBe(false);
  });
});
