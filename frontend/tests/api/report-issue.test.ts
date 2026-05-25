import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ISSUE_REPORT_MESSAGE_MAX_LENGTH,
  ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH,
} from "../../lib/issueReports";
import handler from "../../pages/api/report-issue";

const requireApiUserMock = vi.fn();
const enforceApiRateLimitMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
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

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/report-issue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    enforceApiRateLimitMock.mockReturnValue(true);
  });

  it("rejects reports that exceed the supported message length", async () => {
    const req = {
      method: "POST",
      body: {
        message: "x".repeat(ISSUE_REPORT_MESSAGE_MAX_LENGTH + 1),
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `Issue reports must be ${ISSUE_REPORT_MESSAGE_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects invalid route context paths", async () => {
    const req = {
      method: "POST",
      body: {
        message: "The dashboard spinner never settled.",
        sourcePath: "https://example.com/help",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Issue context paths must be a valid ShortPulse route.",
    });
  });

  it("stores a validated report for an authenticated user", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: "report-1" },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
    });

    const req = {
      method: "POST",
      body: {
        message: "The upload button stops responding after I rename a project.",
        sourcePath: "/dashboard",
      },
      headers: {
        "user-agent": "Mozilla/5.0 Test Browser",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("user_issue_reports");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      submitter_email: "user@example.com",
      message: "The upload button stops responding after I rename a project.",
      source_path: "/dashboard",
      user_agent: "Mozilla/5.0 Test Browser",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      reportId: "report-1",
    });
  });

  it("rejects oversized route context values instead of clipping them", async () => {
    const req = {
      method: "POST",
      body: {
        message: "Help",
        sourcePath: `/${"a".repeat(ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH)}`,
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `Issue context paths must be ${ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH} characters or fewer.`,
    });
  });
});
