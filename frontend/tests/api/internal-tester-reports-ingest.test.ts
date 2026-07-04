import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/tester-reports/ingest";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

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

const buildValidPayload = (overrides: Record<string, unknown> = {}) => ({
  externalRunId: "maya-2026-07-04-orientation",
  testerSlug: "maya-chen",
  testerDisplayName: "Maya Chen",
  shortpulseUserId: "11111111-1111-4111-8111-111111111111",
  shortpulseUserEmail: "maya@example.com",
  scenario: "Authenticated orientation",
  status: "completed",
  runStartedAt: "2026-07-04T15:00:00.000Z",
  runFinishedAt: "2026-07-04T15:45:00.000Z",
  durationMinutes: 45,
  creditsSpent: 0,
  productionSurface: "https://www.shortpulse.ai/ai-studio",
  personaReportTitle: "Maya report",
  personaReportBody: "I explored the app like a creator.",
  engineeringReportTitle: "Engineering handoff",
  engineeringReportBody: "Inspect draft persistence and save confidence.",
  reportArtifactPaths: ["docs/testers/maya-chen/reports/report.md"],
  evidence: { screenshots: 2 },
  ...overrides,
});

describe("POST /api/internal/tester-reports/ingest", () => {
  const originalSecret = process.env.SHORTPULSE_TESTER_REPORT_INGEST_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_TESTER_REPORT_INGEST_SECRET = "secret-123";
  });

  afterEach(() => {
    process.env.SHORTPULSE_TESTER_REPORT_INGEST_SECRET = originalSecret;
  });

  it("rejects unauthorized requests before touching Supabase", async () => {
    const req = { method: "POST", headers: {}, body: buildValidPayload() };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("validates both report bodies before writing", async () => {
    const req = {
      method: "POST",
      headers: { "x-shortpulse-tester-report-secret": "secret-123" },
      body: buildValidPayload({ engineeringReportBody: "" }),
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "engineeringReportBody is required." });
  });

  it("upserts a validated tester report run by external id", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: "run-row-1", external_run_id: "maya-2026-07-04-orientation" },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ upsert: upsertMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer secret-123" },
      body: buildValidPayload(),
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("tester_report_runs");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        external_run_id: "maya-2026-07-04-orientation",
        tester_slug: "maya-chen",
        tester_display_name: "Maya Chen",
        shortpulse_user_email: "maya@example.com",
        persona_report_body: "I explored the app like a creator.",
        engineering_report_body: "Inspect draft persistence and save confidence.",
      }),
      { onConflict: "external_run_id" }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      reportRunId: "run-row-1",
      externalRunId: "maya-2026-07-04-orientation",
    });
  });
});
