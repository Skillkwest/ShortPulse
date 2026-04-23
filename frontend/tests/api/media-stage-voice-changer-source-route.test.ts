import { PassThrough } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/stage-voice-changer-source";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const detectVideoMimeTypeMock = vi.fn();
const storageUploadMock = vi.fn();
const storageCreateSignedUrlMock = vi.fn();
const storageRemoveMock = vi.fn();
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

describe("POST /api/media/stage-voice-changer-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    detectVideoMimeTypeMock.mockReturnValue("video/mp4");
    storageUploadMock.mockResolvedValue({ error: null });
    storageCreateSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/staged-source" },
      error: null,
    });
    storageRemoveMock.mockResolvedValue({ error: null });
    storageFromMock.mockReturnValue({
      upload: storageUploadMock,
      createSignedUrl: storageCreateSignedUrlMock,
      remove: storageRemoveMock,
    });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: storageFromMock,
      },
    });
  });

  it("stages a local video source into the voice-changer namespace", async () => {
    const req = createRawRequest({
      body: Buffer.from("fake-video"),
      headers: {
        "content-type": "video/mp4",
        "x-shortpulse-upload-filename": "clip.mp4",
        "x-shortpulse-voice-changer-kind": "video",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(detectVideoMimeTypeMock).toHaveBeenCalledWith(Buffer.from("fake-video"));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: expect.stringMatching(/^user-1\/voice-changer\/source-video\//),
        previewUrl: "https://signed.example/staged-source",
        mimeType: "video/mp4",
        name: "clip.mp4",
        size: Buffer.from("fake-video").length,
      },
    });
  });

  it("stages a local audio source into the voice-changer namespace", async () => {
    const req = createRawRequest({
      body: Buffer.from("fake-audio"),
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "sample.mp3",
        "x-shortpulse-voice-changer-kind": "audio",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: expect.stringMatching(/^user-1\/voice-changer\/source-audio\//),
        previewUrl: "https://signed.example/staged-source",
        mimeType: "audio/mpeg",
        name: "sample.mp3",
        size: Buffer.from("fake-audio").length,
      },
    });
  });

  it("rejects oversized local video sources before storage write", async () => {
    const req = createRawRequest({
      body: Buffer.alloc(40 * 1024 * 1024 + 1, 1),
      headers: {
        "content-type": "video/mp4",
        "x-shortpulse-upload-filename": "too-large.mp4",
        "x-shortpulse-voice-changer-kind": "video",
      },
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again.",
    });
  });
});
