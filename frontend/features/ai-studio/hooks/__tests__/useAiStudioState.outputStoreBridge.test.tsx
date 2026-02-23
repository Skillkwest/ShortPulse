import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { getAiStudioOutputSnapshot, resetAiStudioOutputStore } from "../aiStudioOutputStore";
import { useAiStudioState } from "../useAiStudioState";

const mockUpdateOutputById = vi.fn();
const mockFindOutputById = vi.fn(() => null);
const mockDeleteOutputFromLifecycle = vi.fn();
const mockNotifyGenerationFailure = vi.fn();
const mockUpdateOutputPrompt = vi.fn();

vi.mock("../useAiStudioReferenceSelectionState", () => ({
  useAiStudioReferenceSelectionState: () => ({
    selectedTool: "create",
    setSelectedTool: vi.fn(),
    showCreateTools: true,
    setShowCreateTools: vi.fn(),
    videoReferenceImageUrl: null,
    motionReferenceVideoUrl: null,
    setMotionReferenceVideoUrl: vi.fn(),
    useReferenceImageIndicator: false,
    setUseReferenceImageIndicator: vi.fn(),
    detailOutputId: null,
    setDetailOutputId: vi.fn(),
    referenceImageUrl: null,
    setReferenceImageUrl: vi.fn(),
    extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
    setExtraImageUrl: vi.fn(),
    clearReferenceImages: vi.fn(),
    toggleReferenceIndicator: vi.fn(),
    resolveReferenceInputsForTool: vi.fn(() => []),
    isModelModalOpen: false,
    modelModalAnchor: null,
    modelModalContext: null,
    modelModalPosition: null,
    setIsModelModalOpen: vi.fn(),
    setModelModalAnchor: vi.fn(),
    setModelModalPosition: vi.fn(),
    openModelModal: vi.fn(),
    closeModelModal: vi.fn(),
  }),
}));

vi.mock("../useAiStudioWorkflowSettings", () => ({
  useAiStudioWorkflowSettings: () => ({
    hasPendingWorkflowRestore: false,
  }),
}));

vi.mock("../useAiStudioStateEffects", () => ({
  useAiStudioStateEffects: () => undefined,
}));

vi.mock("../useAiStudioOutputLifecycle", () => ({
  useAiStudioOutputLifecycle: () => ({
    updateOutputById: mockUpdateOutputById,
    findOutputById: mockFindOutputById,
    deleteOutput: mockDeleteOutputFromLifecycle,
    notifyGenerationFailure: mockNotifyGenerationFailure,
    updateOutputPrompt: mockUpdateOutputPrompt,
  }),
}));

vi.mock("../useAiStudioPersistenceActions", () => ({
  useAiStudioPersistenceActions: () => ({
    markOutputSaved: vi.fn(),
    markOutputSaveFailed: vi.fn(),
    ensureGenerationRecord: vi.fn(async () => null),
    persistMediaUrls: vi.fn(async () => ({ mediaFileIds: [], errors: [], delivery: null })),
    saveActiveOutput: vi.fn(),
    saveReferenceToLibrary: vi.fn(),
    savePromptReference: vi.fn(),
    savePromptToLibrary: vi.fn(),
  }),
}));

vi.mock("../useAiStudioTaskOrchestration", () => ({
  useAiStudioTaskOrchestration: () => ({
    submitTask: vi.fn(),
    onReferenceOutputMediaLoaded: vi.fn(),
    retryOutputStatus: vi.fn(),
  }),
}));

vi.mock("../useAiStudioGenerationPromptComposer", () => ({
  useAiStudioGenerationPromptComposer: () => ({
    generateOutput: vi.fn(),
    regenerateOutput: vi.fn(),
  }),
}));

const strictWrapper = ({ children }: { children: React.ReactNode }) => (
  <React.StrictMode>{children}</React.StrictMode>
);

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

