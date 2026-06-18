import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/stage-voice-changer-source";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const finalizeVoiceChangerSourceUploadForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/mediaUploadService", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/mediaUploadService")>(
    "../../lib/server/mediaUploadService"
  );
  return {
    ...actual,
    finalizeVoiceChangerSourceUploadForUser: (...args: unknown[]) =>
      finalizeVoiceChangerSourceUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/stage-voice-changer-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    finalizeVoiceChangerSourceUploadForUserMock.mockResolvedValue({
      path: "user-1/voice-changer/source-audio/sample.wav",
      url: "https://signed.example/sample.wav",
      size: 128,
      mimeType: "audio/wav",
      name: "sample.wav",
    });
  });

  it("finalizes a staged local audio source", async () => {
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "sample.wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizeVoiceChangerSourceUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      kind: "audio",
      storagePath: "user-1/voice-changer/source-audio/sample.wav",
      filename: "sample.wav",
      declaredMimeType: "audio/wav",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: "user-1/voice-changer/source-audio/sample.wav",
        previewUrl: "https://signed.example/sample.wav",
        mimeType: "audio/wav",
        name: "sample.wav",
        size: 128,
      },
    });
  });

  it("finalizes a staged local video source", async () => {
    finalizeVoiceChangerSourceUploadForUserMock.mockResolvedValueOnce({
      path: "user-1/voice-changer/source-video/clip.mp4",
      url: "https://signed.example/clip.mp4",
      size: 1024,
      mimeType: "video/mp4",
      name: "clip.mp4",
    });
    const req = {
      method: "POST",
      body: {
        sourceKind: "video",
        sourceMimeType: "video/mp4",
        sourceName: "clip.mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizeVoiceChangerSourceUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      kind: "video",
      storagePath: "user-1/voice-changer/source-video/clip.mp4",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: "user-1/voice-changer/source-video/clip.mp4",
        previewUrl: "https://signed.example/clip.mp4",
        mimeType: "video/mp4",
        name: "clip.mp4",
        size: 1024,
      },
    });
  });

  it("rejects invalid requests before finalization", async () => {
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "",
        sourceName: "sample.wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizeVoiceChangerSourceUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source mime type is required.",
    });
  });

  it("logs auth verifier failures before rate limiting or upload finalization", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "sample.wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-stage-voice-changer-source.auth",
        scope: "generation",
      })
    );
    expect(finalizeVoiceChangerSourceUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage voice changer source",
    });
  });

  it("returns a sanitized 500 when finalization fails unexpectedly", async () => {
    finalizeVoiceChangerSourceUploadForUserMock.mockRejectedValueOnce(
      new Error("storage download exploded")
    );
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "sample.wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage voice changer source",
    });
  });

  it("rate limits repeated voice changer source staging for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "sample.wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = createMockResponse();
      await handler(buildReq() as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const res = createMockResponse();
    await handler(buildReq() as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
