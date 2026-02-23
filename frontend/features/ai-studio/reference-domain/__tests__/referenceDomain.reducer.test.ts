/**
 * Unit tests for reference-domain reducer and selectors.
 */
import { describe, expect, it } from "vitest";
import {
  createEmptyReferenceState,
  referenceReducer,
  selectAllRefs,
  selectArchivedRefs,
  selectQuickSlots,
  selectVisibleGrid,
  toReferenceEntity,
} from "../index";
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

describe("reference-domain reducer", () => {
  it("adds active and archived entities and resolves selectors", () => {
    const state = createEmptyReferenceState();
    const activeA = toReferenceEntity(makeOutput("a", { mediaSource: "generated" }));
    const activeB = toReferenceEntity(makeOutput("b", { mediaSource: "upload" }));
    const archivedC = toReferenceEntity(makeOutput("c", { mediaSource: "library" }));

    const withActive = referenceReducer(state, {
      type: "addMany",
      entities: [activeA, activeB],
    });
    const withArchived = referenceReducer(withActive, {
      type: "addMany",
      entities: [archivedC],
      archived: true,
    });

    expect(selectAllRefs(withArchived).map((output) => output.id)).toEqual(["a", "b"]);
    expect(selectArchivedRefs(withArchived).map((output) => output.id)).toEqual(["c"]);
  });

  it("sets and reorders quick slots", () => {
    const base = referenceReducer(createEmptyReferenceState(), {
      type: "addMany",
      entities: [toReferenceEntity(makeOutput("a")), toReferenceEntity(makeOutput("b"))],
    });

    const withQuickSlots = referenceReducer(base, {
      type: "setQuickSlots",
      ids: ["b", "a", "b", "missing"],
    });
    expect(selectQuickSlots(withQuickSlots).map((output) => output.id)).toEqual(["b", "a"]);

    const reordered = referenceReducer(withQuickSlots, {
      type: "reorderQuickSlots",
      id: "a",
      targetId: "b",
      placement: "before",
    });
    expect(selectQuickSlots(reordered).map((output) => output.id)).toEqual(["a", "b"]);
    expect(selectVisibleGrid(reordered).map((output) => output.id)).toEqual(["a", "b"]);
  });

  it("archives references and removes quick-slot membership", () => {
    const base = referenceReducer(createEmptyReferenceState(), {
      type: "addMany",
      entities: [toReferenceEntity(makeOutput("a")), toReferenceEntity(makeOutput("b"))],
    });
    const withQuickSlots = referenceReducer(base, {
      type: "setQuickSlots",
      ids: ["a", "b"],
    });
    const archived = referenceReducer(withQuickSlots, {
      type: "archive",
      id: "a",
    });

    expect(selectArchivedRefs(archived).map((output) => output.id)).toEqual(["a"]);
    expect(selectQuickSlots(archived).map((output) => output.id)).toEqual(["b"]);
    expect(selectAllRefs(archived).map((output) => output.id)).toEqual(["b"]);
  });

  it("updates status and hydrated media fields", () => {
    const base = referenceReducer(createEmptyReferenceState(), {
      type: "addMany",
      entities: [toReferenceEntity(makeOutput("a", { status: "ready" }))],
    });

    const withStatus = referenceReducer(base, {
      type: "setStatus",
      id: "a",
      status: "saved",
    });
    expect(selectAllRefs(withStatus)[0]?.status).toBe("saved");

    const withHydration = referenceReducer(withStatus, {
      type: "hydrateMedia",
      id: "a",
      patch: {
        previewStoragePath: "user/preview.jpg",
        fullStoragePath: "user/full.jpg",
      },
    });

    expect(selectAllRefs(withHydration)[0]?.previewStoragePath).toBe("user/preview.jpg");
    expect(selectAllRefs(withHydration)[0]?.fullStoragePath).toBe("user/full.jpg");
  });

  it("removes references from all projections", () => {
    const base = referenceReducer(createEmptyReferenceState(), {
      type: "addMany",
      entities: [toReferenceEntity(makeOutput("a")), toReferenceEntity(makeOutput("b"))],
    });
    const archived = referenceReducer(base, {
      type: "archive",
      id: "b",
    });
    const removed = referenceReducer(archived, {
      type: "remove",
      id: "b",
    });

    expect(selectAllRefs(removed).map((output) => output.id)).toEqual(["a"]);
    expect(selectArchivedRefs(removed)).toEqual([]);
  });
});
