/**
 * Verifies shared media query model semantics used by modal/page data paths.
 */
import { describe, expect, it } from "vitest";
import {
  buildMediaKindOrClause,
  buildMediaSearchOrClause,
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withMediaTabFilter,
  withUserScopedPromptQuery,
} from "../mediaQueryModel";

describe("mediaQueryModel", () => {
  it("normalizes search terms and builds an or-clause", () => {
    expect(normalizeMediaSearchTerm("  cat,  *(video)%  ")).toBe("cat video");
    expect(buildMediaSearchOrClause("  cat  ")).toBe(
      "filename.ilike.*cat*,storage_path.ilike.*cat*"
    );
    expect(buildMediaSearchOrClause("   ")).toBeNull();
  });

  it("applies media search only when a non-empty term exists", () => {
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

  it("applies tab filters with private source override", () => {
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

    withMediaTabFilter(query, "private", { privateMediaSource: "private_upload" });
    withMediaTabFilter(query, "uploaded_videos");
    withMediaTabFilter(query, "ai_generations");

    expect(calls).toEqual([
      { fn: "eq", column: "source", value: "private_upload" },
      { fn: "eq", column: "source", value: "upload" },
      { fn: "or", value: buildMediaKindOrClause("video") },
      { fn: "eq", column: "source", value: "ai_studio" },
    ]);
  });

  it("builds playable media kind clauses from file_type and durable media paths", () => {
    expect(buildMediaKindOrClause("video")).toContain("file_type.ilike.video*");
    expect(buildMediaKindOrClause("video")).toContain("storage_path.ilike.*.mp4");
    expect(buildMediaKindOrClause("video")).toContain("storage_path.ilike.*.ogv");
    expect(buildMediaKindOrClause("video")).not.toContain("storage_path.ilike.*.ogg");
    expect(buildMediaKindOrClause("video")).toContain("preview_variant_path.ilike.*.webm");
    expect(buildMediaKindOrClause("audio")).toContain("storage_path.ilike.*.mp3");
    expect(buildMediaKindOrClause("audio")).toContain("storage_path.ilike.*.ogg");
  });

  it("builds prompt queries with explicit user scope and stable ordering", () => {
    const calls: Array<{ fn: string; column: string; value?: string }> = [];
    const query = {
      eq(column: string, value: string) {
        calls.push({ fn: "eq", column, value });
        return query;
      },
      order(column: string) {
        calls.push({ fn: "order", column });
        return query;
      },
    };

    withUserScopedPromptQuery(query, "user-1");

    expect(calls).toEqual([
      { fn: "eq", column: "user_id", value: "user-1" },
      { fn: "order", column: "created_at" },
      { fn: "order", column: "id" },
    ]);
  });
});
