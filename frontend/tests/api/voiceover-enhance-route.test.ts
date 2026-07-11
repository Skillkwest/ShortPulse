import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/voiceover-enhance";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const enhanceVoiceoverScriptMock = vi.fn();
const admitOpenAiInternalCapacityRequestMock = vi.fn();
const settleOpenAiInternalCapacityMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/voiceoverEnhancement", () => ({
  VOICEOVER_ENHANCE_MAX_CHARACTERS: 5000,
  enhanceVoiceoverScript: (...args: unknown[]) => enhanceVoiceoverScriptMock(...args),
}));

vi.mock("../../lib/server/api/openAiInternalCapacityAdmission", () => ({
  OpenAiInternalCapacityError: class OpenAiInternalCapacityError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  },
  resolveOpenAiInternalCapacityRequestId: () => "request-1",
  admitOpenAiInternalCapacityRequest: (...args: unknown[]) =>
    admitOpenAiInternalCapacityRequestMock(...args),
  extractOpenAiInternalCapacityUsage: () => ({}),
  settleOpenAiInternalCapacity: (...args: unknown[]) => settleOpenAiInternalCapacityMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/voiceover-enhance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    enhanceVoiceoverScriptMock.mockResolvedValue({
      ok: true,
      enhancedScript: "[thoughtful] Read this line.",
    });
    admitOpenAiInternalCapacityRequestMock.mockResolvedValue({ id: "admission-1" });
    settleOpenAiInternalCapacityMock.mockResolvedValue({ status: "completed" });
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
    expect(admitOpenAiInternalCapacityRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      lane: "ai.voiceover_enhance",
      requestId: "request-1",
      internalBudgetMicrousd: 25000,
      maxAttempts: 1,
    });
    expect(settleOpenAiInternalCapacityMock).toHaveBeenCalledWith({
      admissionId: "admission-1",
      userId: "user-1",
      status: "completed",
      usage: { requestCount: 1 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      enhancedScript: "[thoughtful] Read this line.",
    });
  });

  it("denies enhancement before provider work when paid capacity is unavailable", async () => {
    const { OpenAiInternalCapacityError } =
      await import("../../lib/server/api/openAiInternalCapacityAdmission");
    admitOpenAiInternalCapacityRequestMock.mockRejectedValueOnce(
      new OpenAiInternalCapacityError(
        402,
        "OPENAI_PAID_ACCESS_REQUIRED",
        "Choose a plan to use this AI feature."
      )
    );
    const req = { method: "POST", body: { script: "Read this line." } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enhanceVoiceoverScriptMock).not.toHaveBeenCalled();
    expect(settleOpenAiInternalCapacityMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose a plan to use this AI feature.",
      details: "OPENAI_PAID_ACCESS_REQUIRED",
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
    expect(admitOpenAiInternalCapacityRequestMock).not.toHaveBeenCalled();
  });
});
