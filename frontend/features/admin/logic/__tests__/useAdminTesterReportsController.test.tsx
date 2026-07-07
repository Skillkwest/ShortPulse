import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminTesterReportsController } from "../useAdminTesterReportsController";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

const buildReport = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "tester-run-1",
  external_run_id: "maya-2026-07-04-orientation",
  tester_slug: "maya-chen",
  tester_display_name: "Maya Chen",
  shortpulse_user_id: "11111111-1111-4111-8111-111111111111",
  shortpulse_user_email: "maya@example.com",
  scenario: "Authenticated orientation through AI Studio.",
  status: "completed",
  persona_report_title: "Maya report",
  persona_report_body: "Creator-voice notes.",
  engineering_report_title: "Engineering handoff",
  engineering_report_body: "Implementation notes.",
  report_artifact_paths: [],
  evidence: {},
  created_by_source: "tester_agent",
  created_at: "2026-07-04T15:45:00.000Z",
  updated_at: "2026-07-04T15:45:00.000Z",
  ...overrides,
});

const buildListResponse = (reports: unknown[], summaryOverrides: Record<string, number>) =>
  jsonResponse({
    reports,
    summary: {
      totalCount: reports.length,
      completedCount: reports.length,
      blockedCount: 0,
      failedCount: 0,
      partialCount: 0,
      hyberveesUnreviewedCount: reports.length,
      hyberveesReviewedCount: 0,
      ...summaryOverrides,
    },
    pagination: {
      page: 1,
      perPage: 25,
      totalCount: reports.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });

describe("useAdminTesterReportsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads tester reports and reapplies filter params", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(buildListResponse([buildReport()], {}))
      .mockResolvedValueOnce(buildListResponse([buildReport()], {}));

    const { result } = renderHook(() => useAdminTesterReportsController({ enabled: true }));

    await waitFor(() => expect(result.current.testerReports).toHaveLength(1));
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/tester-reports?page=1&limit=25&hyberveesReview=unreviewed",
      expect.objectContaining({ method: "GET" })
    );

    act(() => {
      result.current.handleTesterReportStatusFilterChange("completed");
      result.current.handleTesterReportReviewFilterChange("reviewed");
      result.current.handleTesterReportTesterFilterChange("maya-chen");
    });

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/tester-reports?page=1&limit=25&status=completed&hyberveesReview=reviewed&tester=maya-chen",
        expect.objectContaining({ method: "GET" })
      )
    );
  });
});
