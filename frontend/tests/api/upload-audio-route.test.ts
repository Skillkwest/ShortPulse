import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-audio";

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
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/upload-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
