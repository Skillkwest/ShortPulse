import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/tester-reports-review";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const validReportId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/admin/tester-reports-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("marks a tester report as reviewed by Hybervees", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: validReportId,
        hybervees_review_status: "reviewed",
        hybervees_reviewed_by: "hybervees",
      },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ update })),
    });
    const req = {
      method: "POST",
      body: {
        reportId: validReportId,
        status: "reviewed",
        summary: "Reference Grid labels need clearer first-run guidance.",
        insightArtifactPath:
          "docs/records/artifacts/agent/hybervees/reports/2026-07-06-reference-grid.md",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        hybervees_review_status: "reviewed",
        hybervees_reviewed_by: "hybervees",
        hybervees_insight_summary: "Reference Grid labels need clearer first-run guidance.",
        hybervees_insight_artifact_path:
          "docs/records/artifacts/agent/hybervees/reports/2026-07-06-reference-grid.md",
      })
    );
    expect(eq).toHaveBeenCalledWith("id", validReportId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({ hybervees_review_status: "reviewed" }),
      })
    );
  });

  it("maps invalid payloads to 400", async () => {
    const req = {
      method: "POST",
      body: { reportId: validReportId, status: "done" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid Hybervees review status." });
  });
});
