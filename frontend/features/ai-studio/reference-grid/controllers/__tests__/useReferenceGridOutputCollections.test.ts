import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { StudioOutput } from "../../../types";
import {
  resetAiStudioOutputStore,
  setAiStudioOutputStoreSnapshot,
} from "../../../hooks/aiStudioOutputStore";
import { useReferenceGridOutputCollections } from "../useReferenceGridOutputCollections";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

describe("useReferenceGridOutputCollections", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
  });

  it("keeps store-backed projections on cached id selectors", () => {
    const sourcePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../useReferenceGridOutputCollections.ts"
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("selectVisibleAllRefsOutputIdsFromStoreSnapshot");
    expect(source).toContain("selectQuickSlotOutputIdsFromStoreSnapshot");
    expect(source).not.toMatch(/selectVisibleAllRefsProjection\(\s*snapshot\.outputOrder\s*\.map/);
    expect(source).not.toMatch(/selectQuickSlotProjection\(\s*snapshot\.outputOrder\s*\.map/);
    expect(source).not.toMatch(/new Map\(\s*outputs\.map/);
  });

  it("projects store-backed all-refs and quick-slot ids without direct output props", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b", { hiddenInReferenceGrid: true });
    const outputC = makeOutput("c");

    const { result } = renderHook(() =>
      useReferenceGridOutputCollections({
        outputsProp: undefined,
        archivedOutputsProp: undefined,
        curatedReferenceIds: ["a", "b"],
        removedFromAllRefsIds: ["a"],
      })
    );

    act(() => {
      setAiStudioOutputStoreSnapshot({
        outputOrder: ["a", "b", "c"],
        outputById: { a: outputA, b: outputB, c: outputC },
        archivedOutputOrder: [],
        archivedOutputById: {},
      });
    });

    expect(result.current.allOutputIds).toEqual(["c"]);
    expect(result.current.curatedOutputIds).toEqual(["a"]);
    expect(result.current.curatedOutputs.map((item) => item.id)).toEqual(["a"]);
  });

  it("preserves direct-prop projection semantics for isolated consumers", () => {
    const outputA = makeOutput("a");
    const outputB = makeOutput("b", { hiddenInReferenceGrid: true });
    const outputC = makeOutput("c");

    const { result } = renderHook(() =>
      useReferenceGridOutputCollections({
        outputsProp: [outputA, outputB, outputC],
        archivedOutputsProp: [],
        curatedReferenceIds: ["a", "b"],
        removedFromAllRefsIds: ["a"],
      })
    );

    expect(result.current.allOutputIds).toEqual(["c"]);
    expect(result.current.curatedOutputIds).toEqual(["a"]);
    expect(result.current.curatedOutputs.map((item) => item.id)).toEqual(["a"]);
  });
});
