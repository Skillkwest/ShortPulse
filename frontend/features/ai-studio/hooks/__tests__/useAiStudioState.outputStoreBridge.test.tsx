import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { getAiStudioOutputSnapshot, resetAiStudioOutputStore } from "../aiStudioOutputStore";
import { useAiStudioState } from "../useAiStudioState";

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
    updateOutputById: vi.fn(),
    findOutputById: vi.fn(() => null),
    deleteOutput: vi.fn(),
    notifyGenerationFailure: vi.fn(),
    updateOutputPrompt: vi.fn(),
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
});
