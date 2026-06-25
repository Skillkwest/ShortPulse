/**
 * Regression tests for AI Studio generated-output maintenance.
 * Verifies project-scoped generated outputs refresh after project bootstrap instead of blocking workspace restore.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import type { StudioOutput } from "../../types";
import {
  listVisibleGeneratedOutputs,
  resolveVisibleGenerationReconcile,
} from "../../logic/generatedMediaAuthority";
import { AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS } from "../../logic/audioCompanionArtRefreshPolicy";
import { resolveVideoPosterRepairsForOutputs } from "../../logic/videoPosterRepair";
import { useAiStudioGeneratedOutputMaintenance } from "../useAiStudioGeneratedOutputMaintenance";

vi.mock("../../logic/generatedMediaAuthority", () => ({
  listVisibleGeneratedOutputs: vi.fn(),
  resolveVisibleGenerationReconcile: vi.fn(),
}));

vi.mock("../../logic/videoPosterRepair", () => ({
  resolveVideoPosterRepairsForOutputs: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const listVisibleGeneratedOutputsMock = vi.mocked(listVisibleGeneratedOutputs);
const resolveVisibleGenerationReconcileMock = vi.mocked(resolveVisibleGenerationReconcile);
const resolveVideoPosterRepairsForOutputsMock = vi.mocked(resolveVideoPosterRepairsForOutputs);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const mockDocumentVisibility = (visibilityState: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibilityState);

const hydratedOutput: StudioOutput = {
  id: "generated:generation-1",
  generationId: "generation-1",
  taskId: "task-1",
  mode: "image",
  aspect: "1:1",
  model: "Seedream",
  prompt: "A project output",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  taskState: "success",
  queueState: "dispatched",
  previewUrl: "https://cdn.example.com/project-output.png",
  resultUrls: ["https://cdn.example.com/project-output.png"],
};

const renderMaintenanceHook = ({
  hasPendingWorkflowRestore = false,
  projectId = "project-1",
  initialOutputs = [],
  workspaceRuntimeKey = null,
}: {
  hasPendingWorkflowRestore?: boolean;
  projectId?: string | null;
  initialOutputs?: StudioOutput[];
  workspaceRuntimeKey?: string | null;
} = {}) =>
  renderHook(
    (props: {
      hasPendingWorkflowRestore: boolean;
      projectId: string | null;
      initialOutputs: StudioOutput[];
      workspaceRuntimeKey: string | null;
    }) => {
      const [outputs, setOutputs] = useState<StudioOutput[]>(props.initialOutputs);
      const maintenance = useAiStudioGeneratedOutputMaintenance({
        baseRuntimeAuthorityKey: props.projectId
          ? `project:${props.projectId}`
          : (props.workspaceRuntimeKey ?? "plain"),
        hasPendingWorkflowRestore: props.hasPendingWorkflowRestore,
        outputs,
        projectId: props.projectId,
        projectRouteRequested: Boolean(props.projectId),
        setOutputsState: setOutputs,
        workspaceRuntimeKey: props.workspaceRuntimeKey,
      });
      return {
        outputs,
        setOutputs,
        canonicalGeneratedHydrationSettled: maintenance.canonicalGeneratedHydrationSettled,
      };
    },
    {
      initialProps: {
        hasPendingWorkflowRestore,
        projectId,
        initialOutputs,
        workspaceRuntimeKey,
      },
    }
  );

describe("useAiStudioGeneratedOutputMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVisibleGeneratedOutputsMock.mockResolvedValue([]);
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
    resolveVideoPosterRepairsForOutputsMock.mockResolvedValue(new Map());
    fetchWithAuthMock.mockResolvedValue({ ok: true, status: 200 } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hydrates project-scoped generated outputs after workspace bootstrap is no longer pending", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook();

    expect(result.current.canonicalGeneratedHydrationSettled).toBe(false);

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenNthCalledWith(1, {
      projectId: "project-1",
      workspaceRuntimeKey: null,
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/generation/reconcile",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ projectId: "project-1" }),
        shortpulseLogScope: "generation",
        shortpulseRetryNetworkOnce: true,
      })
    );
  });

  it("nudges project-scoped recovery on project open and hydrates results from the follow-up projection read", async () => {
    listVisibleGeneratedOutputsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook();

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/generation/reconcile",
      expect.objectContaining({
        body: JSON.stringify({ projectId: "project-1" }),
      })
    );
    expect(listVisibleGeneratedOutputsMock).toHaveBeenNthCalledWith(1, {
      projectId: "project-1",
      workspaceRuntimeKey: null,
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenNthCalledWith(2, {
      projectId: "project-1",
      workspaceRuntimeKey: null,
    });
  });

  it("re-arms project hydration when restore later introduces unresolved generated shells", async () => {
    const restoredShell: StudioOutput = {
      ...hydratedOutput,
      prompt: "",
      generationId: undefined,
      taskId: undefined,
      taskState: "pending",
      previewUrl: undefined,
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      savedMediaIds: [],
    };
    listVisibleGeneratedOutputsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook();

    await waitFor(() => {
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
    expect(result.current.outputs).toEqual([]);

    act(() => {
      result.current.setOutputs([restoredShell]);
    });

    await waitFor(() => {
      expect(result.current.outputs).toEqual([
        expect.objectContaining({
          id: "generated:generation-1",
          generationId: "generation-1",
          taskState: "success",
          previewUrl: "https://cdn.example.com/project-output.png",
          resultUrls: ["https://cdn.example.com/project-output.png"],
        }),
      ]);
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
      projectId: "project-1",
      workspaceRuntimeKey: null,
    });
  });

  it("waits until workflow restore settles before hydrating project-scoped generated outputs", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValueOnce([hydratedOutput]);

    const { result, rerender } = renderMaintenanceHook({
      hasPendingWorkflowRestore: true,
    });

    expect(result.current.outputs).toEqual([]);
    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();
    expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);

    rerender({
      hasPendingWorkflowRestore: false,
      projectId: "project-1",
      initialOutputs: [],
      workspaceRuntimeKey: null,
    });

    expect(result.current.canonicalGeneratedHydrationSettled).toBe(false);

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
  });

  it("refreshes restored generated shells that have identity but no media payload", async () => {
    const restoredShell: StudioOutput = {
      ...hydratedOutput,
      prompt: "",
      generationId: undefined,
      taskState: "success",
      previewUrl: undefined,
      resultUrls: [],
    };
    listVisibleGeneratedOutputsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook({
      initialOutputs: [restoredShell],
    });

    await waitFor(() => {
      expect(result.current.outputs).toEqual([
        expect.objectContaining({
          id: "generated:generation-1",
          generationId: "generation-1",
          previewUrl: "https://cdn.example.com/project-output.png",
          resultUrls: ["https://cdn.example.com/project-output.png"],
        }),
      ]);
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
      projectId: "project-1",
      workspaceRuntimeKey: null,
      limit: 1,
      runtimeIdentities: [
        {
          generationId: "generation-1",
          requestId: "task-1",
          sourceRef: null,
        },
      ],
      includeWorkflowContext: false,
    });
  });

  it("scopes steady-state project generated-output sync to active runtime identities", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValue([]);

    renderMaintenanceHook({
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "pending:task-1",
          generationId: undefined,
          sourceRef: "source-runtime-1",
          taskId: "task-1",
          taskState: "running",
          companionArtStatus: null,
          resultUrls: [],
          previewUrl: undefined,
        },
      ],
    });

    await waitFor(() => {
      expect(listVisibleGeneratedOutputsMock).toHaveBeenNthCalledWith(1, {
        projectId: "project-1",
        workspaceRuntimeKey: null,
      });
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
        projectId: "project-1",
        workspaceRuntimeKey: null,
        limit: 1,
        runtimeIdentities: [
          {
            generationId: null,
            requestId: "task-1",
            sourceRef: "source-runtime-1",
          },
        ],
        includeWorkflowContext: false,
      });
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/generation/reconcile",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          runtimeIdentities: [
            {
              generationId: null,
              requestId: "task-1",
              sourceRef: "source-runtime-1",
            },
          ],
        }),
        shortpulseLogScope: "generation",
        shortpulseRetryNetworkOnce: true,
      })
    );
  });

  it("does not block canonical sync on a slow server reconcile nudge", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValue([]);
    fetchWithAuthMock.mockReturnValue(new Promise(() => undefined));

    renderMaintenanceHook({
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "pending:slow-reconcile",
          generationId: "generation-slow-reconcile",
          taskId: "task-slow-reconcile",
          taskState: "running",
          companionArtStatus: null,
          resultUrls: [],
          previewUrl: undefined,
        },
      ],
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/generation/reconcile",
        expect.objectContaining({
          body: JSON.stringify({
            runtimeIdentities: [
              {
                generationId: "generation-slow-reconcile",
                requestId: "task-slow-reconcile",
                sourceRef: null,
              },
            ],
          }),
        })
      );
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
        projectId: "project-1",
        workspaceRuntimeKey: null,
        limit: 1,
        runtimeIdentities: [
          {
            generationId: "generation-slow-reconcile",
            requestId: "task-slow-reconcile",
            sourceRef: null,
          },
        ],
        includeWorkflowContext: false,
      });
    });
  });

  it("scopes steady-state plain-session generated-output sync to active runtime identities without startup hydration", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValue([]);

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "plain-runtime-1",
          generationId: undefined,
          taskId: undefined,
          sourceRef: "source-plain-runtime-1",
          taskState: "pending",
          timestamp: "Waiting for server recovery...",
          companionArtStatus: null,
          previewUrl: undefined,
          resultUrls: [],
        },
      ],
    });

    await waitFor(() => {
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledTimes(1);
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
        projectId: null,
        workspaceRuntimeKey: null,
        limit: 1,
        runtimeIdentities: [
          {
            generationId: null,
            requestId: null,
            sourceRef: "source-plain-runtime-1",
          },
        ],
        includeWorkflowContext: false,
      });
    });
  });

  it("hydrates plain-session generated outputs by bounded workspace runtime key", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook({
      projectId: null,
      workspaceRuntimeKey: "session:session-1",
    });

    expect(result.current.canonicalGeneratedHydrationSettled).toBe(false);

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
      projectId: null,
      workspaceRuntimeKey: "session:session-1",
    });
  });

  it("does not install steady-state sync intervals when there are no sync candidates", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "settled-image-no-sync",
          generationId: "settled-generation-1",
          taskId: "settled-task-1",
          taskState: "success",
          companionArtStatus: null,
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("pauses steady-state generated-output sync while the document is hidden", async () => {
    const visibilitySpy = mockDocumentVisibility("hidden");

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "hidden-runtime-1",
          generationId: undefined,
          taskId: "task-hidden-1",
          taskState: "running",
          companionArtStatus: null,
          previewUrl: undefined,
          resultUrls: [],
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({
        projectId: null,
        workspaceRuntimeKey: null,
        limit: 1,
        runtimeIdentities: [
          {
            generationId: null,
            requestId: "task-hidden-1",
            sourceRef: null,
          },
        ],
        includeWorkflowContext: false,
      });
    });
  });

  it("pauses audio companion-art reconciliation while the document is hidden", async () => {
    const visibilitySpy = mockDocumentVisibility("hidden");

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "audio-hidden-1",
          mode: "audio",
          generationId: "audio-generation-1",
          taskId: "audio-task-1",
          taskState: "success",
          companionArtStatus: "pending",
          companionArtUrl: null,
          companionArtStoragePath: null,
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolveVisibleGenerationReconcileMock).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "audio-generation-1",
        requestId: "audio-task-1",
        projectId: null,
      });
    });
  });

  it("reconciles generated audio when companion art has durable storage but no signed url", async () => {
    resolveVisibleGenerationReconcileMock.mockResolvedValueOnce({
      generationId: "audio-generation-1",
      previewUrl: "https://cdn.example.com/audio.mp3",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: "https://signed.test/audio-cover.webp",
      companionArtStoragePath:
        "user-1/generations/audio/audio-generation-1/companion-art/cover.webp",
      companionArtStatus: "ready",
      previewStoragePath: "user-1/generations/audio/audio-generation-1/audio.mp3",
      fullStoragePath: "user-1/generations/audio/audio-generation-1/audio.mp3",
      resultUrls: ["https://cdn.example.com/audio.mp3"],
    });

    const { result } = renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "audio-generation-1",
          mode: "audio",
          generationId: "audio-generation-1",
          taskId: "audio-task-1",
          taskState: "success",
          previewUrl: "https://cdn.example.com/audio.mp3",
          resultUrls: ["https://cdn.example.com/audio.mp3"],
          companionArtStatus: "ready",
          companionArtUrl: null,
          companionArtStoragePath:
            "user-1/generations/audio/audio-generation-1/companion-art/cover.webp",
        },
      ],
    });

    await waitFor(() => {
      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "audio-generation-1",
        requestId: "audio-task-1",
        projectId: null,
      });
      expect(result.current.outputs[0]?.companionArtUrl).toBe(
        "https://signed.test/audio-cover.webp"
      );
    });
  });

  it("reconciles recent successful generated audio when companion art status is absent", async () => {
    const createdAt = new Date().toISOString();
    resolveVisibleGenerationReconcileMock.mockResolvedValueOnce({
      generationId: "audio-generation-2",
      previewUrl: "https://cdn.example.com/audio-2.mp3",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: "https://signed.test/audio-cover-2.webp",
      companionArtStoragePath:
        "user-1/generations/audio/audio-generation-2/companion-art/cover.webp",
      companionArtStatus: "ready",
      previewStoragePath: "user-1/generations/audio/audio-generation-2/audio.mp3",
      fullStoragePath: "user-1/generations/audio/audio-generation-2/audio.mp3",
      resultUrls: ["https://cdn.example.com/audio-2.mp3"],
    });

    const { result } = renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "audio-generation-2",
          mode: "audio",
          generationId: "audio-generation-2",
          taskId: "audio-task-2",
          taskState: "success",
          createdAt,
          timestamp: "Just now",
          previewUrl: "https://cdn.example.com/audio-2.mp3",
          resultUrls: ["https://cdn.example.com/audio-2.mp3"],
          companionArtStatus: null,
          companionArtUrl: null,
          companionArtStoragePath: null,
        },
      ],
    });

    await waitFor(() => {
      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "audio-generation-2",
        requestId: "audio-task-2",
        projectId: null,
      });
      expect(result.current.outputs[0]?.companionArtStoragePath).toBe(
        "user-1/generations/audio/audio-generation-2/companion-art/cover.webp"
      );
    });
  });

  it("stops status-only generated audio companion-art reconciliation after the retry budget", async () => {
    vi.useFakeTimers();
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);

    const { unmount } = renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "audio-generation-stale",
          mode: "audio",
          generationId: "audio-generation-stale",
          taskId: "audio-task-stale",
          taskState: "success",
          previewUrl: "https://cdn.example.com/audio-stale.mp3",
          resultUrls: ["https://cdn.example.com/audio-stale.mp3"],
          companionArtStatus: "pending",
          companionArtUrl: null,
          companionArtStoragePath: null,
        },
      ],
    });

    try {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledTimes(1);

      for (
        let attempt = 1;
        attempt < AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5_000);
        });
      }

      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledTimes(
        AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledTimes(
        AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS
      );
    } finally {
      unmount();
    }
  });

  it("pauses generated-video poster repair while the document is hidden", async () => {
    const visibilitySpy = mockDocumentVisibility("hidden");

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "generated-video-hidden-1",
          mode: "video",
          generationId: "video-generation-1",
          taskId: "video-task-1",
          taskState: "success",
          previewPosterUrl: null,
          previewPosterStoragePath: null,
          previewUrl: "https://cdn.example.com/video.mp4",
          resultUrls: ["https://cdn.example.com/video.mp4"],
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolveVisibleGenerationReconcileMock).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(resolveVisibleGenerationReconcileMock).toHaveBeenCalledWith({
        generationId: "video-generation-1",
        requestId: "video-task-1",
        projectId: null,
      });
    });
  });

  it("pauses storage-backed video poster repair while the document is hidden", async () => {
    const visibilitySpy = mockDocumentVisibility("hidden");

    renderMaintenanceHook({
      projectId: null,
      initialOutputs: [
        {
          ...hydratedOutput,
          id: "storage-video-hidden-1",
          mode: "video",
          mediaSource: "library",
          generationId: undefined,
          taskId: undefined,
          taskState: "success",
          savedMediaIds: ["media-video-hidden-1"],
          previewPosterUrl: null,
          previewPosterStoragePath: null,
          previewUrl: "https://cdn.example.com/storage-video.mp4",
          previewStoragePath: "user-1/videos/storage-video-hidden-1.mp4",
          fullStoragePath: "user-1/videos/storage-video-hidden-1.mp4",
          resultUrls: ["https://cdn.example.com/storage-video.mp4"],
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolveVideoPosterRepairsForOutputsMock).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(resolveVideoPosterRepairsForOutputsMock).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "storage-video-hidden-1",
          savedMediaIds: ["media-video-hidden-1"],
        }),
      ]);
    });
  });
});
