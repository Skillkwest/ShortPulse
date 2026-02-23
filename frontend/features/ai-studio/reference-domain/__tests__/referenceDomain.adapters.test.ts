/**
 * Unit tests for reference-domain adapters.
 */
import { describe, expect, it } from "vitest";
import {
  areStudioOutputCollectionStatesEqual,
  buildReferenceStateFromStudioOutputs,
  denormalizeStudioOutputCollection,
  deriveReferenceEntityKind,
  normalizeStudioOutputCollection,
  selectAllRefs,
  selectArchivedRefs,
  selectQuickSlots,
  toReferenceEntity,
  fromReferenceEntity,
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

describe("reference-domain adapters", () => {
  it("derives reference entity kinds from output shape", () => {
    expect(deriveReferenceEntityKind(makeOutput("a", { mediaSource: "upload" }))).toBe("upload");
    expect(deriveReferenceEntityKind(makeOutput("b", { mediaSource: "library" }))).toBe(
      "libraryMedia"
    );
    expect(deriveReferenceEntityKind(makeOutput("c", { mediaSource: "generated" }))).toBe(
      "generated"
    );
    expect(
      deriveReferenceEntityKind(makeOutput("d", { mediaSource: "prompt", mode: "text" }))
    ).toBe("promptReference");
  });

  it("round-trips studio outputs through reference entities", () => {
    const output = makeOutput("a", { mediaSource: "generated" });
    const entity = toReferenceEntity(output);
    expect(entity.id).toBe("a");
    expect(entity.kind).toBe("generated");
    expect(fromReferenceEntity(entity)).toBe(output);
  });

  it("normalizes and denormalizes output collections deterministically", () => {
    const first = makeOutput("a");
    const second = makeOutput("b");
    const duplicate = makeOutput("a", { prompt: "Duplicate" });

    const normalized = normalizeStudioOutputCollection([first, second, duplicate]);
    expect(normalized.order).toEqual(["a", "b"]);
    expect(denormalizeStudioOutputCollection(normalized)).toEqual([first, second]);

    const normalizedAgain = normalizeStudioOutputCollection([first, second]);
    expect(areStudioOutputCollectionStatesEqual(normalized, normalizedAgain)).toBe(true);
  });

  it("builds canonical reference state from active/archived outputs", () => {
    const activeA = makeOutput("a", { mediaSource: "upload" });
    const activeB = makeOutput("b", { mediaSource: "generated" });
    const archivedC = makeOutput("c", { mediaSource: "library" });

    const state = buildReferenceStateFromStudioOutputs({
      activeOutputs: [activeA, activeB],
      archivedOutputs: [archivedC],
      quickSlotIds: ["b", "a", "missing", "b"],
      lastUpdatedAt: "2026-02-23T00:00:00.000Z",
    });

    expect(state.meta.lastUpdatedAt).toBe("2026-02-23T00:00:00.000Z");
    expect(selectAllRefs(state).map((output) => output.id)).toEqual(["a", "b"]);
    expect(selectArchivedRefs(state).map((output) => output.id)).toEqual(["c"]);
    expect(selectQuickSlots(state).map((output) => output.id)).toEqual(["b", "a"]);
  });
});
