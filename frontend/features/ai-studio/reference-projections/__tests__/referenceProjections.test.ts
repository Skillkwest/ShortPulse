/**
 * Unit tests for explicit reference projection semantics.
 */
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  addQuickSlotReference,
  applyAllRefsSuppressionCompatibility,
  createEmptyReferenceProjectionState,
  markReferenceRemovedFromAllRefs,
  pruneReferenceProjectionState,
  removeQuickSlotReference,
  reorderQuickSlotReference,
  selectAllRefsProjection,
  selectQuickSlotProjection,
} from "../index";

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

describe("reference-projections", () => {
  it("adds, reorders, and removes quick-slot ids", () => {
    const initial = createEmptyReferenceProjectionState();
    const withA = addQuickSlotReference(initial, "a");
    const withAB = addQuickSlotReference(withA, "b");
    const reordered = reorderQuickSlotReference(withAB, "b", "a", "before");
    const removed = removeQuickSlotReference(reordered, "a");

    expect(withAB.quickSlotIds).toEqual(["a", "b"]);
    expect(reordered.quickSlotIds).toEqual(["b", "a"]);
    expect(removed.quickSlotIds).toEqual(["b"]);
  });

  it("suppresses quick-slot references from all-refs projection", () => {
    const outputs = [makeOutput("a"), makeOutput("b")];
    const withQuickSlot = addQuickSlotReference(createEmptyReferenceProjectionState(), "a");
    const suppressed = markReferenceRemovedFromAllRefs(withQuickSlot, "a");

    expect(selectAllRefsProjection(outputs, suppressed).map((item) => item.id)).toEqual(["b"]);
    expect(selectQuickSlotProjection(outputs, suppressed).map((item) => item.id)).toEqual(["a"]);
  });

  it("mirrors suppression to legacy hidden flag only when necessary", () => {
    const outputs = [makeOutput("a"), makeOutput("b")];
    const withQuickSlot = addQuickSlotReference(createEmptyReferenceProjectionState(), "a");
    const suppressed = markReferenceRemovedFromAllRefs(withQuickSlot, "a");

    const firstPass = applyAllRefsSuppressionCompatibility(outputs, suppressed);
    const secondPass = applyAllRefsSuppressionCompatibility(firstPass, suppressed);

    expect(firstPass[0]?.hiddenInReferenceGrid).toBe(true);
    expect(firstPass[1]?.hiddenInReferenceGrid).toBeUndefined();
    expect(secondPass).toBe(firstPass);
  });

  it("prunes stale projection ids", () => {
    const base = {
      quickSlotIds: ["a", "missing"],
      removedFromAllRefsIds: ["a", "old"],
    };
    const pruned = pruneReferenceProjectionState(base, ["a", "b"]);

    expect(pruned.quickSlotIds).toEqual(["a"]);
    expect(pruned.removedFromAllRefsIds).toEqual(["a"]);
  });

  it("does not suppress non-quick-slot references", () => {
    const state = markReferenceRemovedFromAllRefs(createEmptyReferenceProjectionState(), "a");
    expect(state).toEqual(createEmptyReferenceProjectionState());
  });
});
