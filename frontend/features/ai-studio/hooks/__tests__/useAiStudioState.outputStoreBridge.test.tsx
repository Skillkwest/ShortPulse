import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  getAiStudioOutputSnapshot,
  resetAiStudioOutputStore,
  setAiStudioOutputStoreSnapshot,
} from "../aiStudioOutputStore";
import { useAiStudioState } from "../useAiStudioState";
import * as ingestionPreparation from "../../reference-ingestion/prepareLibraryMediaIngestionPayload";

const mockUpdateOutputById = vi.fn();
const mockFindOutputById = vi.fn<(id: string) => StudioOutput | null>(() => null);
const mockDeleteOutputFromLifecycle = vi.fn();
const mockNotifyGenerationFailure = vi.fn();
const mockUpdateOutputPrompt = vi.fn();
const listVisibleGeneratedOutputsMock = vi.fn(
  async (options?: unknown): Promise<StudioOutput[]> => {
    void options;
    return [];
  }
);
const resolveVisibleGenerationReconcileMock = vi.fn(
  async (
    options?: unknown
  ): Promise<{
    generationId: string;
    previewUrl: string | null;
    previewPosterUrl?: string | null;
    previewPosterStoragePath?: string | null;
    previewStoragePath: string | null;
    fullStoragePath: string | null;
    resultUrls: string[];
  } | null> => {
    void options;
    return null;
  }
);
const resolveVideoPosterRepairsForOutputsMock = vi.fn(
  async (outputs?: unknown): Promise<Map<string, unknown>> => {
    void outputs;
    return new Map();
  }
);
const generationPromptComposerArgsMock = vi.fn();
const EDIT_REFERENCE_INPUTS = {
  referenceImageUrl: "https://example.com/edit-primary.png",
  extraImageUrls: [
    "https://example.com/edit-extra-1.png",
    "https://example.com/edit-extra-2.png",
    null,
  ] as [string | null, string | null, string | null],
};
const VIDEO_REFERENCE_INPUTS = {
  referenceImageUrl: "https://example.com/video-primary.png",
  extraImageUrls: [
    "https://example.com/video-extra-1.png",
    "https://example.com/video-extra-2.png",
    null,
  ] as [string | null, string | null, string | null],
};
const resolveReferenceInputsForToolMock = vi.fn((tool: string | null) => {
  if (tool === "video" || tool === "kling") return VIDEO_REFERENCE_INPUTS;
  return EDIT_REFERENCE_INPUTS;
});
const getSignedMediaUrlMock = vi.fn();
const refreshSupabaseSignedUrlIfNeededMock = vi.fn();
const abandonGenerationOutputMock = vi.fn(async (args: unknown) => {
  void args;
  return undefined;
});

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

vi.mock("../../utils/imageUpload", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/imageUpload")>("../../utils/imageUpload");
  return {
    ...actual,
    refreshSupabaseSignedUrlIfNeeded: (...args: unknown[]) =>
      refreshSupabaseSignedUrlIfNeededMock(...args),
  };
});

vi.mock("../../logic/generationAbandonment", () => ({
  canAbandonGenerationOutput: (output: StudioOutput | null | undefined) =>
    Boolean(output?.generationId || output?.sourceRef || output?.taskId),
  abandonGenerationOutput: (args: unknown) => abandonGenerationOutputMock(args),
}));

