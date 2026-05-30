/**
 * Unit tests for curated reference-id list helpers.
 */
import { describe, expect, it } from "vitest";
import {
  addCuratedReferenceId,
  pruneCuratedReferenceIds,
  removeCuratedReferenceId,
  reorderCuratedReferenceId,
  syncCuratedPinnedOutputsByOrder,
} from "../curatedReferences";
import type { StudioOutput } from "../../types";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: id,
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  ...overrides,
});

describe("curatedReferences helpers", () => {
  it("dedupes when adding ids", () => {
    expect(addCuratedReferenceId(["a", "b"], "b")).toEqual(["a", "b"]);
    expect(addCuratedReferenceId(["a", "b"], "c")).toEqual(["c", "a", "b"]);
    expect(addCuratedReferenceId(["a", "b"], "c", "end")).toEqual(["a", "b", "c"]);
  });

  it("reorders ids before/after/end", () => {
    expect(reorderCuratedReferenceId(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
    expect(reorderCuratedReferenceId(["a", "b", "c"], "a", "b", "after")).toEqual(["b", "a", "c"]);
    expect(reorderCuratedReferenceId(["a", "b", "c"], "c", null, "start")).toEqual(["c", "a", "b"]);
    expect(reorderCuratedReferenceId(["a", "b", "c"], "a", null, "end")).toEqual(["b", "c", "a"]);
    expect(reorderCuratedReferenceId(["a", "b", "c"], "b", "b", "before")).toEqual(["a", "b", "c"]);
  });

  it("removes ids", () => {
    expect(removeCuratedReferenceId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(removeCuratedReferenceId(["a", "b", "c"], "missing")).toEqual(["a", "b", "c"]);
  });

  it("prunes stale ids against valid output ids", () => {
    expect(pruneCuratedReferenceIds(["a", "b", "c"], ["a", "c"])).toEqual(["a", "c"]);
    expect(pruneCuratedReferenceIds(["a", "b"], ["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("syncs pinned state from curated ids", () => {
    const byId: Record<string, StudioOutput> = {
      a: makeOutput("a"),
      b: makeOutput("b", { pinned: true }),
      c: makeOutput("c"),
    };
    const next = syncCuratedPinnedOutputsByOrder(["a", "b", "c"], byId, ["a", "c"]);
    expect(next.a?.pinned).toBe(true);
    expect(next.b?.pinned).toBeUndefined();
    expect(next.c?.pinned).toBe(true);
  });

  it("returns original map when pinned state already matches curated ids", () => {
    const byId: Record<string, StudioOutput> = {
      a: makeOutput("a", { pinned: true }),
      b: makeOutput("b"),
    };
    const next = syncCuratedPinnedOutputsByOrder(["a", "b"], byId, ["a"]);
    expect(next).toBe(byId);
  });
});
