import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "../useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "../useAiStudioProjectWorkspaceRestoreHydration";
import { useAiStudioSessionAutosave } from "../useAiStudioSessionAutosave";
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
} from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { resetAiStudioOutputStore } from "../aiStudioOutputStore";
import { resetAiStudioProjectWorkspaceSnapshotViaApi } from "../../logic/projectWorkspaceApiClient";

vi.mock("../useAiStudioProjectWorkspaceRestoreCandidate", () => ({
  useAiStudioProjectWorkspaceRestoreCandidate: vi.fn(() => ({
    status: "ready",
    result: "no_snapshot",
    snapshot: null,
    source: "none",
    error: null,
    retry: vi.fn(),
  })),
}));

const restoreHydrationMock = vi.fn();
vi.mock("../useAiStudioProjectWorkspaceRestoreHydration", () => ({
  useAiStudioProjectWorkspaceRestoreHydration: vi.fn((params) => restoreHydrationMock(params)),
}));

const sessionAutosaveMock = vi.fn();
vi.mock("../useAiStudioSessionAutosave", () => ({
  useAiStudioSessionAutosave: vi.fn((params) => sessionAutosaveMock(params)),
}));

vi.mock("../aiStudioOutputStore", () => ({
  resetAiStudioOutputStore: vi.fn(),
}));

vi.mock("../../logic/projectWorkspaceApiClient", () => ({
  saveAiStudioProjectWorkspaceSnapshotViaApi: vi.fn(),
  resetAiStudioProjectWorkspaceSnapshotViaApi: vi.fn(async () => undefined),
}));

const mockedUseAiStudioProjectWorkspaceRestoreCandidate = vi.mocked(
  useAiStudioProjectWorkspaceRestoreCandidate
);
const mockedUseAiStudioProjectWorkspaceRestoreHydration = vi.mocked(
  useAiStudioProjectWorkspaceRestoreHydration
);
const mockedUseAiStudioSessionAutosave = vi.mocked(useAiStudioSessionAutosave);
const mockedResetAiStudioOutputStore = vi.mocked(resetAiStudioOutputStore);
const mockedResetProjectWorkspaceViaApi = vi.mocked(resetAiStudioProjectWorkspaceSnapshotViaApi);