vi.mock("../useAiStudioReferenceSelectionState", () => ({
  useAiStudioReferenceSelectionState: () => ({
    selectedTool: "create",
    setSelectedTool: vi.fn(),
    showCreateTools: true,
    setShowCreateTools: vi.fn(),
    videoReferenceImageUrl: VIDEO_REFERENCE_INPUTS.referenceImageUrl,
    motionReferenceVideoUrl: null,
    setMotionReferenceVideoUrl: vi.fn(),
    useReferenceImageIndicator: false,
    setUseReferenceImageIndicator: vi.fn(),
    detailOutputId: null,
    setDetailOutputId: vi.fn(),
    referenceImageUrl: EDIT_REFERENCE_INPUTS.referenceImageUrl,
    setReferenceImageUrl: vi.fn(),
    extraImageUrls: EDIT_REFERENCE_INPUTS.extraImageUrls,
    setExtraImageUrl: vi.fn(),
    clearReferenceImages: vi.fn(),
    toggleReferenceIndicator: vi.fn(),
    resolveReferenceInputsForTool: resolveReferenceInputsForToolMock,
    setAuthorityState: vi.fn(),
    getAuthorityState: vi.fn((authorityKey: string) => {
      void authorityKey;
      return {
        selectedTool: "create",
        showCreateTools: true,
        referenceImageUrl: EDIT_REFERENCE_INPUTS.referenceImageUrl,
        extraImageUrls: EDIT_REFERENCE_INPUTS.extraImageUrls,
        motionReferenceVideoUrl: null,
        useReferenceImageIndicator: false,
        detailOutputId: null,
      };
    }),
    isModelModalOpen: false,
    modelModalAnchor: null,
    modelModalContext: null,
    setIsModelModalOpen: vi.fn(),
    setModelModalAnchor: vi.fn(),
    openModelModal: vi.fn(),
    closeModelModal: vi.fn(),
  }),
}));

vi.mock("../useAiStudioWorkflowSettings", () => ({
  useAiStudioWorkflowSettings: () => ({
    hasPendingWorkflowRestore: false,
  }),
}));

vi.mock("../../logic/generatedMediaAuthority", () => ({
  listVisibleGeneratedOutputs: (options?: unknown) => listVisibleGeneratedOutputsMock(options),
  resolveVisibleGenerationReconcile: (options?: unknown) =>
    resolveVisibleGenerationReconcileMock(options),
}));

