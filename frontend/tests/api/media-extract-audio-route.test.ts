import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/extract-audio";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();
const makeTempFileHandleMock = vi.fn();
const extractAudioTrackMock = vi.fn();
const readFileMock = vi.fn();
const assertTrustedRemoteMediaUrlMock = vi.fn();
const { MockTrustedRemoteMediaUrlError, MockMediaAudioExtractionInputError } = vi.hoisted(() => {
  class TrustedRemoteMediaUrlError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  class MediaAudioExtractionInputError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    MockTrustedRemoteMediaUrlError: TrustedRemoteMediaUrlError,
    MockMediaAudioExtractionInputError: MediaAudioExtractionInputError,
  };
});

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/trustedRemoteMediaUrl", () => ({
  assertTrustedRemoteMediaUrl: (...args: unknown[]) => assertTrustedRemoteMediaUrlMock(...args),
  TrustedRemoteMediaUrlError: MockTrustedRemoteMediaUrlError,
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
  makeTempFileHandle: (...args: unknown[]) => makeTempFileHandleMock(...args),
  extractAudioTrack: (...args: unknown[]) => extractAudioTrackMock(...args),
  readRemoteMediaBuffer: vi.fn(),
  MAX_VOICE_CHANGER_SOURCE_BYTES: 40 * 1024 * 1024,
  MediaAudioExtractionInputError: MockMediaAudioExtractionInputError,
  isVideoSource: (mimeType: string | null, filename: string | null) =>
    Boolean(mimeType?.startsWith("video/") || filename?.endsWith(".mp4")),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/extract-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    assertTrustedRemoteMediaUrlMock.mockReset();
    makeTempFileHandleMock.mockResolvedValue({
      path: "/tmp/source.mp4",
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
    extractAudioTrackMock.mockResolvedValue({
      path: "/tmp/extracted.wav",
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
    readFileMock.mockResolvedValue(Buffer.from("wav-audio"));
    vi.spyOn(fs.promises, "readFile").mockImplementation((...args) => readFileMock(...args));
    readStoredMediaBufferMock.mockResolvedValue({
      buffer: Buffer.from("video-source"),
      contentType: "video/mp4",
      size: Buffer.from("video-source").length,
    });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://signed.example/extracted-source.wav" },
            error: null,
          })),
        })),
      },
    });
  });

  it("extracts and stores audio for a user-scoped stored video source", async () => {
    const req = {
      method: "POST",
      body: {
        sourceName: "clip.mp4",
        sourceOrigin: "local",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readStoredMediaBufferMock).toHaveBeenCalledWith({
      storagePath: "user-1/voice-changer/source-video/clip.mp4",
      maxBytes: 40 * 1024 * 1024,
    });
    expect(makeTempFileHandleMock).toHaveBeenCalledWith({
      buffer: Buffer.from("video-source"),
      extension: "mp4",
    });
    expect(extractAudioTrackMock).toHaveBeenCalledWith({
      sourcePath: "/tmp/source.mp4",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      audio: {
        name: "clip.wav",
        mimeType: "audio/wav",
        previewUrl: "https://signed.example/extracted-source.wav",
        storagePath: expect.stringMatching(/^user-1\/voice-changer\/staged-audio\//),
        size: Buffer.from("wav-audio").length,
      },
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects non-video sources before extraction", async () => {
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("audio-source"),
      contentType: "audio/wav",
      size: Buffer.from("audio-source").length,
    });

    const req = {
      method: "POST",
      body: {
        sourceName: "sample.wav",
        sourceOrigin: "local",
        sourceMimeType: "audio/wav",
        sourceStoragePath: "user-1/voice-changer/source-audio/sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Audio extraction is only supported for video sources.",
    });
    expect(extractAudioTrackMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("returns the trusted URL validation status for invalid remote media", async () => {
    assertTrustedRemoteMediaUrlMock.mockRejectedValueOnce(
      new MockTrustedRemoteMediaUrlError(
        "Voice changer source URL is not a trusted media URL.",
        400
      )
    );

    const req = {
      method: "POST",
      body: {
        sourceName: "clip.mp4",
        sourceOrigin: "url",
        sourceMimeType: "video/mp4",
        sourceUrl: "https://untrusted.example/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source URL is not a trusted media URL.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("returns 413 when the staged video exceeds the extraction byte limit", async () => {
    readStoredMediaBufferMock.mockRejectedValueOnce(
      new MockMediaAudioExtractionInputError(
        "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again.",
        413
      )
    );

    const req = {
      method: "POST",
      body: {
        sourceName: "clip.mp4",
        sourceOrigin: "local",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again.",
    });
    expect(extractAudioTrackMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("returns a sanitized 500 when extraction storage fails unexpectedly", async () => {
    getSupabaseAdminMock.mockReturnValueOnce({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: { message: "storage write exploded" } })),
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://signed.example/extracted-source.wav" },
            error: null,
          })),
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        sourceName: "clip.mp4",
        sourceOrigin: "local",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to extract audio",
    });
  });

  it("rate limits repeated audio extraction requests for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        sourceName: "clip.mp4",
        sourceOrigin: "local",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/clip.mp4",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
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
