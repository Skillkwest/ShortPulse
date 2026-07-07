/**
 * Admin Crash Logs page tests.
 * Locks the authenticated admin route wiring for browser crash-session evidence.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCrashesPage from "../../pages/admin/crashes";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminCrashSessionsControllerMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminCrashSessionsController", () => ({
  useAdminCrashSessionsController: (...args: unknown[]) =>
    useAdminCrashSessionsControllerMock(...args),
}));

describe("Admin Crash Logs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-1", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
    useAdminCrashSessionsControllerMock.mockReturnValue({
      sessions: [
        {
          id: "crash-1",
          browserSessionId: "browser-session-1",
          userId: "user-1",
          userEmail: "alpha@example.com",
          status: "active",
          confidence: "none",
          effectiveStatus: "probable_freeze_or_crash",
          effectiveConfidence: "medium",
          isStale: false,
          lastEvent: "previous_session_abandoned",
          route: "/ai-studio",
          buildId: "build-1",
          clientRelease: null,
          clientEnvironment: "production",
          userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
          host: "www.shortpulse.ai",
          vercelId: null,
          metadata: { pressure_level: 5 },
          reviewStatus: "open",
          reviewedAt: null,
          reviewedBy: null,
          reviewedByEmail: null,
          reviewNote: null,
          startedAt: "2026-07-05T01:00:00.000Z",
          lastSeenAt: "2026-07-05T01:02:00.000Z",
          endedAt: null,
          suspectedAt: "2026-07-05T01:02:30.000Z",
          createdAt: "2026-07-05T01:00:00.000Z",
          updatedAt: "2026-07-05T01:02:30.000Z",
        },
      ],
      loading: false,
      error: null,
      pagination: {
        page: 1,
        perPage: 50,
        totalCount: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      statusFilter: "all",
      reviewStatusFilter: "open",
      search: "",
      updatingReviewSessionId: null,
      handleStatusFilterChange: vi.fn(),
      handleReviewStatusFilterChange: vi.fn(),
      handleSearchChange: vi.fn(),
      handleUpdateReviewStatus: vi.fn(),
      handlePrevPage: vi.fn(),
      handleNextPage: vi.fn(),
      refresh: vi.fn(),
    });
  });

  it("renders the Crash Logs admin tab with crash-session evidence", async () => {
    render(<AdminCrashesPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Crash logs" })).toBeInTheDocument();
      expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
      expect(screen.getByText("Probable freeze")).toBeInTheDocument();
    });

    const subNav = screen.getByRole("navigation", { name: "Error management pages" });
    expect(within(subNav).getByRole("link", { name: "Errors" })).toHaveAttribute(
      "href",
      "/admin/errors"
    );
    expect(within(subNav).getByRole("link", { name: "Crash Logs" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(subNav).getByRole("link", { name: "Ophestivus" })).toHaveAttribute(
      "href",
      "/admin/kanban"
    );

    expect(useAdminCrashSessionsControllerMock).toHaveBeenCalledWith({
      enabled: true,
      liveRefreshEnabled: true,
    });
  });
});
