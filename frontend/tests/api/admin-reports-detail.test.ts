import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH } from "../../lib/issueReports";
import handler from "../../pages/api/admin/reports/[reportId]";

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
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("PATCH /api/admin/reports/[reportId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects admin notes that exceed the supported length", async () => {
    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { adminNotes: "a".repeat(ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH + 1) },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `Admin notes must be ${ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { status: "reviewing" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.admin.reports.[reportId].auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to verify report access." });
  });

  it("logs detail load query failures before returning the safe load error", async () => {
    const loadError = { message: "detail load failed" };
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: loadError,
    });
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "GET",
      query: { reportId: "report-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: loadError,
      routeLabel: "api.admin.reports.[reportId].get",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        report_id: "report-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load that report right now." });
  });

  it("logs report update failures before returning the safe update error", async () => {
    const updateError = { message: "report update failed" };
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: updateError,
    });
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "PATCH",
      query: { reportId: "report-1" },
      body: { status: "reviewing" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: updateError,
      routeLabel: "api.admin.reports.[reportId].patch",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        report_id: "report-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update that report right now." });
  });

  it("returns signed screenshots with a loaded report", async () => {
    const reportMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "report-1",
        user_id: "user-1",
        submitter_email: "user@example.com",
        message: "The canvas froze.",
        status: "new",
      },
      error: null,
    });
    const reportEqMock = vi.fn(() => ({ maybeSingle: reportMaybeSingleMock }));
    const reportSelectMock = vi.fn(() => ({ eq: reportEqMock }));
    const screenshotOrderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "screenshot-1",
          report_id: "report-1",
          storage_path:
            "issue-reports/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
          original_filename: "canvas.png",
          content_type: "image/png",
          file_size_bytes: 512,
          width: 800,
          height: 600,
          display_order: 0,
          created_at: "2026-05-25T14:46:50.000Z",
        },
      ],
      error: null,
    });
    const screenshotInMock = vi.fn(() => ({ order: screenshotOrderMock }));
    const screenshotSelectMock = vi.fn(() => ({ in: screenshotInMock }));
    const fromMock = vi.fn((table: string) =>
      table === "user_issue_report_screenshots"
        ? { select: screenshotSelectMock }
        : { select: reportSelectMock }
    );
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/canvas.png" },
      error: null,
    });
    const storageFromMock = vi.fn(() => ({ createSignedUrl: createSignedUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock, storage: { from: storageFromMock } });

    const req = {
      method: "GET",
      query: { reportId: "report-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      report: expect.objectContaining({
        id: "report-1",
        screenshots: [
          expect.objectContaining({
            id: "screenshot-1",
            signed_url: "https://signed.example/canvas.png",
            unavailable_reason: null,
          }),
        ],
      }),
    });
  });

  it("keeps detail loadable when a screenshot URL cannot be signed", async () => {
    const signError = new Error("object missing");
    const reportMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "report-1",
        user_id: "user-1",
        submitter_email: "user@example.com",
        message: "The canvas froze.",
        status: "new",
      },
      error: null,
    });
    const reportEqMock = vi.fn(() => ({ maybeSingle: reportMaybeSingleMock }));
    const reportSelectMock = vi.fn(() => ({ eq: reportEqMock }));
    const screenshotOrderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "screenshot-1",
          report_id: "report-1",
          storage_path:
            "issue-reports/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
          original_filename: "canvas.png",
          content_type: "image/png",
          file_size_bytes: 512,
          width: null,
          height: null,
          display_order: 0,
          created_at: "2026-05-25T14:46:50.000Z",
        },
      ],
      error: null,
    });
    const screenshotInMock = vi.fn(() => ({ order: screenshotOrderMock }));
    const screenshotSelectMock = vi.fn(() => ({ in: screenshotInMock }));
    const fromMock = vi.fn((table: string) =>
      table === "user_issue_report_screenshots"
        ? { select: screenshotSelectMock }
        : { select: reportSelectMock }
    );
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: null,
      error: signError,
    });
    const storageFromMock = vi.fn(() => ({ createSignedUrl: createSignedUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock, storage: { from: storageFromMock } });

    const req = {
      method: "GET",
      query: { reportId: "report-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: signError,
      routeLabel: "api.admin.reports.[reportId].screenshot-sign",
      user: { id: "admin-1", email: "admin@example.com" },
      metadata: {
        report_id: "report-1",
        screenshot_id: "screenshot-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      report: expect.objectContaining({
        id: "report-1",
        screenshots: [
          expect.objectContaining({
            id: "screenshot-1",
            signed_url: null,
            unavailable_reason: "Screenshot file is unavailable.",
          }),
        ],
      }),
    });
  });
});
