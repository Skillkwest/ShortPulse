import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "../useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "../useAiStudioProjectWorkspaceRestoreHydration";
import { useAiStudioSessionWriteShadow } from "../useAiStudioSessionWriteShadow";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";

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

const sessionWriteShadowMock = vi.fn();
vi.mock("../useAiStudioSessionWriteShadow", () => ({
  useAiStudioSessionWriteShadow: vi.fn((params) => sessionWriteShadowMock(params)),
}));

const mockedUseAiStudioProjectWorkspaceRestoreCandidate = vi.mocked(
  useAiStudioProjectWorkspaceRestoreCandidate
);
const mockedUseAiStudioProjectWorkspaceRestoreHydration = vi.mocked(
  useAiStudioProjectWorkspaceRestoreHydration
);
const mockedUseAiStudioSessionWriteShadow = vi.mocked(useAiStudioSessionWriteShadow);

const createSnapshot = (): AiStudioSessionSnapshot =>
  ({
    schemaVersion: 2,
    sessionId: "session-1",
    updatedAt: "2026-04-24T18:00:00.000Z",
    workspace: {} as AiStudioSessionSnapshot["workspace"],
    outputs: {} as AiStudioSessionSnapshot["outputs"],
    agent: {} as AiStudioSessionSnapshot["agent"],
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
    mockedUseAiStudioSessionWriteShadow.mockClear();
    restoreHydrationMock.mockClear();
    sessionWriteShadowMock.mockClear();
  });

  it("keeps project write shadow disabled until bootstrap settles", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        sessionId: "session-1",
        buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
      })
    );

    expect(mockedUseAiStudioSessionWriteShadow).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionWriteShadow.mock.calls[0]?.[0]).toEqual(
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

  it("enables project write shadow after bootstrap settles for the active project", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const applyEmptyProjectState = vi.fn();

    const { rerender } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          sessionId: "session-1",
          buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          hydrateFromSessionAgentSnapshot,
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
    expect(restoreHydrationArgs?.applyEmptyProjectState).toBe(applyEmptyProjectState);

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });

    const lastWriteShadowArgs =
      mockedUseAiStudioSessionWriteShadow.mock.calls[
        mockedUseAiStudioSessionWriteShadow.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
      })
    );
    expect(lastWriteShadowArgs?.snapshot).toEqual(createSnapshot());
    expect(buildSessionSnapshot).toHaveBeenCalledWith("session-1");
  });

  it("invalidates project-owned workspace state immediately when a project route is entered", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const applyEmptyProjectState = vi.fn();

    renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        sessionId: "session-1",
        buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        applyEmptyProjectState,
      })
    );

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(mockedUseAiStudioSessionWriteShadow.mock.calls[0]?.[0]).toEqual(
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
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const applyEmptyProjectState = vi.fn();

    const { rerender, result } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          sessionId: "session-1",
          buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          hydrateFromSessionAgentSnapshot,
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
    expect(result.current.projectBootstrapApplied).toBe(false);
    const lastWriteShadowArgs =
      mockedUseAiStudioSessionWriteShadow.mock.calls[
        mockedUseAiStudioSessionWriteShadow.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-2",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("surfaces restore errors and keeps write shadow disabled", () => {
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
    const hydrateFromSessionAgentSnapshot = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        sessionId: "session-1",
        buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
      })
    );

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBe("Failed to load project workspace.");
    expect(mockedUseAiStudioSessionWriteShadow.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
        snapshot: null,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
  });
});
