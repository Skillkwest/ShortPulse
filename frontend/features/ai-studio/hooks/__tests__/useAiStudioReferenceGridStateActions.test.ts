import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useAiStudioReferenceGridStateActions } from "../useAiStudioReferenceGridStateActions";
import type { ReferenceProjectionState } from "../../reference-projections";
import type { StudioOutput } from "../../types";

const createOutput = (id: string): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "flux-dev",
  status: "ready",
  timestamp: "2026-04-24T19:00:00.000Z",
});

describe("useAiStudioReferenceGridStateActions", () => {
  it("resets outputs, archive state, active output, and quick slot references together", () => {
    const { result } = renderHook(() => {
      const [activeOutputId, setActiveOutputId] = useState<string | null>("output-1");
      const [outputs, setOutputsState] = useState<StudioOutput[]>([
        createOutput("output-1"),
        createOutput("output-2"),
      ]);
      const [archivedOutputs, setArchivedOutputs] = useState<StudioOutput[]>([
        {
          ...createOutput("archived-1"),
          archivedAt: "2026-04-24T18:30:00.000Z",
          archiveReason: "manual",
        },
      ]);
      const [referenceProjectionState, setReferenceProjectionState] =
        useState<ReferenceProjectionState>({
          quickSlotIds: ["output-1", "output-2"],
          removedFromAllRefsIds: ["output-2"],
        });
      const pendingFinalizeRemovalIdsRef = useRef(new Set<string>());

      const actions = useAiStudioReferenceGridStateActions({
        activeOutputId,
        outputsLength: outputs.length,
        setActiveOutputId,
        setOutputsState,
        setArchivedOutputs,
        setReferenceProjectionState,
        pendingFinalizeRemovalIdsRef,
        config: {
          softArchiveEnabled: true,
          activeLimit: 100,
          archivePreviewKeepCount: 10,
          defaultActiveLimit: 100,
        },
      });

      return {
        activeOutputId,
        outputs,
        archivedOutputs,
        referenceProjectionState,
        pendingFinalizeRemovalIds: pendingFinalizeRemovalIdsRef.current,
        ...actions,
      };
    });

    act(() => {
      result.current.resetReferenceGridState();
    });

    expect(result.current.outputs).toEqual([]);
    expect(result.current.archivedOutputs).toEqual([]);
    expect(result.current.activeOutputId).toBeNull();
    expect(result.current.referenceProjectionState).toEqual({
      quickSlotIds: [],
      removedFromAllRefsIds: [],
    });
    expect(Array.from(result.current.pendingFinalizeRemovalIds)).toEqual(["output-2"]);
  });
});
