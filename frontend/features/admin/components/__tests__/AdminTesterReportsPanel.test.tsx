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
  hyberveesReviewStatus: "unreviewed" as const,
  hyberveesReviewedAt: null,
  hyberveesReviewedBy: null,
  hyberveesInsightSummary: null,
  hyberveesInsightArtifactPath: null,
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
    hyberveesReviewSavingId: null,
    hyberveesReviewError: null,
    testerReportSummary: {
      totalCount: 1,
      completedCount: 1,
      blockedCount: 0,
      failedCount: 0,
      partialCount: 0,
      hyberveesUnreviewedCount: 1,
      hyberveesReviewedCount: 0,
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
    testerReportReviewFilter: "unreviewed" as const,
    testerReportTesterFilter: "",
    testerReportSearch: "",
    onTesterReportStatusFilterChange: vi.fn(),
    onTesterReportReviewFilterChange: vi.fn(),
    onTesterReportTesterFilterChange: vi.fn(),
    onTesterReportSearchChange: vi.fn(),
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onMarkHyberveesReviewed: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };

  render(<AdminTesterReportsPanel {...props} />);
  return props;
};

describe("AdminTesterReportsPanel", () => {
  it("expands a tester run and then expands each report body", () => {
    renderPanel();

    expect(screen.getByText("Date/time")).toBeInTheDocument();
    expect(screen.queryByText("maya-2026-07-04-orientation")).not.toBeInTheDocument();
    expect(screen.queryByText("maya-chen")).not.toBeInTheDocument();
    expect(screen.queryByText("11111111-1111-4111-8111-111111111111")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Authenticated orientation/i }));
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

  it("renders the persona report body as rich markdown text", () => {
    renderPanel({
      testerReports: [
        {
          ...buildReport(),
          personaReportBody:
            '# Maya notes\n\nI found **the image** again and reused `Quick Slot`.\n\n- Prompt was not visible\n- Project reopened cleanly\n\n```json\n{"ok":true}\n```',
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Authenticated orientation/i }));
    fireEvent.click(screen.getByRole("button", { name: /maya's creator notebook/i }));

    expect(screen.getByRole("heading", { name: "Maya notes", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("the image").tagName).toBe("STRONG");
    expect(screen.getByText("Quick Slot").tagName).toBe("CODE");
    expect(screen.getByText("Prompt was not visible").tagName).toBe("LI");
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
    expect(screen.queryByText("# Maya notes")).not.toBeInTheDocument();
  });

  it("uses the status strip, review select, and tester field as filters", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Completed tester reports: 1" }));
    fireEvent.change(screen.getByLabelText("Hybervees review"), {
      target: { value: "reviewed" },
    });
    fireEvent.change(screen.getByLabelText("Tester slug"), { target: { value: "maya-chen" } });

    expect(props.onTesterReportStatusFilterChange).toHaveBeenCalledWith("completed");
    expect(props.onTesterReportReviewFilterChange).toHaveBeenCalledWith("reviewed");
    expect(props.onTesterReportTesterFilterChange).toHaveBeenCalledWith("maya-chen");
  });

  it("marks tester runs as reviewed by Hybervees", () => {
    const props = renderPanel();

    expect(screen.getAllByText("Needs Hybervees").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Authenticated orientation/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Hybervees reviewed" }));

    expect(props.onMarkHyberveesReviewed).toHaveBeenCalledWith("tester-run-1");
  });

  it("shows reviewed tester runs without enabling duplicate review actions", () => {
    renderPanel({
      testerReports: [
        {
          ...buildReport(),
          hyberveesReviewStatus: "reviewed" as const,
          hyberveesReviewedAt: "2026-07-06T20:00:00.000Z",
          hyberveesReviewedBy: "hybervees",
          hyberveesInsightSummary: "Reference Grid labels need clearer first-run guidance.",
          hyberveesInsightArtifactPath:
            "docs/records/artifacts/agent/hybervees/reports/2026-07-06-reference-grid.md",
        },
      ],
    });

    expect(screen.getAllByText("Hybervees reviewed").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Authenticated orientation/i }));
    expect(screen.getByRole("button", { name: "Mark Hybervees reviewed" })).toBeDisabled();
    expect(
      screen.getByText("Reference Grid labels need clearer first-run guidance.")
    ).toBeInTheDocument();
  });
});
