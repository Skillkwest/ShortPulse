import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioShellRuntime } from "../useAiStudioShellRuntime";
import type { AiStudioPageBaseRuntime } from "../useAiStudioPageBaseRuntime";
import type { AiStudioProjectWorkspaceFlushResult } from "../aiStudioPersistenceControllerContract";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../useAiStudioProjectRouteRecovery", () => ({
  useAiStudioProjectRouteRecovery: () => undefined,
}));

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(async () => undefined),
}));

const mockedReportAppError = vi.mocked(reportAppError);

type RouterEventHandler = (...args: unknown[]) => void;

const createRouterEvents = () => {
  const handlers = new Map<string, Set<RouterEventHandler>>();
  return {
    events: {
      on: vi.fn((eventName: string, handler: RouterEventHandler) => {
        const eventHandlers = handlers.get(eventName) ?? new Set<RouterEventHandler>();
        eventHandlers.add(handler);
        handlers.set(eventName, eventHandlers);
      }),
      off: vi.fn((eventName: string, handler: RouterEventHandler) => {
        handlers.get(eventName)?.delete(handler);
      }),
      emit: vi.fn((eventName: string, ...args: unknown[]) => {
        handlers.get(eventName)?.forEach((handler) => handler(...args));
      }),
    },
    emit: (eventName: string, ...args: unknown[]) => {
      handlers.get(eventName)?.forEach((handler) => handler(...args));
    },
  };
};