const createSnapshot = (): AiStudioSessionSnapshot =>
  ({
    schemaVersion: 2,
    sessionId: "session-1",
    updatedAt: "2026-04-24T18:00:00.000Z",
    workspace: {
      expertCreateMode: "pulse",
      activePulsePresetId: "preset-1",
      editReferenceText: "Keep this only while the page session stays open.",
    } as AiStudioSessionSnapshot["workspace"],
    outputs: {} as AiStudioSessionSnapshot["outputs"],
    agent: {
      messages: [{ id: "message-1", role: "assistant", content: "Existing chat" }],
      input: "next shot",
      latestAgentPrompt: "Existing chat",
      promptOrigin: "agent",
      chatModeEnabled: false,
      pulseWorkflowSession: {
        presetId: "preset-1",
        status: "awaiting_input",
        currentStepIndex: 1,
        currentStepLabel: "Action",
        currentStepPrompt: "What happens next?",
        collectedInputs: ["A close-up"],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    },
    agentRuntimes: {
      standard: {
        messages: [{ id: "message-0", role: "assistant", content: "Standard lane" }],
        input: "",
        latestAgentPrompt: "Standard lane",
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
      pulsePresetId: "preset-1",
      pulse: {
        messages: [{ id: "message-1", role: "assistant", content: "Existing chat" }],
        input: "next shot",
        latestAgentPrompt: "Existing chat",
        promptOrigin: "agent",
        chatModeEnabled: false,
        pulseWorkflowSession: {
          presetId: "preset-1",
          status: "awaiting_input",
          currentStepIndex: 1,
          currentStepLabel: "Action",
          currentStepPrompt: "What happens next?",
          collectedInputs: ["A close-up"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
    },
  }) as AiStudioSessionSnapshot;

const createHydrationPayload = (): AiStudioSessionHydrationPayload =>
  ({
    workspace: {} as never,
    outputs: {} as never,
    agent: {
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    },
    agentRuntimes: {
      standard: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
      pulsePresetId: null,
      pulseSessionInstanceId: null,
      pulse: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
    },
    canvas: null,
    expertEdit: null,
  }) as AiStudioSessionHydrationPayload;

describe("useAiStudioProjectWorkspacePersistenceController", () => {
  beforeEach(() => {
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockClear();
    mockedUseAiStudioProjectWorkspaceRestoreHydration.mockClear();
    mockedUseAiStudioSessionAutosave.mockClear();
    mockedResetAiStudioOutputStore.mockClear();
    restoreHydrationMock.mockClear();
    sessionAutosaveMock.mockClear();
    mockedResetProjectWorkspaceViaApi.mockClear();
  });

  it("keeps project autosave disabled until bootstrap settles", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    expect(mockedUseAiStudioSessionAutosave).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBeNull();
  });

  it("enables project autosave after bootstrap settles for the active project", () => {
    const snapshot = createSnapshot();
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const resetProjectAgentConversation = vi.fn();

    const { rerender } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
          resetProjectAgentConversation,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    expect(restoreHydrationArgs?.applyEmptyProjectState).toBe(applyEmptyProjectState);
    expect(restoreHydrationArgs?.resetProjectAgentConversation).toBe(resetProjectAgentConversation);

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });

    const lastWriteShadowArgs =
      mockedUseAiStudioSessionAutosave.mock.calls[
        mockedUseAiStudioSessionAutosave.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
      })
    );
    expect(lastWriteShadowArgs?.snapshot).toEqual(createAiStudioProjectWorkspaceSnapshot(snapshot));
    expect(lastWriteShadowArgs?.snapshot?.workspace.editReferenceText).toBe("");
    expect(buildSessionSnapshot).toHaveBeenCalledWith("session-1");
  });

  it("invalidates project-owned workspace state immediately when a project route is entered", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        applyEmptyProjectState,
      })
    );

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("re-invalidates workspace state and disables autosave when switching projects", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { rerender, result } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({ projectId: "project-2" });

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(2);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(2);
    expect(result.current.projectBootstrapApplied).toBe(false);
    const lastWriteShadowArgs =
      mockedUseAiStudioSessionAutosave.mock.calls[
        mockedUseAiStudioSessionAutosave.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-2",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("keeps bootstrap settled when runtime-facing callbacks change for the same project", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const nextBuildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const nextHydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const nextApplyEmptyProjectState = vi.fn();
    const resetProjectAgentConversation = vi.fn();
    const nextResetProjectAgentConversation = vi.fn();

    const { result, rerender } = renderHook(
      ({
        buildSnapshot,
        hydrateSnapshot,
        applyEmptyState,
        resetConversation,
      }: {
        buildSnapshot: typeof buildSessionSnapshot;
        hydrateSnapshot: typeof hydrateFromSessionSnapshot;
        applyEmptyState: typeof applyEmptyProjectState;
        resetConversation: typeof resetProjectAgentConversation;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot: hydrateSnapshot,
          applyEmptyProjectState: applyEmptyState,
          resetProjectAgentConversation: resetConversation,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
          hydrateSnapshot: hydrateFromSessionSnapshot,
          applyEmptyState: applyEmptyProjectState,
          resetConversation: resetProjectAgentConversation,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      buildSnapshot: nextBuildSessionSnapshot,
      hydrateSnapshot: nextHydrateFromSessionSnapshot,
      applyEmptyState: nextApplyEmptyProjectState,
      resetConversation: nextResetProjectAgentConversation,
    });

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(nextApplyEmptyProjectState).not.toHaveBeenCalled();
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
      })
    );
    expect(nextBuildSessionSnapshot).toHaveBeenCalledWith("session-1");
  });

  it("reuses the base project snapshot when only the patch callback changes", () => {
    const snapshot = createSnapshot();
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const firstPatchSessionSnapshot = vi.fn((value: AiStudioSessionSnapshot) => value);
    const secondPatchSessionSnapshot = vi.fn((value: AiStudioSessionSnapshot) => ({
      ...value,
      updatedAt: "2026-04-24T19:00:00.000Z",
    }));
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ patchSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          patchSessionSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          patchSessionSnapshot: firstPatchSessionSnapshot as (
            snapshot: AiStudioSessionSnapshot
          ) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ patchSessionSnapshot: firstPatchSessionSnapshot });
    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);

    rerender({ patchSessionSnapshot: secondPatchSessionSnapshot });

    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(firstPatchSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(secondPatchSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        snapshot: expect.objectContaining({
          updatedAt: "2026-04-24T19:00:00.000Z",
        }),
      })
    );
  });

  it("ignores stale bootstrap state after leaving and re-entering the same project", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { result, rerender } = renderHook(
      ({ projectId, projectRouteRequested }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
          projectRouteRequested: true,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      projectId: "project-1",
      projectRouteRequested: true,
    });
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({
      projectId: null,
      projectRouteRequested: false,
    });
    expect(result.current.projectBootstrapApplied).toBe(false);

    rerender({
      projectId: "project-1",
      projectRouteRequested: true,
    });

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(applyEmptyProjectState).toHaveBeenCalledTimes(2);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(2);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("fails closed while a project route is pending before projectId resolves", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { result, rerender } = renderHook(
      ({ projectId, projectRouteRequested }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: null as string | null,
          projectRouteRequested: false,
        },
      }
    );

    expect(applyEmptyProjectState).not.toHaveBeenCalled();
    expect(mockedResetAiStudioOutputStore).not.toHaveBeenCalled();

    rerender({
      projectId: null,
      projectRouteRequested: true,
    });

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBeNull();
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: null,
        snapshot: null,
        enabled: false,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
  });

  it("surfaces restore errors and keeps project autosave disabled", () => {
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockReturnValueOnce({
      status: "error",
      result: "load_failed",
      snapshot: null,
      source: "none",
      error: "Failed to load project workspace.",
      retry: vi.fn(),
    });

    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBe("Failed to load project workspace.");
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
        snapshot: null,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
  });

  it("stabilizes hydration failure handling so restore can settle into an error state", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    const firstHydrationArgs = mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    const firstFailureHandler = firstHydrationArgs?.onProjectBootstrapFailed;

    act(() => {
      firstFailureHandler?.("project-1", new Error("hydrate failed"));
    });
    rerender();

    const latestHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls.at(-1)?.[0];
    expect(latestHydrationArgs?.onProjectBootstrapFailed).toBe(firstFailureHandler);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBe("hydrate failed");
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it("reduces oversized project autosave snapshots before persisting", () => {
    const oversizedSnapshot = {
      ...createSnapshot(),
      archivedOutputsSentinel: true,
      outputs: {
        ...(createSnapshot().outputs as Record<string, unknown>),
        archived: [
          {
            id: "archived-1",
            prompt: "x".repeat(950_000),
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
          },
        ],
        removedFromAllRefsIds: ["archived-1"],
      },
    } as unknown as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => oversizedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning: vi.fn(),
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.enabled).toBe(true);
    expect(autosaveArgs?.snapshot?.outputs.archived).toEqual([]);
  });

  it("resets invalid saved workspaces through the project workspace API", async () => {
    const retry = vi.fn();
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockReturnValueOnce({
      status: "error",
      result: "load_failed",
      snapshot: null,
      source: "none",
      error: "Project workspace snapshot is invalid.",
      retry,
    });
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    await act(async () => {
      await result.current.resetProjectWorkspace();
    });

    expect(mockedResetProjectWorkspaceViaApi).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
