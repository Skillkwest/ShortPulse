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
    reportStatusFilter: "all" as const,
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
  });
});
