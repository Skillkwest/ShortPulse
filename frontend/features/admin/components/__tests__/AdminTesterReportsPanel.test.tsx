import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTesterReportsPanel } from "../AdminTesterReportsPanel";

const buildReport = () => ({
  id: "tester-run-1",
  externalRunId: "maya-2026-07-04-orientation",
  testerSlug: "maya-chen",
  testerDisplayName: "Maya Chen",
  shortpulseUserId: "11111111-1111-4111-8111-111111111111",
  shortpulseUserEmail: "maya@example.com",
  scenario: "Authenticated orientation through AI Studio.",
  status: "completed" as const,
  runStartedAt: "2026-07-04T15:00:00.000Z",
  runFinishedAt: "2026-07-04T15:45:00.000Z",
  durationMinutes: 45,
  creditsSpent: 0,
  productionSurface: "https://www.shortpulse.ai/ai-studio",
  personaReportTitle: "Maya's creator notebook",
  personaReportBody: "I felt confident that the app remembered my draft.",
  engineeringReportTitle: "Draft persistence handoff",
  engineeringReportBody: "Verify autosave confidence around AI Studio draft restore.",
  reportArtifactPaths: ["docs/agents/testers/maya-chen/reports/2026-07-04.md"],
  evidence: { screenshots: 2 },
  createdBySource: "tester_agent" as const,
  createdByUserId: null,
  createdByEmail: null,
  createdAt: "2026-07-04T15:45:00.000Z",
  updatedAt: "2026-07-04T15:45:00.000Z",
});

const renderPanel = (overrides = {}) => {
  const props = {
    testerReports: [buildReport()],
    testerReportsLoading: false,
    testerReportsError: null,
    testerReportSummary: {
      totalCount: 1,
      completedCount: 1,
      blockedCount: 0,
      failedCount: 0,
      partialCount: 0,
    },
    testerReportsPagination: {
      page: 1,
      perPage: 25,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
    testerReportStatusFilter: "all" as const,
    testerReportTesterFilter: "",
    testerReportSearch: "",
    onTesterReportStatusFilterChange: vi.fn(),
    onTesterReportTesterFilterChange: vi.fn(),
    onTesterReportSearchChange: vi.fn(),
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };

  render(<AdminTesterReportsPanel {...props} />);
  return props;
};

describe("AdminTesterReportsPanel", () => {
  it("expands a tester run and then expands each report body", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /maya-2026-07-04-orientation/i }));
    expect(screen.getByText("Persona report")).toBeInTheDocument();
    expect(screen.getByText("Engineering handoff")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /maya's creator notebook/i }));
    expect(
      screen.getByText("I felt confident that the app remembered my draft.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /draft persistence handoff/i }));
    expect(
      screen.getByText("Verify autosave confidence around AI Studio draft restore.")
    ).toBeInTheDocument();
  });

  it("uses the status strip and tester field as filters", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Completed tester reports: 1" }));
    fireEvent.change(screen.getByLabelText("Tester slug"), { target: { value: "maya-chen" } });

    expect(props.onTesterReportStatusFilterChange).toHaveBeenCalledWith("completed");
    expect(props.onTesterReportTesterFilterChange).toHaveBeenCalledWith("maya-chen");
  });
});
