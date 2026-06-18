import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/account/media-compliance";

const requireApiUserMock = vi.fn();
const getMediaComplianceAcceptanceStatusForUserMock = vi.fn();
const saveMediaComplianceAcceptanceForUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/mediaComplianceAcceptance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/server/api/mediaComplianceAcceptance")>();
  return {
    ...actual,
    getMediaComplianceAcceptanceStatusForUser: (...args: unknown[]) =>
      getMediaComplianceAcceptanceStatusForUserMock(...args),
    saveMediaComplianceAcceptanceForUser: (...args: unknown[]) =>
      saveMediaComplianceAcceptanceForUserMock(...args),
  };
});

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockReturnValue(response);
  return response;
};

describe("/api/account/media-compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-123", email: "user@example.com" });
  });

  it("returns the caller's acceptance status", async () => {
    getMediaComplianceAcceptanceStatusForUserMock.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-04-25T14:00:00.000Z",
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(getMediaComplianceAcceptanceStatusForUserMock).toHaveBeenCalledWith("user-123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted: true,
        acceptedAt: "2026-04-25T14:00:00.000Z",
      })
    );
  });

  it("saves acceptance for the current version", async () => {
    saveMediaComplianceAcceptanceForUserMock.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-04-25T15:00:00.000Z",
    });

    const req = { method: "POST", headers: {}, body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveMediaComplianceAcceptanceForUserMock).toHaveBeenCalledWith({
      req,
      userId: "user-123",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted: true,
        acceptedAt: "2026-04-25T15:00:00.000Z",
      })
    );
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "DELETE" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("logs and returns 500 when the status lookup fails", async () => {
    getMediaComplianceAcceptanceStatusForUserMock.mockRejectedValue(new Error("lookup failed"));

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to process the media agreement request.",
      code: "MEDIA_COMPLIANCE_REQUEST_FAILED",
    });
  });

  it("logs auth verifier exceptions before compliance lookups", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(getMediaComplianceAcceptanceStatusForUserMock).not.toHaveBeenCalled();
    expect(saveMediaComplianceAcceptanceForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "account/media-compliance.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to process the media agreement request.",
      code: "MEDIA_COMPLIANCE_REQUEST_FAILED",
    });
  });

  it("returns 503 when the compliance service is unavailable", async () => {
    const unavailableError = Object.assign(
      new Error("Media agreement service is temporarily unavailable."),
      {
        code: "MEDIA_COMPLIANCE_UNAVAILABLE",
      }
    );
    getMediaComplianceAcceptanceStatusForUserMock.mockRejectedValue(unavailableError);

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media agreement service is temporarily unavailable.",
      code: "MEDIA_COMPLIANCE_UNAVAILABLE",
    });
  });

  it("logs auth verification outages before returning the auth helper response", async () => {
    requireApiUserMock.mockImplementation(async (_req: unknown, res: { statusCode: number }) => {
      res.statusCode = 503;
      return null;
    });

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "account/media-compliance.auth",
        scope: "app",
        metadata: expect.objectContaining({
          reason_code: "AUTH_VERIFICATION_UNAVAILABLE",
        }),
      })
    );
  });
});
