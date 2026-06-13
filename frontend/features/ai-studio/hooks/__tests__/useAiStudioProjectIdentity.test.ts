import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/router";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { getAiStudioProjectIdentityViaApi } from "../../logic/projectWorkspaceApiClient";
import { useAiStudioProjectIdentity } from "../useAiStudioProjectIdentity";

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../logic/projectWorkspaceApiClient", () => ({
  getAiStudioProjectIdentityViaApi: vi.fn(),
  invalidateAiStudioProjectWorkspaceBootstrapCache: vi.fn(),
}));

type MockRouter = {
  events: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  isReady: boolean;
  query: Record<string, unknown>;
};

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
    },
    emit: (eventName: string, ...args: unknown[]) => {
      handlers.get(eventName)?.forEach((handler) => handler(...args));
    },
  };
};

const mockedUseRouter = vi.mocked(useRouter);
const mockedFetchWithAuth = vi.mocked(fetchWithAuth);
const mockedGetAiStudioProjectIdentityViaApi = vi.mocked(getAiStudioProjectIdentityViaApi);
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_TWO_ID = "22222222-2222-4222-8222-222222222222";

const createRouter = (overrides: Partial<MockRouter> = {}): MockRouter => {
  const router = {
    events: createRouterEvents().events,
    isReady: true,
    query: {},
    ...overrides,
  };
  const routeProjectId = router.query.projectId;
  if (
    typeof routeProjectId === "string" &&
    !new URLSearchParams(window.location.search).has("projectId")
  ) {
    window.history.replaceState({}, "", `/ai-studio?projectId=${routeProjectId}`);
  }
  return router;
};

describe("useAiStudioProjectIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/ai-studio");
  });

  it("stays idle without a projectId query", () => {
    mockedUseRouter.mockReturnValue(createRouter() as never);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    expect(result.current.projectId).toBeNull();
    expect(result.current.requestedProjectId).toBeNull();
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.projectRouteRequested).toBe(false);
    expect(result.current.project).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(mockedGetAiStudioProjectIdentityViaApi).not.toHaveBeenCalled();
  });

  it("treats a project route in the URL as pending before router query resolution finishes", () => {
    window.history.replaceState({}, "", `/ai-studio?projectId=${PROJECT_ID}`);
    mockedUseRouter.mockReturnValue(
      createRouter({
        isReady: false,
        query: {},
      }) as never
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    expect(result.current.projectId).toBe(PROJECT_ID);
    expect(result.current.bootstrapProjectId).toBe(PROJECT_ID);
    expect(result.current.requestedProjectId).toBe(PROJECT_ID);
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.projectRouteRequested).toBe(true);
    expect(result.current.status).toBe("loading");
    expect(mockedGetAiStudioProjectIdentityViaApi).not.toHaveBeenCalled();
  });

  it("loads the owned project record from the project route", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockResolvedValueOnce({
      id: PROJECT_ID,
      title: "Project One",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(mockedGetAiStudioProjectIdentityViaApi).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
    });
    expect(result.current.project).toEqual({
      id: PROJECT_ID,
      title: "Project One",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
    expect(result.current.projectId).toBe(PROJECT_ID);
    expect(result.current.bootstrapProjectId).toBe(PROJECT_ID);
    expect(result.current.requestedProjectId).toBe(PROJECT_ID);
    expect(result.current.verifiedProjectId).toBe(PROJECT_ID);
  });

  it("follows the browser route project when router query is stale during project switching", async () => {
    const routerEvents = createRouterEvents();
    window.history.replaceState({}, "", `/ai-studio?projectId=${PROJECT_ID}`);
    mockedUseRouter.mockReturnValue(
      createRouter({
        events: routerEvents.events,
        query: { projectId: PROJECT_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi
      .mockResolvedValueOnce({
        id: PROJECT_ID,
        title: "Project One",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T01:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: PROJECT_TWO_ID,
        title: "Project Two",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T01:00:00.000Z",
      });

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.verifiedProjectId).toBe(PROJECT_ID);
    });

    act(() => {
      window.history.replaceState({}, "", `/ai-studio?projectId=${PROJECT_TWO_ID}`);
      routerEvents.emit("routeChangeStart", `/ai-studio?projectId=${PROJECT_TWO_ID}`);
    });

    await waitFor(() => {
      expect(result.current.verifiedProjectId).toBe(PROJECT_TWO_ID);
    });

    expect(result.current.requestedProjectId).toBe(PROJECT_TWO_ID);
    expect(result.current.bootstrapProjectId).toBe(PROJECT_TWO_ID);
    expect(result.current.project?.title).toBe("Project Two");
    expect(mockedGetAiStudioProjectIdentityViaApi).toHaveBeenLastCalledWith({
      projectId: PROJECT_TWO_ID,
    });
  });

  it("rejects malformed project ids before loading project-owned data", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: "bad-project" },
      }) as never
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Invalid project link.");
    expect(result.current.errorKind).toBe("invalid_id");
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.bootstrapProjectId).toBeNull();
    expect(result.current.project).toBeNull();
    expect(mockedGetAiStudioProjectIdentityViaApi).not.toHaveBeenCalled();
  });

  it("surfaces a closed failure state for missing or unauthorized projects", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_TWO_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockRejectedValueOnce(
      new Error("Invalid project link.")
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Invalid project link.");
    expect(result.current.errorKind).toBe("invalid_id");
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.project).toBeNull();
  });

  it("surfaces an access-denied failure state for forbidden projects", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_TWO_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockRejectedValueOnce(
      new Error("You do not have access to this project.")
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("You do not have access to this project.");
    expect(result.current.errorKind).toBe("forbidden");
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.project).toBeNull();
  });

  it("surfaces a closed failure state for missing projects", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_TWO_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockRejectedValueOnce(new Error("Project not found."));

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Project not found.");
    expect(result.current.errorKind).toBe("not_found");
    expect(result.current.verifiedProjectId).toBeNull();
    expect(result.current.project).toBeNull();
  });

  it("surfaces a retry-oriented message for unauthorized project reads", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockRejectedValueOnce(
      new Error("Session expired. Retry project load.")
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Session expired. Retry project load.");
    expect(result.current.project).toBeNull();
  });

  it("normalizes object-shaped project load errors", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockRejectedValueOnce(
      new Error("Project service unavailable")
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Project service unavailable");
    expect(result.current.errorKind).toBe("server");
    expect(result.current.project).toBeNull();
  });

  it("patches the title through the project route and refreshes local project state", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: PROJECT_ID },
      }) as never
    );
    mockedGetAiStudioProjectIdentityViaApi.mockResolvedValueOnce({
      id: PROJECT_ID,
      title: "Project One",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          id: PROJECT_ID,
          title: "Renamed Project",
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T02:00:00.000Z",
        },
      }),
    } as Response);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await act(async () => {
      await result.current.updateProjectTitle("Renamed Project");
    });

    expect(mockedFetchWithAuth).toHaveBeenLastCalledWith(`/api/projects/${PROJECT_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Renamed Project" }),
      shortpulseAuthTimeoutMs: 5000,
    });
    expect(result.current.project?.title).toBe("Renamed Project");
  });
});
