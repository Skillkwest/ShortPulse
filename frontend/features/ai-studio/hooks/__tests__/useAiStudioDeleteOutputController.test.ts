import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioDeleteOutputController } from "../useAiStudioDeleteOutputController";
import type { ReferenceProjectionState } from "../../reference-projections";
import type { StudioOutput } from "../../types";

const createOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "flux-dev",
  status: "ready",
  timestamp: "2026-04-24T19:00:00.000Z",
  ...overrides,
});

describe("useAiStudioDeleteOutputController", () => {
  it("fully deletes quick-slot outputs instead of keeping them suppressed in all refs", () => {
    const deleteOutputFromLifecycle = vi.fn();
    const updateOutputById = vi.fn();

    const { result } = renderHook(() => {
      const [activeOutputId, setActiveOutputId] = useState<string | null>("output-1");
      const [referenceProjectionState, setReferenceProjectionState] =
        useState<ReferenceProjectionState>({
          quickSlotIds: ["output-1"],
          removedFromAllRefsIds: ["output-1"],
        });
      const pendingFinalizeRemovalIdsRef = useRef(new Set<string>(["output-1"]));
      const output = createOutput("output-1", {
        mediaSource: "upload",
      });

      const controller = useAiStudioDeleteOutputController({
        quickSlotIds: referenceProjectionState.quickSlotIds,
        setReferenceProjectionState,
        setActiveOutputId,
        deleteOutputFromLifecycle,
        findOutputById: (id) => (id === output.id ? output : null),
        updateOutputById,
        pendingFinalizeRemovalIdsRef,
      });

      return {
        activeOutputId,
        referenceProjectionState,
        pendingFinalizeRemovalIds: pendingFinalizeRemovalIdsRef.current,
        ...controller,
      };
    });

    act(() => {
      result.current.deleteOutput("output-1");
    });

    expect(deleteOutputFromLifecycle).toHaveBeenCalledWith("output-1");
    expect(updateOutputById).not.toHaveBeenCalled();
    expect(result.current.activeOutputId).toBeNull();
    expect(result.current.referenceProjectionState).toEqual({
      quickSlotIds: [],
      removedFromAllRefsIds: [],
    });
    expect(Array.from(result.current.pendingFinalizeRemovalIds)).toEqual([]);
  });
});
