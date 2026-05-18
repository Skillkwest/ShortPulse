/**
 * Unit tests for explicit reference projection semantics.
 */
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  addQuickSlotReference,
  createEmptyReferenceProjectionState,
  isReferenceSuppressedFromAllRefs,
  markReferenceRemovedFromAllRefs,
  pruneReferenceProjectionState,
  removeQuickSlotReference,
  reorderQuickSlotReference,
  selectAllRefsProjection,
  selectQuickSlotProjection,
  selectVisibleAllRefsProjection,
  shouldFinalizeRemovalOnQuickSlotDetach,
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
    const suppressed = markReferenceRemovedFromAllRefs(reordered, "a");
    const removed = removeQuickSlotReference(suppressed, "a");

    expect(withAB.quickSlotIds).toEqual(["a", "b"]);
    expect(reordered.quickSlotIds).toEqual(["b", "a"]);
    expect(removed.quickSlotIds).toEqual(["b"]);
    expect(removed.removedFromAllRefsIds).toEqual([]);
  });

  it("suppresses quick-slot references from all-refs projection", () => {
    const outputs = [makeOutput("a"), makeOutput("b")];
    const withQuickSlot = addQuickSlotReference(createEmptyReferenceProjectionState(), "a");
    const suppressed = markReferenceRemovedFromAllRefs(withQuickSlot, "a");

    expect(selectAllRefsProjection(outputs, suppressed).map((item) => item.id)).toEqual(["b"]);
    expect(selectQuickSlotProjection(outputs, suppressed).map((item) => item.id)).toEqual(["a"]);
  });

  it("keeps hidden outputs out of quick-slot projection", () => {
    const outputs = [makeOutput("a", { hiddenInReferenceGrid: true }), makeOutput("b")];
    const state = addQuickSlotReference(createEmptyReferenceProjectionState(), "a");

    expect(selectQuickSlotProjection(outputs, state)).toEqual([]);
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

  it("reports suppression/finalize helpers for detached quick slots", () => {
    const withQuickSlot = addQuickSlotReference(createEmptyReferenceProjectionState(), "a");
    const suppressed = markReferenceRemovedFromAllRefs(withQuickSlot, "a");

    expect(isReferenceSuppressedFromAllRefs(suppressed, "a")).toBe(true);
    expect(shouldFinalizeRemovalOnQuickSlotDetach(suppressed, "a")).toBe(true);
    expect(shouldFinalizeRemovalOnQuickSlotDetach(withQuickSlot, "a")).toBe(false);
  });

  it("keeps hidden outputs and explicit suppression out of the visible all-refs projection", () => {
    const outputs = [
      makeOutput("a", { hiddenInReferenceGrid: true }),
      makeOutput("b"),
      makeOutput("c"),
    ];
    const state = createEmptyReferenceProjectionState();

    expect(selectVisibleAllRefsProjection(outputs, state).map((item) => item.id)).toEqual([
      "b",
      "c",
    ]);

    const withQuickSlot = addQuickSlotReference(state, "c");
    const suppressed = markReferenceRemovedFromAllRefs(withQuickSlot, "c");
    expect(selectVisibleAllRefsProjection(outputs, suppressed).map((item) => item.id)).toEqual([
      "b",
    ]);
  });
});