vi.mock("../../logic/videoPosterRepair", () => ({
  resolveVideoPosterRepairsForOutputs: (outputs?: unknown) =>
    resolveVideoPosterRepairsForOutputsMock(outputs),
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
  useAiStudioGenerationPromptComposer: (args: unknown) => {
    generationPromptComposerArgsMock(args);
    return {
      generateOutput: vi.fn(),
      regenerateOutput: vi.fn(),
    };
  },
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
    vi.unstubAllEnvs();
    resetAiStudioOutputStore();
    listVisibleGeneratedOutputsMock.mockClear();
    resolveVisibleGenerationReconcileMock.mockClear();
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
    resolveVideoPosterRepairsForOutputsMock.mockClear();
    resolveVideoPosterRepairsForOutputsMock.mockResolvedValue(new Map());
    mockUpdateOutputById.mockClear();
    mockUpdateOutputById.mockImplementation(
      (id: string, updater: (item: StudioOutput) => StudioOutput) => {
        const snapshot = getAiStudioOutputSnapshot();
        const current = snapshot.outputById[id];
        if (!current) return;
        setAiStudioOutputStoreSnapshot({
          outputOrder: snapshot.outputOrder,
          outputById: {
            ...snapshot.outputById,
            [id]: updater(current),
          },
          archivedOutputOrder: snapshot.archivedOutputOrder,
          archivedOutputById: snapshot.archivedOutputById,
        });
      }
    );
    mockFindOutputById.mockClear();
    mockFindOutputById.mockImplementation((id: string) => {
      const snapshot = getAiStudioOutputSnapshot();
      return snapshot.outputById[id] ?? snapshot.archivedOutputById[id] ?? null;
    });
    mockDeleteOutputFromLifecycle.mockClear();
    mockNotifyGenerationFailure.mockClear();
    mockUpdateOutputPrompt.mockClear();
    abandonGenerationOutputMock.mockClear();
    generationPromptComposerArgsMock.mockClear();
    resolveReferenceInputsForToolMock.mockClear();
    getSignedMediaUrlMock.mockReset();
    refreshSupabaseSignedUrlIfNeededMock.mockReset();
    getSignedMediaUrlMock.mockResolvedValue(null);
    refreshSupabaseSignedUrlIfNeededMock.mockImplementation(async (value: string) => value);
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

  it("hydrates project-scoped generated outputs when a project id is active", async () => {
    renderHook(() => useAiStudioState({ projectId: "project-1" }), { wrapper: strictWrapper });

    await waitFor(() => {
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({ projectId: "project-1" });
    });
  });

  it("keeps project generated outputs synced from canonical projection while work is in flight", async () => {
    vi.useFakeTimers();
    const hydratedOutput = makeOutput("generated:gen-1", {
      generationId: "gen-1",
      taskId: "req-1",
      taskState: "success",
      mediaSource: "generated",
      previewUrl: "https://cdn.test/generated.png",
      resultUrls: ["https://cdn.test/generated.png"],
    });
    listVisibleGeneratedOutputsMock.mockImplementation(
      async (): Promise<StudioOutput[]> =>
        listVisibleGeneratedOutputsMock.mock.calls.length > 1 ? [hydratedOutput] : []
    );

    const { result, unmount } = renderHook(() => useAiStudioState({ projectId: "project-1" }), {
      wrapper: strictWrapper,
    });

    try {
      act(() => {
        result.current.setOutputs([
          makeOutput("local-output", {
            generationId: "gen-1",
            taskId: "req-1",
            taskState: "running",
            mediaSource: "generated",
            previewUrl: undefined,
            resultUrls: [],
          }),
        ]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(result.current.outputs[0]).toEqual(
        expect.objectContaining({
          id: "local-output",
          generationId: "gen-1",
          taskState: "success",
          previewUrl: "https://cdn.test/generated.png",
          resultUrls: ["https://cdn.test/generated.png"],
        })
      );
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("skips user-global generated-output hydration while a project route is still pending", async () => {
    renderHook(() => useAiStudioState({ projectRouteRequested: true }), {
      wrapper: strictWrapper,
    });

    await act(async () => {});

    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();
  });

  it("keeps plain-session startup empty by default", async () => {
    renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    await act(async () => {});

    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();
  });

  it("repairs posterless restored generated videos without global plain-session hydration", async () => {
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-video-1",
      previewUrl: "https://cdn.test/video.mp4",
      previewPosterUrl: "https://cdn.test/poster_720.jpg",
      previewPosterStoragePath: "user-1/variants/videos/gen-video-1/poster_720.jpg",
      previewStoragePath: "user-1/generations/videos/gen-video-1.mp4",
      fullStoragePath: "user-1/generations/videos/gen-video-1.mp4",
      resultUrls: ["https://cdn.test/video.mp4"],
    });

    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([
        makeOutput("generated-video-1", {
          mode: "video",
          generationId: "gen-video-1",
          taskId: "req-video-1",
          taskState: undefined,
          mediaSource: "generated",
          previewUrl: "https://cdn.test/video.mp4",
          previewStoragePath: "user-1/generations/videos/gen-video-1.mp4",
          fullStoragePath: "user-1/generations/videos/gen-video-1.mp4",
          resultUrls: ["https://cdn.test/video.mp4"],
        }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.outputs[0]).toEqual(
        expect.objectContaining({
          previewPosterUrl: "https://cdn.test/poster_720.jpg",
          previewPosterStoragePath: "user-1/variants/videos/gen-video-1/poster_720.jpg",
          previewStoragePath: "user-1/generations/videos/gen-video-1.mp4",
          fullStoragePath: "user-1/generations/videos/gen-video-1.mp4",
        })
      );
    });
    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();
    expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
      generationId: "gen-video-1",
      requestId: "req-video-1",
      projectId: null,
    });
  });

  it("repairs storage-backed restored videos from media poster variants", async () => {
    resolveVideoPosterRepairsForOutputsMock.mockResolvedValue(
      new Map([
        [
          "storage-video-1",
          {
            outputId: "storage-video-1",
            previewPosterUrl: "https://cdn.test/storage-poster.jpg",
            previewPosterStoragePath: "user-1/variants/videos/media-1/poster_720.jpg",
            previewStoragePath: "user-1/videos/storage-video-1.mp4",
            fullStoragePath: "user-1/videos/storage-video-1.mp4",
            previewUrl: "https://cdn.test/storage-video.mp4",
            resultUrls: ["https://cdn.test/storage-video.mp4"],
          },
        ],
      ])
    );

    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([
        makeOutput("storage-video-1", {
          mode: "video",
          mediaSource: "library",
          savedMediaIds: ["media-1"],
          previewUrl: "https://cdn.test/storage-video.mp4",
          previewStoragePath: "user-1/videos/storage-video-1.mp4",
          fullStoragePath: "user-1/videos/storage-video-1.mp4",
        }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.outputs[0]).toEqual(
        expect.objectContaining({
          previewPosterUrl: "https://cdn.test/storage-poster.jpg",
          previewPosterStoragePath: "user-1/variants/videos/media-1/poster_720.jpg",
          previewStoragePath: "user-1/videos/storage-video-1.mp4",
          fullStoragePath: "user-1/videos/storage-video-1.mp4",
        })
      );
    });

    expect(resolveVideoPosterRepairsForOutputsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "storage-video-1",
        savedMediaIds: ["media-1"],
      }),
    ]);
  });

  it("keeps Standard and Pulse create prompts isolated across mode toggles", () => {
    const { result, rerender } = renderHook(
      ({ expertCreateMode }: { expertCreateMode: "standard" | "pulse" }) =>
        useAiStudioState({ expertCreateMode }),
      {
        initialProps: { expertCreateMode: "standard" as "standard" | "pulse" },
        wrapper: strictWrapper,
      }
    );

    act(() => {
      result.current.setPrompt("Standard prompt draft");
    });

    expect(result.current.activeCreatePrompt).toBe("Standard prompt draft");
    expect(result.current.standardPrompt).toBe("Standard prompt draft");
    expect(result.current.pulsePrompt).toBe("");

    rerender({ expertCreateMode: "pulse" });

    expect(result.current.activeCreatePrompt).toBe("");

    act(() => {
      result.current.setPrompt("Pulse final artifact");
    });

    expect(result.current.activeCreatePrompt).toBe("Pulse final artifact");
    expect(result.current.standardPrompt).toBe("Standard prompt draft");
    expect(result.current.pulsePrompt).toBe("Pulse final artifact");

    rerender({ expertCreateMode: "standard" });

    expect(result.current.activeCreatePrompt).toBe("Standard prompt draft");
    expect(result.current.standardPrompt).toBe("Standard prompt draft");
    expect(result.current.pulsePrompt).toBe("Pulse final artifact");
  });

  it("keeps Standard and Pulse prompts isolated while the right rail remains global", async () => {
    const { result } = renderHook(
      () => {
        const [expertCreateMode, setExpertCreateMode] = React.useState<"standard" | "pulse">(
          "standard"
        );
        const studio = useAiStudioState({
          expertCreateMode,
          setExpertCreateMode,
        });

        return {
          ...studio,
          setExpertCreateMode,
        };
      },
      { wrapper: strictWrapper }
    );

    act(() => {
      result.current.setPrompt("Standard draft");
      result.current.setOutputs([
        makeOutput("standard-out", { previewUrl: "https://example.com/standard.png" }),
      ]);
      result.current.setActiveOutputId("standard-out");
      result.current.addCuratedReference("standard-out");
    });

    await waitFor(() => {
      expect(result.current.outputs.map((item) => item.id)).toEqual(["standard-out"]);
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["standard-out"]);
    });
    expect(result.current.getAgentContext({ includeActiveOutput: true }).media?.[0]?.url).toBe(
      "https://example.com/standard.png"
    );

    act(() => {
      result.current.setExpertCreateMode("pulse");
    });

    await waitFor(() => {
      expect(result.current.outputs.map((item) => item.id)).toEqual(["standard-out"]);
      expect(result.current.activeOutputId).toBe("standard-out");
      expect(result.current.curatedReferenceIds).toEqual(["standard-out"]);
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["standard-out"]);
    });
    expect(result.current.activeCreatePrompt).toBe("");
    expect(result.current.getAgentContext({ includeActiveOutput: true }).media?.[0]?.url).toBe(
      "https://example.com/standard.png"
    );

    act(() => {
      result.current.setPrompt("Pulse artifact");
      result.current.setOutputs((previous) => [
        makeOutput("pulse-out", { previewUrl: "https://example.com/pulse.png" }),
        ...previous,
      ]);
      result.current.setActiveOutputId("pulse-out");
      result.current.addCuratedReference("pulse-out");
    });

    await waitFor(() => {
      expect(result.current.outputs.map((item) => item.id)).toEqual(["pulse-out", "standard-out"]);
      expect(result.current.curatedReferenceIds).toEqual(["standard-out", "pulse-out"]);
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["pulse-out", "standard-out"]);
    });
    expect(result.current.getAgentContext({ includeActiveOutput: true }).media?.[0]?.url).toBe(
      "https://example.com/pulse.png"
    );

    act(() => {
      result.current.setExpertCreateMode("standard");
    });

    await waitFor(() => {
      expect(result.current.activeCreatePrompt).toBe("Standard draft");
      expect(result.current.outputs.map((item) => item.id)).toEqual(["pulse-out", "standard-out"]);
      expect(result.current.activeOutputId).toBe("pulse-out");
      expect(result.current.curatedReferenceIds).toEqual(["standard-out", "pulse-out"]);
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["pulse-out", "standard-out"]);
    });
    expect(result.current.getAgentContext({ includeActiveOutput: true }).media?.[0]?.url).toBe(
      "https://example.com/pulse.png"
    );

    act(() => {
      result.current.setExpertCreateMode("pulse");
    });

    await waitFor(() => {
      expect(result.current.activeCreatePrompt).toBe("Pulse artifact");
      expect(result.current.outputs.map((item) => item.id)).toEqual(["pulse-out", "standard-out"]);
      expect(result.current.activeOutputId).toBe("pulse-out");
      expect(result.current.curatedReferenceIds).toEqual(["standard-out", "pulse-out"]);
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["pulse-out", "standard-out"]);
    });
    expect(result.current.getAgentContext({ includeActiveOutput: true }).media?.[0]?.url).toBe(
      "https://example.com/pulse.png"
    );
  });

  it("restores separate Standard and Pulse prompts while keeping hydrated outputs global", async () => {
    const source = renderHook(
      () => {
        const [expertCreateMode, setExpertCreateMode] = React.useState<"standard" | "pulse">(
          "standard"
        );
        const [activePulsePresetId, setActivePulsePresetId] = React.useState<string | null>(null);
        const studio = useAiStudioState({
          expertCreateMode,
          activePulsePresetId,
          setExpertCreateMode,
          setActivePulsePresetId,
        });

        return {
          ...studio,
          setExpertCreateMode,
          setActivePulsePresetId,
        };
      },
      { wrapper: strictWrapper }
    );

    act(() => {
      source.result.current.setPrompt("Standard restore draft");
      source.result.current.setExpertCreateMode("pulse");
      source.result.current.setActivePulsePresetId("pulse-restore");
    });

    act(() => {
      source.result.current.setPrompt("Pulse restored artifact");
      source.result.current.setOutputs([
        makeOutput("pulse-restored-out", {
          previewUrl: "https://example.com/pulse-restored.png",
        }),
      ]);
      source.result.current.setActiveOutputId("pulse-restored-out");
      source.result.current.addCuratedReference("pulse-restored-out");
    });

    const snapshot = source.result.current.buildSessionSnapshot({
      sessionId: "session-restore-1",
      agentRuntime: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
    });

    const restored = renderHook(
      () => {
        const [expertCreateMode, setExpertCreateMode] = React.useState<"standard" | "pulse">(
          "standard"
        );
        const [activePulsePresetId, setActivePulsePresetId] = React.useState<string | null>(null);
        const studio = useAiStudioState({
          expertCreateMode,
          activePulsePresetId,
          setExpertCreateMode,
          setActivePulsePresetId,
        });

        return {
          ...studio,
          setExpertCreateMode,
          setActivePulsePresetId,
        };
      },
      { wrapper: strictWrapper }
    );

    act(() => {
      restored.result.current.hydrateFromSessionSnapshot(snapshot);
    });

    await waitFor(() => {
      expect(restored.result.current.activeCreatePrompt).toBe("Pulse restored artifact");
      expect(restored.result.current.standardPrompt).toBe("Standard restore draft");
      expect(restored.result.current.pulsePrompt).toBe("Pulse restored artifact");
      expect(restored.result.current.outputs.map((item) => item.id)).toEqual([
        "pulse-restored-out",
      ]);
      expect(restored.result.current.activeOutputId).toBe("pulse-restored-out");
    });

    act(() => {
      restored.result.current.setExpertCreateMode("standard");
    });

    expect(restored.result.current.activeCreatePrompt).toBe("Standard restore draft");
    expect(restored.result.current.standardPrompt).toBe("Standard restore draft");
    expect(restored.result.current.pulsePrompt).toBe("Pulse restored artifact");
    expect(restored.result.current.outputs.map((item) => item.id)).toEqual(["pulse-restored-out"]);
    expect(restored.result.current.activeOutputId).toBe("pulse-restored-out");

    act(() => {
      restored.result.current.setExpertCreateMode("pulse");
    });

    expect(restored.result.current.activeCreatePrompt).toBe("Pulse restored artifact");
    expect(restored.result.current.standardPrompt).toBe("Standard restore draft");
    expect(restored.result.current.pulsePrompt).toBe("Pulse restored artifact");
    expect(restored.result.current.outputs.map((item) => item.id)).toEqual(["pulse-restored-out"]);
    expect(restored.result.current.activeOutputId).toBe("pulse-restored-out");
  });

  it("clears outputs, active selection, and quick slots when runtime authority changes to a pending project route", async () => {
    const { result, rerender } = renderHook(
      ({ projectRouteRequested, sessionId }) =>
        useAiStudioState({ projectRouteRequested, sessionId }),
      {
        wrapper: strictWrapper,
        initialProps: {
          projectRouteRequested: false,
          sessionId: "session-1" as string | null,
        },
      }
    );

    act(() => {
      result.current.setOutputs([makeOutput("out-1")]);
      result.current.addCuratedReference("out-1");
      result.current.setActiveOutputId("out-1");
    });

    await waitFor(() => {
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["out-1"]);
    });

    rerender({
      projectRouteRequested: true,
      sessionId: "session-1",
    });

    await waitFor(() => {
      expect(result.current.outputs).toEqual([]);
      expect(result.current.curatedReferenceIds).toEqual([]);
      expect(result.current.removedFromAllRefsIds).toEqual([]);
      expect(result.current.activeOutputId).toBeNull();
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual([]);
      expect(getAiStudioOutputSnapshot().archivedOutputOrder).toEqual([]);
    });
  });

  it("allows plain-session generated-output hydration when explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_PLAIN_SESSION_GENERATED_OUTPUT_HYDRATION_ENABLED", "true");
    renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    await waitFor(() => {
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledTimes(1);
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({ projectId: null });
    });
  });

  it("publishes raw task-state indexes without reclassifying success or failure", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([
        makeOutput("out-pending", { taskState: "pending" }),
        makeOutput("out-success", { taskState: "success" }),
        makeOutput("out-fail", { taskState: "fail" }),
      ]);
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.indexes.inFlightIds.has("out-pending")).toBe(true);
      expect(snapshot.indexes.inFlightIds.has("out-success")).toBe(false);
      expect(snapshot.indexes.inFlightIds.has("out-fail")).toBe(false);
      expect(snapshot.indexes.failedIds.has("out-fail")).toBe(true);
      expect(snapshot.indexes.failedIds.has("out-pending")).toBe(false);
      expect(snapshot.indexes.failedIds.has("out-success")).toBe(false);
    });
  });

  it("filters create/text submission references from edit drop-zone inputs", () => {
    renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    const composerArgs = generationPromptComposerArgsMock.mock.calls[0]?.[0] as Parameters<
      typeof useAiStudioState
    >[0] & {
      resolveReferenceInputsForTool: (tool: string | null) => {
        referenceImageUrl: string | null;
        extraImageUrls: [string | null, string | null, string | null];
      };
    };
    const resolveSubmissionInputs = composerArgs.resolveReferenceInputsForTool;

    expect(resolveSubmissionInputs("create")).toEqual({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
    });
    expect(resolveSubmissionInputs("text")).toEqual({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
    });
    expect(resolveSubmissionInputs("edit")).toEqual(EDIT_REFERENCE_INPUTS);
    expect(resolveSubmissionInputs("image")).toEqual(EDIT_REFERENCE_INPUTS);
    expect(resolveSubmissionInputs("video")).toEqual(VIDEO_REFERENCE_INPUTS);
    expect(resolveSubmissionInputs("kling")).toEqual(VIDEO_REFERENCE_INPUTS);
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

  it("preserves explicit placeholder model metadata for sound workflows", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    let placeholderId: string | null = null;
    act(() => {
      placeholderId = result.current.insertOptimisticGenerationPlaceholder({
        prompt: "Convert this voice",
        modeOverride: "audio",
        selectedToolOverride: "text-to-speech",
        modelLabelOverride: "ElevenLabs Voiceover",
        modelIdOverride: null,
        providerOverride: "elevenlabs",
      });
    });

    expect(placeholderId).toBeTruthy();
    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      const item = snapshot.outputById[placeholderId as string];
      expect(item?.mode).toBe("audio");
      expect(item?.model).toBe("ElevenLabs Voiceover");
      expect(item?.modelId).toBeUndefined();
      expect(item?.provider).toBe("elevenlabs");
    });
  });

  it("filters ready reference-grid ids when outputs leave active and archived collections", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([makeOutput("out-1")]);
    });

    await waitFor(() => {
      expect(getAiStudioOutputSnapshot().outputOrder).toEqual(["out-1"]);
    });

    act(() => {
      result.current.onReferenceOutputMediaLoaded("out-1");
    });

    expect(result.current.referenceGridReadyOutputIds.has("out-1")).toBe(true);

    act(() => {
      result.current.setOutputs([]);
    });

    await waitFor(() => {
      expect(result.current.referenceGridReadyOutputIds.has("out-1")).toBe(false);
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

  it("refreshes media-library ingest URLs from storage paths while preserving metadata labels", async () => {
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/ref-fresh.png") {
        return "https://signed.example.com/previews/ref-fresh.png";
      }
      if (storagePath === "user-1/full/ref-fresh.png") {
        return "https://signed.example.com/full/ref-fresh.png";
      }
      return null;
    });

    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addLibraryMediaReference({
        id: "media-fresh",
        url: "https://expired.example.com/ref-fresh.png",
        fileType: "image",
        filename: "ref-fresh.png",
        promptText: "Fresh reference prompt",
        source: "upload",
        previewStoragePath: " user-1/previews/ref-fresh.png ",
        fullStoragePath: " user-1/full/ref-fresh.png ",
      });
    });

    await waitFor(() => {
      const snapshot = getAiStudioOutputSnapshot();
      expect(snapshot.outputOrder.length).toBe(1);
      const outputId = snapshot.outputOrder[0];
      const output = snapshot.outputById[outputId];
      expect(output.previewUrl).toBe("https://signed.example.com/previews/ref-fresh.png");
      expect(output.resultUrls).toEqual(["https://signed.example.com/full/ref-fresh.png"]);
      expect(output.previewStoragePath).toBe("user-1/previews/ref-fresh.png");
      expect(output.fullStoragePath).toBe("user-1/full/ref-fresh.png");
      expect(output.savedMediaIds).toEqual(["media-fresh"]);
      expect(output.prompt).toBe("Fresh reference prompt");
      expect(output.model).toBe("ref-fresh.png");
    });

    expect(getSignedMediaUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/previews/ref-fresh.png",
        forceRefresh: true,
      })
    );
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePath: "user-1/full/ref-fresh.png",
        forceRefresh: true,
      })
    );
    expect(refreshSupabaseSignedUrlIfNeededMock).not.toHaveBeenCalled();
  });

  it("keeps the optimistic media-library card visible when payload prep refresh fails", async () => {
    const prepareSpy = vi
      .spyOn(ingestionPreparation, "prepareLibraryMediaIngestionPayload")
      .mockRejectedValueOnce(new Error("prep failed"));
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.addLibraryMediaReference({
        id: "media-error",
        url: "https://expired.example.com/ref-error.png",
        fileType: "image",
        filename: "ref-error.png",
        promptText: "Error prompt",
        source: "upload",
      });
    });

    await waitFor(() => {
      expect(result.current.outputs).toHaveLength(1);
    });
    expect(result.current.uiError).toBeNull();
    expect(result.current.outputs[0]?.prompt).toBe("Error prompt");
    expect(result.current.outputs[0]?.previewUrl).toBe("https://expired.example.com/ref-error.png");
    prepareSpy.mockRestore();
  });

  it("supports media-library add -> quick-slot reorder/remove while large all-refs collections stay active", async () => {
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
      expect(result.current.outputs.length).toBe(522);
    });
    expect(result.current.archivedOutputs).toEqual([]);
  });

  it("suppresses curated references from all refs when delete is requested", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([makeOutput("out-1"), makeOutput("out-2")]);
    });
    await waitFor(() => {
      expect(result.current.outputs.map((item) => item.id)).toEqual(["out-1", "out-2"]);
    });

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
    expect(mockUpdateOutputById).not.toHaveBeenCalledWith("out-1", expect.any(Function));
    await waitFor(() => {
      expect(result.current.removedFromAllRefsIds).toEqual(["out-1"]);
      expect(
        result.current.outputs.find((item) => item.id === "out-1")?.hiddenInReferenceGrid
      ).not.toBe(true);
    });
  });

  it("finalizes suppressed curated deletions when quick-slot linkage is removed", async () => {
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([makeOutput("out-1"), makeOutput("out-2")]);
      result.current.addCuratedReference("out-1");
    });

    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual(["out-1"]);
    });

    act(() => {
      result.current.deleteOutput("out-1");
    });

    await waitFor(() => {
      expect(result.current.removedFromAllRefsIds).toEqual(["out-1"]);
    });
    expect(mockDeleteOutputFromLifecycle).not.toHaveBeenCalledWith("out-1");

    act(() => {
      result.current.removeCuratedReference("out-1");
    });

    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual([]);
      expect(result.current.removedFromAllRefsIds).toEqual([]);
    });
    expect(mockDeleteOutputFromLifecycle).toHaveBeenCalledWith("out-1");
  });

  it("hides failed generated outputs and persists abandonment on delete", async () => {
    const failedGenerated = makeOutput("out-failed-generated", {
      taskState: "fail",
      errorMessage: "Unknown error",
      mediaSource: "generated",
      generationId: "gen-failed-1",
    });
    const { result } = renderHook(() => useAiStudioState(), { wrapper: strictWrapper });

    act(() => {
      result.current.setOutputs([failedGenerated]);
      result.current.addCuratedReference(failedGenerated.id);
    });

    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual([failedGenerated.id]);
    });

    act(() => {
      result.current.deleteOutput(failedGenerated.id);
    });

    expect(abandonGenerationOutputMock).toHaveBeenCalledWith({
      output: expect.objectContaining({
        id: failedGenerated.id,
        generationId: failedGenerated.generationId,
      }),
    });
    await waitFor(() => {
      expect(result.current.curatedReferenceIds).toEqual([]);
      expect(mockDeleteOutputFromLifecycle).toHaveBeenCalledWith(failedGenerated.id);
    });
  });
});
