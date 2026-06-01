import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-audio";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/upload-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://signed.example/reference-audio" },
            error: null,
          })),
        })),
      },
    });
  });

  it("returns signed upload metadata through the dedicated audio adapter", async () => {
    const rawBody = Buffer.from("ID3-test-audio");
    const req = Object.assign(new EventEmitter(), {
      method: "POST",
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "reference.mp3",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", rawBody);
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/reference-audio",
      path: expect.stringMatching(/^user-1\/audio\/reference-grid\//),
      size: rawBody.length,
      mimeType: "audio/mpeg",
    });
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.media.upload_adapter.upload_audio_used",
        route: "upload-audio",
        userId: "user-1",
        userEmail: "u@example.com",
        metadata: expect.objectContaining({
          method: "POST",
          route_label: "upload-audio",
          file_size: rawBody.length,
        }),
      })
    );
  });

  it("accepts WAV aliases through the dedicated audio adapter", async () => {
    const rawBody = Buffer.from("RIFF0000WAVE", "ascii");
    const req = Object.assign(new EventEmitter(), {
      method: "POST",
      headers: {
        "content-type": "audio/wave",
        "x-shortpulse-upload-filename": "reference.wav",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", rawBody);
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/reference-audio",
      path: expect.stringMatching(/^user-1\/audio\/reference-grid\//),
      size: rawBody.length,
      mimeType: "audio/wav",
    });
  });

  it("returns a sanitized 500 when legacy audio upload fails unexpectedly", async () => {
    getSupabaseAdminMock.mockImplementationOnce(() => {
      throw new Error("storage exploded");
    });

    const rawBody = Buffer.from("ID3-test-audio");
    const req = Object.assign(new EventEmitter(), {
      method: "POST",
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "reference.mp3",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", rawBody);
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upload failed",
    });
  });

  it("rate limits repeated audio uploads for the same authenticated user", async () => {
    const buildReq = () =>
      Object.assign(new EventEmitter(), {
        method: "POST",
        headers: {
          "content-type": "audio/mpeg",
          "x-shortpulse-upload-filename": "reference.mp3",
        },
        destroy: vi.fn(),
        socket: { remoteAddress: "127.0.0.1" },
      });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const req = buildReq();
      const res = createMockResponse();
      const handlerPromise = handler(req as never, res as never);
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          req.emit("data", Buffer.from("ID3-test-audio"));
          req.emit("end");
          resolve();
        });
      });
      await handlerPromise;
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const req = buildReq();
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
