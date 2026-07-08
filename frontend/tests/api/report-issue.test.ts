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

  it("returns a safe failure when auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValue(authError);

    const req = {
      method: "POST",
      body: {
        message: "The dashboard spinner never settled.",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "api.report-issue.auth",
      })
    );
    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to save your report right now." });
  });

  it("stores a validated report for an authenticated user", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "report-1",
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
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

    expect(rpcMock).toHaveBeenCalledWith("create_user_issue_report_with_screenshots", {
      p_user_id: "user-1",
      p_submitter_email: "user@example.com",
      p_message: "The upload button stops responding after I rename a project.",
      p_source_path: "/dashboard",
      p_user_agent: "Mozilla/5.0 Test Browser",
      p_screenshots: [],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      reportId: "report-1",
    });
  });

  it("logs report insert failures while returning the safe customer error", async () => {
    const insertError = new Error("database temporarily unavailable");
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: insertError,
    });
    getSupabaseAdminMock.mockReturnValue({
      rpc: rpcMock,
    });

    const req = {
      method: "POST",
      body: {
        message: "I could not reopen my project.",
        sourcePath: "/ai-studio",
      },
      headers: {
        "user-agent": "Mozilla/5.0 Test Browser",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: insertError,
      routeLabel: "api.report-issue.insert",
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to save your report right now." });
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

  it("rejects too many screenshot references before opening Supabase", async () => {
    const req = {
      method: "POST",
      body: {
        message: "Help",
        screenshots: Array.from({ length: 4 }, (_value, index) => ({
          storagePath: `issue-reports/user-1/upload-${index}.png`,
          sourceName: `upload-${index}.png`,
          sourceMimeType: "image/png",
          sourceSize: 120,
        })),
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Issue reports can include up to 3 screenshots.",
      details: undefined,
    });
  });

  it("cleans up uploaded screenshot objects when verification fails", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const uploadId = "22222222-2222-4222-8222-222222222222";
    const storagePath = `issue-reports/${userId}/${uploadId}.png`;
    const downloadMock = vi.fn().mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      error: null,
    });
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const rpcMock = vi.fn();
    const fromMock = vi.fn().mockReturnValue({
      download: downloadMock,
      remove: removeMock,
    });
    requireApiUserMock.mockResolvedValue({ id: userId, email: "user@example.com" });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: fromMock,
      },
      rpc: rpcMock,
    });

    const req = {
      method: "POST",
      body: {
        message: "The image upload flow broke.",
        screenshots: [
          {
            storagePath,
            sourceName: "broken.png",
            sourceMimeType: "image/png",
            sourceSize: 4,
          },
        ],
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(downloadMock).toHaveBeenCalledWith(storagePath);
    expect(removeMock).toHaveBeenCalledWith([storagePath]);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Screenshot upload size did not match.",
      details: undefined,
    });
  });
});
