import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/voiceover-enhance";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const enhanceVoiceoverScriptMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/voiceoverEnhancement", () => ({
  enhanceVoiceoverScript: (...args: unknown[]) => enhanceVoiceoverScriptMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/voiceover-enhance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    enhanceVoiceoverScriptMock.mockResolvedValue({
      ok: true,
      enhancedScript: "[thoughtful] Read this line.",
    });
  });

  it("rejects non-POST requests", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(requireApiUserMock).not.toHaveBeenCalled();
    expect(enhanceVoiceoverScriptMock).not.toHaveBeenCalled();
  });

  it("logs auth verifier failures before enhancement work", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth exploded"));
    const req = { method: "POST", body: { script: "Read this line." } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "ai/voiceover-enhance.auth",
        scope: "generation",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(enhanceVoiceoverScriptMock).not.toHaveBeenCalled();
  });

  it("returns the enhanced script for authenticated callers", async () => {
    const req = { method: "POST", body: { script: "Read this line." } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enhanceVoiceoverScriptMock).toHaveBeenCalledWith({
      script: "Read this line.",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      enhancedScript: "[thoughtful] Read this line.",
    });
  });

  it("returns structured enhancement failures", async () => {
    enhanceVoiceoverScriptMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "Invalid request",
      details: "script is required.",
    });
    const req = { method: "POST", body: { script: "" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "script is required.",
    });
  });
});
