import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/router";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { useAiStudioProjectIdentity } from "../useAiStudioProjectIdentity";

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

type MockRouter = {
  isReady: boolean;
  query: Record<string, unknown>;
};

const mockedUseRouter = vi.mocked(useRouter);
const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const createRouter = (overrides: Partial<MockRouter> = {}): MockRouter => ({
  isReady: true,
  query: {},
  ...overrides,
});

describe("useAiStudioProjectIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/ai-studio");
  });

  it("stays idle without a projectId query", () => {
    mockedUseRouter.mockReturnValue(createRouter() as never);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    expect(result.current.projectId).toBeNull();
    expect(result.current.projectRouteRequested).toBe(false);
    expect(result.current.project).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(mockedFetchWithAuth).not.toHaveBeenCalled();
  });

  it("treats a project route in the URL as pending before router query resolution finishes", () => {
    window.history.replaceState({}, "", "/ai-studio?projectId=project-1");
    mockedUseRouter.mockReturnValue(
      createRouter({
        isReady: false,
        query: {},
      }) as never
    );

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    expect(result.current.projectId).toBeNull();
    expect(result.current.projectRouteRequested).toBe(true);
    expect(result.current.status).toBe("loading");
    expect(mockedFetchWithAuth).not.toHaveBeenCalled();
  });

  it("loads the owned project record from the project route", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: "project-1" },
      }) as never
    );
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project: {
          id: "project-1",
          title: "Project One",
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T01:00:00.000Z",
        },
      }),
    } as Response);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(mockedFetchWithAuth).toHaveBeenCalledWith("/api/projects/project-1", {
      method: "GET",
      shortpulseAuthTimeoutMs: 5000,
    });
    expect(result.current.project).toEqual({
      id: "project-1",
      title: "Project One",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
  });

  it("surfaces a closed failure state for invalid or unauthorized projects", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: "bad-project" },
      }) as never
    );
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Project not found" }),
    } as Response);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Project not found.");
    expect(result.current.project).toBeNull();
  });

  it("surfaces a retry-oriented message for unauthorized project reads", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: "project-1" },
      }) as never
    );
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const { result } = renderHook(() => useAiStudioProjectIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Session expired. Retry project load.");
    expect(result.current.project).toBeNull();
  });

  it("patches the title through the project route and refreshes local project state", async () => {
    mockedUseRouter.mockReturnValue(
      createRouter({
        query: { projectId: "project-1" },
      }) as never
    );
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            id: "project-1",
            title: "Project One",
            createdAt: "2026-04-23T00:00:00.000Z",
            updatedAt: "2026-04-23T01:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            id: "project-1",
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

    expect(mockedFetchWithAuth).toHaveBeenLastCalledWith("/api/projects/project-1", {
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
