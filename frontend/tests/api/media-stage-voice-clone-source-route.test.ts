import { PassThrough } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/stage-voice-clone-source";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const areCompatibleMimeTypesMock = vi.fn();
const detectAudioMimeTypeMock = vi.fn();
const detectVideoMimeTypeMock = vi.fn();
const storageUploadMock = vi.fn();
const storageCreateSignedUrlMock = vi.fn();
const storageFromMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/uploadSignature", () => ({
  areCompatibleMimeTypes: (...args: unknown[]) => areCompatibleMimeTypesMock(...args),
  detectAudioMimeType: (...args: unknown[]) => detectAudioMimeTypeMock(...args),
  detectVideoMimeType: (...args: unknown[]) => detectVideoMimeTypeMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createRawRequest = ({ body, headers }: { body: Buffer; headers: Record<string, string> }) => {
  const req = new PassThrough() as PassThrough & {
    method: string;
    headers: Record<string, string>;
  };
  req.method = "POST";
  req.headers = headers;
  setTimeout(() => {
    req.end(body);
  }, 0);
  return req;
};

describe("POST /api/media/stage-voice-clone-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    storageUploadMock.mockResolvedValue({ error: null });
    storageCreateSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/clone-source" },
      error: null,
    });
    storageFromMock.mockReturnValue({
      upload: storageUploadMock,
      createSignedUrl: storageCreateSignedUrlMock,
    });
    areCompatibleMimeTypesMock.mockImplementation((declaredMimeType, detectedMimeType) => {
      return declaredMimeType === detectedMimeType;
    });
    detectAudioMimeTypeMock.mockReturnValue("audio/mpeg");
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: storageFromMock,
      },
    });
  });

  it("stages a local audio source into the voice-clone namespace", async () => {
    const req = createRawRequest({
      body: Buffer.from("fake-audio"),
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "sample.mp3",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: expect.stringMatching(/^user-1\/voice-clone\/source-audio\//),
        previewUrl: "https://signed.example/clone-source",
        mimeType: "audio/mpeg",
        name: "sample.mp3",
        size: Buffer.from("fake-audio").length,
      },
    });
  });

  it("rejects unsupported video sources", async () => {
    detectAudioMimeTypeMock.mockReturnValueOnce(null);
    const req = createRawRequest({
      body: Buffer.from("fake-video"),
      headers: {
        "content-type": "video/mp4",
        "x-shortpulse-upload-filename": "clip.mp4",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details: "Voice clone source file is not a supported audio format.",
    });
  });

  it("rejects mislabeled audio when the file bytes do not resolve to a supported audio signature", async () => {
    detectAudioMimeTypeMock.mockReturnValueOnce(null);
    const req = createRawRequest({
      body: Buffer.from("not-actually-audio"),
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "sample.mp3",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details: "Voice clone source file is not a supported audio format.",
    });
  });

  it("returns a sanitized 500 when staging fails unexpectedly", async () => {
    storageUploadMock.mockRejectedValueOnce(new Error("bucket write exploded"));
    const req = createRawRequest({
      body: Buffer.from("fake-audio"),
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "sample.mp3",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage voice clone source",
    });
  });
});
