import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/report-issue/screenshots/prepare";
import { IssueReportScreenshotError } from "../../lib/server/api/issueReportScreenshots";

const requireApiUserMock = vi.fn();
const enforceApiRateLimitMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const prepareIssueReportScreenshotUploadMock = vi.fn();
const cleanupStaleIssueReportScreenshotUploadsForUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/issueReportScreenshots", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/server/api/issueReportScreenshots")
  >("../../lib/server/api/issueReportScreenshots");
  return {
    ...actual,
    cleanupStaleIssueReportScreenshotUploadsForUser: (...args: unknown[]) =>
      cleanupStaleIssueReportScreenshotUploadsForUserMock(...args),
    prepareIssueReportScreenshotUpload: (...args: unknown[]) =>
      prepareIssueReportScreenshotUploadMock(...args),
  };
});

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/report-issue/screenshots/prepare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    enforceApiRateLimitMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue({ storage: {} });
    cleanupStaleIssueReportScreenshotUploadsForUserMock.mockResolvedValue({
      scanned: 0,
      removed: 0,
    });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {}, headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("prepares a signed upload target for the authenticated user", async () => {
    prepareIssueReportScreenshotUploadMock.mockResolvedValue({
      storagePath: "issue-reports/user-1/screenshot.png",
      uploadToken: "upload-token",
      mimeType: "image/png",
      maxBytes: 10485760,
    });
    const req = {
      method: "POST",
      body: { sourceMimeType: "image/png", sourceSize: 512 },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareIssueReportScreenshotUploadMock).toHaveBeenCalledWith(
      { storage: {} },
      {
        userId: "user-1",
        sourceMimeType: "image/png",
        sourceSize: 512,
      }
    );
    expect(cleanupStaleIssueReportScreenshotUploadsForUserMock).toHaveBeenCalledWith(
      { storage: {} },
      { userId: "user-1" }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: "issue-reports/user-1/screenshot.png",
        uploadToken: "upload-token",
        mimeType: "image/png",
        maxBytes: 10485760,
      },
    });
  });

  it("logs stale cleanup failures without blocking upload preparation", async () => {
    cleanupStaleIssueReportScreenshotUploadsForUserMock.mockRejectedValue(
      new Error("storage list failed")
    );
    prepareIssueReportScreenshotUploadMock.mockResolvedValue({
      storagePath: "issue-reports/user-1/screenshot.png",
      uploadToken: "upload-token",
      mimeType: "image/png",
      maxBytes: 10485760,
    });
    const req = {
      method: "POST",
      body: { sourceMimeType: "image/png", sourceSize: 512 },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "api.report-issue.screenshots.prepare.cleanup",
        user: { id: "user-1", email: "user@example.com" },
      })
    );
    expect(prepareIssueReportScreenshotUploadMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns helper validation errors without logging internals", async () => {
    prepareIssueReportScreenshotUploadMock.mockRejectedValue(
      new IssueReportScreenshotError(413, "Screenshot file is too large.")
    );
    const req = {
      method: "POST",
      body: { sourceMimeType: "image/png", sourceSize: 99999999 },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Screenshot file is too large.",
      details: undefined,
    });
  });
});
