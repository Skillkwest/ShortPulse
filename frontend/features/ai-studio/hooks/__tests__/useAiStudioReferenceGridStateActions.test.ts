import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useAiStudioReferenceGridStateActions } from "../useAiStudioReferenceGridStateActions";
import type { ReferenceProjectionState } from "../../reference-projections";
import { REFERENCE_GRID_MAX_VISIBLE_ITEMS } from "../../reference-grid/logic/referenceGridLimits";
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
        outputs,
        archivedOutputs,
        setActiveOutputId,
        setOutputsState,
        setArchivedOutputs,
        setReferenceProjectionState,
        pendingFinalizeRemovalIdsRef,
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

  it("caps large all-refs collections at the hard output limit and drops overflow", () => {
    const { result } = renderHook(() => {
      const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
      const [outputs, setOutputsState] = useState<StudioOutput[]>([]);
      const [archivedOutputs, setArchivedOutputs] = useState<StudioOutput[]>([]);
      const [, setReferenceProjectionState] = useState<ReferenceProjectionState>({
        quickSlotIds: [],
        removedFromAllRefsIds: [],
      });
      const pendingFinalizeRemovalIdsRef = useRef(new Set<string>());

      const actions = useAiStudioReferenceGridStateActions({
        outputs,
        archivedOutputs,
        setActiveOutputId,
        setOutputsState,
        setArchivedOutputs,
        setReferenceProjectionState,
        pendingFinalizeRemovalIdsRef,
      });

      return {
        activeOutputId,
        outputs,
        archivedOutputs,
        ...actions,
      };
    });

    const manyOutputs = Array.from({ length: REFERENCE_GRID_MAX_VISIBLE_ITEMS + 2 }, (_, index) =>
      createOutput(`output-${index + 1}`)
    );

    act(() => {
      result.current.setOutputs(manyOutputs);
    });

    expect(result.current.outputs).toHaveLength(REFERENCE_GRID_MAX_VISIBLE_ITEMS);
    expect(result.current.archivedOutputs).toEqual([]);
  });

  it("clears archived rows instead of restoring them into a full Reference Grid", () => {
    const { result } = renderHook(() => {
      const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
      const [outputs, setOutputsState] = useState<StudioOutput[]>(
        Array.from({ length: REFERENCE_GRID_MAX_VISIBLE_ITEMS }, (_, index) =>
          createOutput(`output-${index + 1}`)
        )
      );
      const [archivedOutputs, setArchivedOutputs] = useState<StudioOutput[]>([
        createOutput("archived-1", {
          archivedAt: "2026-04-24T18:30:00.000Z",
          archiveReason: "manual",
        }),
      ]);
      const [, setReferenceProjectionState] = useState<ReferenceProjectionState>({
        quickSlotIds: [],
        removedFromAllRefsIds: [],
      });
      const pendingFinalizeRemovalIdsRef = useRef(new Set<string>());

      const actions = useAiStudioReferenceGridStateActions({
        outputs,
        archivedOutputs,
        setActiveOutputId,
        setOutputsState,
        setArchivedOutputs,
        setReferenceProjectionState,
        pendingFinalizeRemovalIdsRef,
      });

      return {
        activeOutputId,
        outputs,
        archivedOutputs,
        ...actions,
      };
    });

    act(() => {
      result.current.restoreArchivedOutput("archived-1");
    });

    expect(result.current.outputs).toHaveLength(REFERENCE_GRID_MAX_VISIBLE_ITEMS);
    expect(result.current.archivedOutputs).toEqual([]);
    expect(result.current.activeOutputId).toBeNull();
  });

  it("cascade-removes right-rail references that still point at deleted library media", () => {
    const { result } = renderHook(() => {
      const [activeOutputId, setActiveOutputId] = useState<string | null>("output-1");
      const [outputs, setOutputsState] = useState<StudioOutput[]>([
        createOutput("output-1", {
          savedMediaIds: ["media-1"],
          previewStoragePath: "user-1/uploads/images/media-1-thumb.webp",
          fullStoragePath: "user-1/uploads/images/media-1.png",
        }),
        createOutput("output-2", {
          savedMediaIds: ["media-2"],
          previewStoragePath: "user-1/uploads/images/media-2-thumb.webp",
          fullStoragePath: "user-1/uploads/images/media-2.png",
        }),
      ]);
      const [archivedOutputs, setArchivedOutputs] = useState<StudioOutput[]>([
        createOutput("archived-1", {
          savedMediaIds: ["media-1"],
          previewStoragePath: "user-1/uploads/images/media-1-thumb.webp",
          fullStoragePath: "user-1/uploads/images/media-1.png",
          archivedAt: "2026-04-24T18:30:00.000Z",
          archiveReason: "manual",
        }),
      ]);
      const [referenceProjectionState, setReferenceProjectionState] =
        useState<ReferenceProjectionState>({
          quickSlotIds: ["output-1", "output-2"],
          removedFromAllRefsIds: ["output-1"],
        });
      const pendingFinalizeRemovalIdsRef = useRef(new Set<string>(["output-1"]));

      const actions = useAiStudioReferenceGridStateActions({
        outputs,
        archivedOutputs,
        setActiveOutputId,
        setOutputsState,
        setArchivedOutputs,
        setReferenceProjectionState,
        pendingFinalizeRemovalIdsRef,
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
      result.current.removeReferencesForDeletedMedia([
        {
          mediaId: "media-1",
          storagePath: "user-1/uploads/images/media-1.png",
          previewStoragePath: "user-1/uploads/images/media-1-thumb.webp",
        },
      ]);
    });

    expect(result.current.outputs.map((output) => output.id)).toEqual(["output-2"]);
    expect(result.current.archivedOutputs).toEqual([]);
    expect(result.current.activeOutputId).toBeNull();
    expect(result.current.referenceProjectionState).toEqual({
      quickSlotIds: ["output-2"],
      removedFromAllRefsIds: [],
    });
    expect(Array.from(result.current.pendingFinalizeRemovalIds)).toEqual([]);
  });
});
