import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioShellRuntime } from "../useAiStudioShellRuntime";
import type { AiStudioPageBaseRuntime } from "../useAiStudioPageBaseRuntime";

vi.mock("../useAiStudioProjectRouteRecovery", () => ({
  useAiStudioProjectRouteRecovery: () => undefined,
}));

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

const createFlushProjectWorkspaceSnapshot = () =>
  vi.fn(async () => ({
    status: "skipped" as const,
    reason: "unchanged" as const,
    projectId: "project-1",
    snapshotHash: "hash-1",
    keepalive: false,
  }));

describe("useAiStudioShellRuntime", () => {
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
