import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectRouteRecovery } from "../useAiStudioProjectRouteRecovery";

const mockedFetchWithAuth = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => mockedFetchWithAuth(...args),
}));

describe("useAiStudioProjectRouteRecovery", () => {
  beforeEach(() => {
    mockedFetchWithAuth.mockReset();
  });

  it("clears a stale project route and opens the projects modal when the user has zero projects", async () => {
    const onClearStaleProjectRoute = vi.fn().mockResolvedValue(true);
    const onOpenProjectsModal = vi.fn();
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [] }),
    } as Response);

    renderHook(() =>
      useAiStudioProjectRouteRecovery({
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
        projectRouteRequested: true,
        projectStatus: "error",
        projectErrorKind: "not_found",
        onClearStaleProjectRoute,
        onOpenProjectsModal,
      })
    );

    await waitFor(() => {
      expect(onClearStaleProjectRoute).toHaveBeenCalledTimes(1);
      expect(onOpenProjectsModal).toHaveBeenCalledTimes(1);
    });
  });

  it("opens the projects modal without clearing the route when the user still has saved projects", async () => {
    const onClearStaleProjectRoute = vi.fn();
    const onOpenProjectsModal = vi.fn();
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: [{ id: "22222222-2222-4222-8222-222222222222" }],
      }),
    } as Response);

    renderHook(() =>
      useAiStudioProjectRouteRecovery({
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
        projectRouteRequested: true,
        projectStatus: "error",
        projectErrorKind: "not_found",
        onClearStaleProjectRoute,
        onOpenProjectsModal,
      })
    );

    await waitFor(() => {
      expect(onOpenProjectsModal).toHaveBeenCalledTimes(1);
    });

    expect(onClearStaleProjectRoute).not.toHaveBeenCalled();
  });

  it("falls back to opening the projects modal when the projects list cannot be loaded", async () => {
    const onClearStaleProjectRoute = vi.fn();
    const onOpenProjectsModal = vi.fn();
    mockedFetchWithAuth.mockRejectedValueOnce(new Error("network"));

    renderHook(() =>
      useAiStudioProjectRouteRecovery({
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
        projectRouteRequested: true,
        projectStatus: "error",
        projectErrorKind: "forbidden",
        onClearStaleProjectRoute,
        onOpenProjectsModal,
      })
    );

    await waitFor(() => {
      expect(onOpenProjectsModal).toHaveBeenCalledTimes(1);
    });

    expect(onClearStaleProjectRoute).not.toHaveBeenCalled();
  });

  it("does nothing for non-recoverable project errors", async () => {
    const onClearStaleProjectRoute = vi.fn();
    const onOpenProjectsModal = vi.fn();

    renderHook(() =>
      useAiStudioProjectRouteRecovery({
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
        projectRouteRequested: true,
        projectStatus: "error",
        projectErrorKind: "server",
        onClearStaleProjectRoute,
        onOpenProjectsModal,
      })
    );

    await Promise.resolve();

    expect(mockedFetchWithAuth).not.toHaveBeenCalled();
    expect(onClearStaleProjectRoute).not.toHaveBeenCalled();
    expect(onOpenProjectsModal).not.toHaveBeenCalled();
  });

  it("does not refetch for the same stale project recovery key on rerender", async () => {
    const onClearStaleProjectRoute = vi.fn().mockResolvedValue(true);
    const onOpenProjectsModal = vi.fn();
    mockedFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ projects: [] }),
    } as Response);

    const { rerender } = renderHook(
      ({ requestedProjectId }: { requestedProjectId: string | null }) =>
        useAiStudioProjectRouteRecovery({
          requestedProjectId,
          projectRouteRequested: true,
          projectStatus: "error",
          projectErrorKind: "not_found",
          onClearStaleProjectRoute,
          onOpenProjectsModal,
        }),
      {
        initialProps: {
          requestedProjectId: "11111111-1111-4111-8111-111111111111",
        },
      }
    );

    await waitFor(() => {
      expect(mockedFetchWithAuth).toHaveBeenCalledTimes(1);
    });

    rerender({
      requestedProjectId: "11111111-1111-4111-8111-111111111111",
    });
    await Promise.resolve();

    expect(mockedFetchWithAuth).toHaveBeenCalledTimes(1);
  });
});
