import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminTesterReportsPage from "../../pages/admin/tester-reports";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminTesterReportsControllerMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../features/admin/logic/useAdminTesterReportsController", () => ({
  useAdminTesterReportsController: (...args: unknown[]) =>
    useAdminTesterReportsControllerMock(...args),
}));

describe("AdminTesterReportsPage", () => {
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
    useAdminTesterReportsControllerMock.mockReturnValue({
      testerReports: [],
      testerReportsLoading: false,
      testerReportsError: null,
      testerReportSummary: {
        totalCount: 0,
        completedCount: 0,
        blockedCount: 0,
        failedCount: 0,
        partialCount: 0,
        hyberveesUnreviewedCount: 0,
        hyberveesReviewedCount: 0,
      },
      testerReportsPagination: {
        page: 1,
        perPage: 25,
        totalCount: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      testerReportStatusFilter: "all",
      testerReportReviewFilter: "unreviewed",
      testerReportTesterFilter: "",
      testerReportSearch: "",
      handleTesterReportStatusFilterChange: vi.fn(),
      handleTesterReportReviewFilterChange: vi.fn(),
      handleTesterReportTesterFilterChange: vi.fn(),
      handleTesterReportSearchChange: vi.fn(),
      handleTesterReportsPrevPage: vi.fn(),
      handleTesterReportsNextPage: vi.fn(),
      markHyberveesReviewed: vi.fn(),
      refreshTesterReports: vi.fn(),
      hyberveesReviewSavingId: null,
      hyberveesReviewError: null,
    });
  });

  it("renders the tester reports admin route and active nav tab", () => {
    render(<AdminTesterReportsPage />);

    expect(screen.getByRole("heading", { name: "Agent Tester Reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agent Tester Reports" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(useAdminTesterReportsControllerMock).toHaveBeenCalledWith({ enabled: true });
  });
});