const createBaseRuntime = (): AiStudioPageBaseRuntime =>
  ({
    closeModelModal: vi.fn(),
    expertCreateMode: "standard",
    isModelModalOpen: false,
    isCreateCharacterModeEnabled: false,
    localSessionTitleOverride: null,
    modelModalContext: null,
    project: {
      id: "project-1",
      title: "Project One",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    projectErrorKind: null,
    projectId: "project-1",
    projectRouteRequested: true,
    projectStatus: "ready",
    requestedProjectId: "project-1",
    router: {
      events: createRouterEvents().events,
      query: { projectId: "project-1" },
      push: vi.fn(async () => true),
      replace: vi.fn(async () => true),
    },
    sessionId: "session-1",
    setIsProjectsModalOpen: vi.fn(),
    setSelectedToolWithEditIntentReset: vi.fn(),
    setSessionTitleOverrideState: vi.fn(),
    setShowCreateTools: vi.fn(),
    setUiError: vi.fn(),
    selectedTool: "create",
    trackUiEvent: vi.fn(),
    updateProjectTitle: vi.fn(async (value: string) => ({
      id: "project-1",
      title: value,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    })),
    resolveIsCharacterModeEnabledForTool: vi.fn(() => false),
    resolveSelectedCharacterIdForTool: vi.fn(() => null),
  }) as unknown as AiStudioPageBaseRuntime;

const createFlushProjectWorkspaceSnapshot = (
  result: AiStudioProjectWorkspaceFlushResult = {
    status: "skipped" as const,
    reason: "unchanged" as const,
    projectId: "project-1",
    snapshotHash: "hash-1",
    keepalive: false,
  }
) => vi.fn(async () => result);

describe("useAiStudioShellRuntime", () => {
  beforeEach(() => {
    mockedReportAppError.mockClear();
  });

  it("opens the studio once project bootstrap settles even before autosave-readiness proof matches", () => {
    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base: createBaseRuntime(),
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: false,
        flushProjectWorkspaceSnapshot: createFlushProjectWorkspaceSnapshot(),
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    expect(result.current.shouldGateProjectBootstrap).toBe(false);
  });

  it("keeps the entry gate closed while restore is not yet settled", () => {
    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base: createBaseRuntime(),
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: false,
        projectBootstrapApplied: false,
        flushProjectWorkspaceSnapshot: createFlushProjectWorkspaceSnapshot(),
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    expect(result.current.shouldGateProjectBootstrap).toBe(true);
    expect(result.current.projectEntryPhase).toBe("restoring-workspace");
  });

  it("reports interrupted project modal navigation when the router cancels the push", async () => {
    const base = createBaseRuntime();
    const push = vi.fn(async () => false);
    base.router.push = push;

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot: createFlushProjectWorkspaceSnapshot(),
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    await expect(result.current.handleSelectProjectFromModal("project-2")).rejects.toThrow(
      "Project open was interrupted. Try again."
    );
    expect(push).toHaveBeenCalledWith({
      pathname: "/ai-studio",
      query: { projectId: "project-2" },
    });
  });

  it("resolves project modal navigation once the target route completes", async () => {
    const base = createBaseRuntime();
    const routerEvents = createRouterEvents();
    const push = vi.fn(() => new Promise<boolean>(() => undefined));
    base.router.events = routerEvents.events;
    base.router.push = push;
    const flushProjectWorkspaceSnapshot = createFlushProjectWorkspaceSnapshot();

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    const openProject = result.current.handleSelectProjectFromModal("project-2");
    await Promise.resolve();
    expect(flushProjectWorkspaceSnapshot).toHaveBeenCalledWith({ reason: "project_switch" });
    routerEvents.emit("routeChangeStart", "/ai-studio?projectId=project-2");
    await expect(Promise.race([openProject, Promise.resolve("pending")])).resolves.toBe("pending");
    routerEvents.emit("routeChangeComplete", "/ai-studio?projectId=project-2");

    await expect(openProject).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledWith({
      pathname: "/ai-studio",
      query: { projectId: "project-2" },
    });
  });

  it("rejects project modal navigation when the workspace flush cannot safely save", async () => {
    const base = createBaseRuntime();
    const push = vi.fn(async () => true);
    base.router.push = push;
    const flushProjectWorkspaceSnapshot = createFlushProjectWorkspaceSnapshot({
      status: "skipped",
      reason: "not_ready",
      projectId: "project-1",
      snapshotHash: null,
      keepalive: false,
    });

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    await expect(result.current.handleSelectProjectFromModal("project-2")).rejects.toThrow(
      "Project workspace could not be saved before switching projects."
    );
    expect(flushProjectWorkspaceSnapshot).toHaveBeenCalledWith({ reason: "project_switch" });
    expect(mockedReportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.project_switch_flush_blocked",
        message: "Project workspace could not be saved before switching projects.",
        endpoint: "/ai-studio?projectId=project-2",
        metadata: expect.objectContaining({
          current_project_id: "project-1",
          target_project_id: "project-2",
          flush_reason: "not_ready",
        }),
      })
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces an actionable message when project switching is blocked by snapshot size", async () => {
    const base = createBaseRuntime();
    const push = vi.fn(async () => true);
    base.router.push = push;
    const flushProjectWorkspaceSnapshot = createFlushProjectWorkspaceSnapshot({
      status: "skipped",
      reason: "snapshot_too_large",
      projectId: "project-1",
      snapshotHash: "large-hash",
      keepalive: false,
    });

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    await expect(result.current.handleSelectProjectFromModal("project-2")).rejects.toThrow(
      "Project workspace is too large to save before switching projects."
    );
    expect(mockedReportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.project_switch_flush_blocked",
        message: "Project workspace is too large to save before switching projects.",
        metadata: expect.objectContaining({
          flush_reason: "snapshot_too_large",
          snapshot_hash: "large-hash",
        }),
      })
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("flushes the current workspace before routing to a newly created project", async () => {
    const base = createBaseRuntime();
    const routerEvents = createRouterEvents();
    const push = vi.fn(() => new Promise<boolean>(() => undefined));
    base.router.events = routerEvents.events;
    base.router.push = push;
    const flushProjectWorkspaceSnapshot = createFlushProjectWorkspaceSnapshot();

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    const createProject = result.current.handleCreateProjectFromModal("project-new");
    await Promise.resolve();
    expect(flushProjectWorkspaceSnapshot).toHaveBeenCalledWith({ reason: "project_switch" });
    routerEvents.emit("routeChangeComplete", "/ai-studio?projectId=project-new");

    await expect(createProject).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledWith({
      pathname: "/ai-studio",
      query: { projectId: "project-new" },
    });
  });

  it("rejects newly created project routing when the workspace flush cannot safely save", async () => {
    const base = createBaseRuntime();
    const push = vi.fn(async () => true);
    base.router.push = push;
    const flushProjectWorkspaceSnapshot = createFlushProjectWorkspaceSnapshot({
      status: "skipped",
      reason: "not_ready",
      projectId: "project-1",
      snapshotHash: null,
      keepalive: false,
    });

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    await expect(result.current.handleCreateProjectFromModal("project-new")).rejects.toThrow(
      "Project workspace could not be saved before switching projects."
    );
    expect(flushProjectWorkspaceSnapshot).toHaveBeenCalledWith({ reason: "project_switch" });
    expect(mockedReportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.project_switch_flush_blocked",
        endpoint: "/ai-studio?projectId=project-new",
        metadata: expect.objectContaining({
          current_project_id: "project-1",
          target_project_id: "project-new",
          flush_reason: "not_ready",
        }),
      })
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps project modal navigation pending until route complete even when router push resolves", async () => {
    const base = createBaseRuntime();
    const routerEvents = createRouterEvents();
    const push = vi.fn(async () => true);
    base.router.events = routerEvents.events;
    base.router.push = push;

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        flushProjectWorkspaceSnapshot: createFlushProjectWorkspaceSnapshot(),
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    const openProject = result.current.handleSelectProjectFromModal("project-2");
    await Promise.resolve();
    await Promise.resolve();

    await expect(Promise.race([openProject, Promise.resolve("pending")])).resolves.toBe("pending");

    routerEvents.emit("routeChangeComplete", "/ai-studio?projectId=project-2");

    await expect(openProject).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledWith({
      pathname: "/ai-studio",
      query: { projectId: "project-2" },
    });
  });

  it("rejects project modal navigation when the target route never starts or settles", async () => {
    vi.useFakeTimers();
    try {
      const base = createBaseRuntime();
      const routerEvents = createRouterEvents();
      const push = vi.fn(() => new Promise<boolean>(() => undefined));
      base.router.events = routerEvents.events;
      base.router.push = push;

      const { result } = renderHook(() =>
        useAiStudioShellRuntime({
          base,
          sessionRestoreCandidate: {
            status: "ready",
            result: "found_snapshot",
            snapshot: null,
            source: "project",
            error: null,
            retry: vi.fn(),
          },
          projectBootstrapSettled: true,
          projectBootstrapApplied: true,
          flushProjectWorkspaceSnapshot: createFlushProjectWorkspaceSnapshot(),
          filteredModelOptions: [],
          resolveModelPickerCredits: vi.fn(() => null),
          handleSelectModelFromModal: vi.fn(),
        })
      );

      const openProject = result.current.handleSelectProjectFromModal("project-2");
      const expectation = expect(openProject).rejects.toThrow(
        "Project open is taking longer than expected. Try again."
      );

      await vi.advanceTimersByTimeAsync(8000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
