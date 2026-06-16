import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectRouteRecovery } from "../useAiStudioProjectRouteRecovery";

describe("useAiStudioProjectRouteRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears a stale project route and opens the projects modal", async () => {
    const onClearStaleProjectRoute = vi.fn().mockResolvedValue(true);
    const onOpenProjectsModal = vi.fn();

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

  it("still opens the projects modal when stale route clearing fails", async () => {
    const onClearStaleProjectRoute = vi.fn().mockRejectedValueOnce(new Error("route failed"));
    const onOpenProjectsModal = vi.fn();

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

    expect(onClearStaleProjectRoute).toHaveBeenCalledTimes(1);
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

    expect(onClearStaleProjectRoute).not.toHaveBeenCalled();
    expect(onOpenProjectsModal).not.toHaveBeenCalled();
  });

  it("does not refetch for the same stale project recovery key on rerender", async () => {
    const onClearStaleProjectRoute = vi.fn().mockResolvedValue(true);
    const onOpenProjectsModal = vi.fn();

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
      expect(onClearStaleProjectRoute).toHaveBeenCalledTimes(1);
    });

    rerender({
      requestedProjectId: "11111111-1111-4111-8111-111111111111",
    });
    await Promise.resolve();

    expect(onClearStaleProjectRoute).toHaveBeenCalledTimes(1);
  });
});
