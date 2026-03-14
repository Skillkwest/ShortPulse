/**
 * Tests selector-store fallback behavior for AI Studio output lookups.
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { resetAiStudioOutputStore, setAiStudioOutputStoreSnapshot } from "../aiStudioOutputStore";
import { useAiStudioOutputStoreSelectors } from "../useAiStudioOutputStoreSelectors";

const makeOutput = (id: string): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  taskState: "success",
});

describe("useAiStudioOutputStoreSelectors", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
  });

  it("falls back to local active outputs when selector store has not published yet", () => {
    const activeOutput = makeOutput("active-1");
    const { result } = renderHook(() =>
      useAiStudioOutputStoreSelectors({
        outputs: [activeOutput],
        archivedOutputs: [],
      })
    );

    expect(result.current.getOutputById("active-1")).toBe(activeOutput);
  });

  it("falls back to local archived outputs when selector store has not published yet", () => {
    const archivedOutput = makeOutput("archived-1");
    const { result } = renderHook(() =>
      useAiStudioOutputStoreSelectors({
        outputs: [],
        archivedOutputs: [archivedOutput],
      })
    );

    expect(result.current.getOutputById("archived-1")).toBe(archivedOutput);
  });

  it("prefers selector-store output when present", () => {
    const localOutput = makeOutput("out-1");
    const storeOutput = {
      ...localOutput,
      prompt: "Store copy",
    };
    setAiStudioOutputStoreSnapshot({
      outputOrder: ["out-1"],
      outputById: { "out-1": storeOutput },
      archivedOutputOrder: [],
      archivedOutputById: {},
    });

    const { result } = renderHook(() =>
      useAiStudioOutputStoreSelectors({
        outputs: [localOutput],
        archivedOutputs: [],
      })
    );

    expect(result.current.getOutputById("out-1")).toBe(storeOutput);
  });
});
