import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminReportsController } from "../useAdminReportsController";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

const buildReport = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "report-1",
  user_id: "user-1",
  submitter_email: "alpha@example.com",
  message: "Generation failed on upload.",
  status: "new",
  admin_notes: "",
  source_path: "/dashboard",
  user_agent: "Mozilla/5.0",
  reviewed_at: null,
  reviewed_by_user_id: null,
  created_at: "2026-05-24T18:00:00.000Z",
  updated_at: "2026-05-24T18:00:00.000Z",
  ...overrides,
});

const buildListResponse = (reports: unknown[], summaryOverrides: Record<string, number>) =>
  jsonResponse({
    reports,
    summary: {
      totalCount: 1,
      newCount: 1,
      reviewingCount: 0,
      resolvedCount: 0,
      ...summaryOverrides,
    },
    pagination: {
      page: 1,
      perPage: 50,
      totalCount: reports.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });

describe("useAdminReportsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reapplies the active filters after a report status change", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(buildListResponse([buildReport()], {}))
      .mockResolvedValueOnce(buildListResponse([buildReport()], {}))
      .mockResolvedValueOnce(
        jsonResponse({
          report: buildReport({
            status: "resolved",
            reviewed_at: "2026-05-24T18:05:00.000Z",
            reviewed_by_user_id: "admin-1",
          }),
        })
      )
      .mockResolvedValueOnce(
        buildListResponse([], {
          totalCount: 1,
          newCount: 0,
          reviewingCount: 0,
          resolvedCount: 1,
        })
      );

    const { result } = renderHook(() => useAdminReportsController({ enabled: true }));

    await waitFor(() => expect(result.current.reports).toHaveLength(1));

    act(() => {
      result.current.handleReportStatusFilterChange("new");
    });

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/reports?page=1&limit=50&status=new",
        expect.objectContaining({ method: "GET" })
      )
    );

    await act(async () => {
      await result.current.handleUpdateReport("report-1", { status: "resolved" });
    });

    await waitFor(() => expect(result.current.reports).toHaveLength(0));

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/reports/report-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(result.current.reportSummary).toMatchObject({
      totalCount: 1,
      newCount: 0,
      reviewingCount: 0,
      resolvedCount: 1,
    });
  });
});