describe("useAiStudioState output store bridge", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
    mockUpdateOutputById.mockClear();
    mockFindOutputById.mockClear();
    mockDeleteOutputFromLifecycle.mockClear();
    mockNotifyGenerationFailure.mockClear();
    mockUpdateOutputPrompt.mockClear();
  });

  it("publishes output mutations to selector store in StrictMode", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([makeOutput("out-1", { taskState: "pending" })]);
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.outputOrder).toEqual(["out-1"]);
      expect(snapshot.indexes.inFlightIds.has("out-1")).toBe(true);
    });
  });

  it("publishes optimistic placeholders through selector store", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    let placeholderId: string | null = null;
    act(() => {
      placeholderId = result.current.insertOptimisticGenerationPlaceholder({
        prompt: "Generate this",
        modeOverride: "image",
        selectedToolOverride: "create",
      });
    });

    expect(placeholderId).toBeTruthy();
    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      const item = snapshot.outputById[placeholderId as string];
      expect(item?.taskState).toBe("pending");
      expect(item?.mediaSource).toBe("generated");
    });
  });

  it("publishes prompt references added from agent actions", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addAgentPromptReference("Pinned prompt from agent");
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.outputOrder.length).toBe(1);
      const firstId = snapshot.outputOrder[0];
      const output = snapshot.outputById[firstId];
      expect(output.mode).toBe("text");
      expect(output.previewText).toBe("Pinned prompt from agent");
    });
  });

  it("continues publishing after unmount/remount cycles", async () => {
    const first = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });
    first.unmount();

    const second = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });
    act(() => {
      second.result.current.setOutputs([makeOutput("out-remount")]);
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.outputOrder).toEqual(["out-remount"]);
    });
  });

  it("maps media-library references with filename header label and saved prompt text", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addLibraryMediaReference({
        id: "media-1",
        url: "https://signed.example.com/forest.png",
        fileType: "image",
        filename: "forest.png",
        promptText: "Golden-hour beach portrait with soft shadows.",
        source: "upload",
      });
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.outputOrder.length).toBe(1);
      const outputId = snapshot.outputOrder[0];
      const output = snapshot.outputById[outputId];
      expect(output.mediaSource).toBe("library");
      expect(output.prompt).toBe("Golden-hour beach portrait with soft shadows.");
      expect(output.model).toBe("forest.png");
    });
  });

  it("supports media-library add -> quick-slot reorder/remove -> archive/restore flow", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addLibraryMediaReference({
        id: "media-flow-1",
        url: "https://signed.example.com/flow-a.png",
        fileType: "image",
        filename: "flow-a.png",
        promptText: "Flow prompt A",
        source: "upload",
      });
      result.current.addLibraryMediaReference({
        id: "media-flow-2",
        url: "https://signed.example.com/flow-b.png",
        fileType: "image",
        filename: "flow-b.png",
        promptText: "Flow prompt B",
        source: "upload",
      });
    });

    await waitFor(() => {
      expect(result.current.outputs.length).toBe(2);
    });

    const flowAId = result.current.outputs.find((item) => item.prompt === "Flow prompt A")?.id;
    const flowBId = result.current.outputs.find((item) => item.prompt === "Flow prompt B")?.id;
    expect(flowAId).toBeTruthy();
    expect(flowBId).toBeTruthy();

    act(() => {
      result.current.addCuratedReference(flowAId as string);
      result.current.addCuratedReference(flowBId as string);
    });

    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual([flowAId, flowBId]);
    });

    act(() => {
      result.current.reorderCuratedReference(flowAId as string, flowBId as string, "after");
    });

    expect(result.current.curatedReferenceIds).toEqual([flowBId, flowAId]);

    act(() => {
      result.current.removeCuratedReference(flowAId as string);
      result.current.removeCuratedReference(flowBId as string);
    });

    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual([]);
    });

    const bulkOutputs = Array.from({ length: 520 }, (_, index) =>
      makeOutput(`bulk-${index + 1}`, { prompt: `Bulk ${index + 1}` })
    );
    act(() => {
      result.current.setOutputs((prev) => [...prev, ...bulkOutputs]);
    });

    await waitFor(() => {
      expect(result.current.archivedOutputs.length).toBeGreaterThan(0);
    });

    const archivedId = result.current.archivedOutputs[0]?.id;
    expect(archivedId).toBeTruthy();

    act(() => {
      result.current.restoreArchivedOutput(archivedId as string);
    });

    await waitFor(() => {
      expect(result.current.archivedOutputs.some((item) => item.id === archivedId)).toBe(false);
    });
    expect(result.current.outputs.some((item) => item.id === archivedId)).toBe(true);
  });

  it("hides curated references from all refs when delete is requested", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addCuratedReference("out-1");
    });
    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual(["out-1"]);
    });

    act(() => {
      result.current.deleteOutput("out-1");
      result.current.deleteOutput("out-2");
    });

    expect(mockDeleteOutputFromLifecycle).toHaveBeenCalledWith("out-2");
    expect(mockDeleteOutputFromLifecycle).not.toHaveBeenCalledWith("out-1");
    expect(mockUpdateOutputById).toHaveBeenCalledWith("out-1", expect.any(Function));
  });
});
