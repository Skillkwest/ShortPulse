import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminReportsPanel } from "../AdminReportsPanel";

const renderPanel = (overrides = {}) => {
  const props = {
    reports: [],
    reportsLoading: false,
    reportsError: null,
    reportSummary: {
      totalCount: 7,
      openCount: 5,
      newCount: 3,
      reviewingCount: 2,
      resolvedCount: 2,
    },
    reportsPagination: {
      page: 1,
      perPage: 50,
      totalCount: 7,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
    reportStatusFilter: "open" as const,
    reportSearch: "",
    reportUpdatingId: null,
    onReportStatusFilterChange: vi.fn(),
    onReportSearchChange: vi.fn(),
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onRefresh: vi.fn(),
    onUpdateReport: vi.fn().mockResolvedValue(null),
    ...overrides,
  };

  render(<AdminReportsPanel {...props} />);
  return props;
};

describe("AdminReportsPanel", () => {
  it("uses the count strip as the status filter control", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Reviewing reports: 2" }));

    expect(props.onReportStatusFilterChange).toHaveBeenCalledWith("reviewing");
    expect(screen.getByLabelText("Search reports")).toBeInTheDocument();
    expect(screen.getByText("Resolved reports are preserved in History.")).toBeInTheDocument();
  });

  it("exposes row-level status actions without opening the detail modal", () => {
    const onUpdateReport = vi.fn().mockResolvedValue(null);
    renderPanel({
      reports: [
        {
          id: "report-1",
          userId: "user-1",
          submitterEmail: "alpha@example.com",
          message: "Generation failed on upload.",
          adminNotes: "",
          status: "new" as const,
          sourcePath: "/dashboard",
          userAgent: "Mozilla/5.0",
          reviewedAt: null,
          reviewedByUserId: null,
          createdAt: "2026-05-24T18:00:00.000Z",
          updatedAt: "2026-05-24T18:00:00.000Z",
        },
      ],
      onUpdateReport,
    });

    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(onUpdateReport).toHaveBeenNthCalledWith(1, "report-1", { status: "reviewing" });
    expect(onUpdateReport).toHaveBeenNthCalledWith(2, "report-1", { status: "resolved" });
  });
});
