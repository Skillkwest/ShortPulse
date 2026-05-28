import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prepare-voice-changer-source-upload";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const prepareVoiceChangerSourceUploadForUserMock = vi.fn();

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
    prepareVoiceChangerSourceUploadForUser: (...args: unknown[]) =>
      prepareVoiceChangerSourceUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/prepare-voice-changer-source-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    prepareVoiceChangerSourceUploadForUserMock.mockResolvedValue({
      path: "user-1/voice-changer/source-video/clip.mp4",
      token: "token-1",
      mimeType: "video/mp4",
      name: "clip.mp4",
    });
  });

  it("returns a signed upload target for a local voice changer source", async () => {
    const req = {
      method: "POST",
      body: {
        sourceKind: "video",
        sourceMimeType: "video/mp4",
        sourceName: "clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareVoiceChangerSourceUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      kind: "video",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: "user-1/voice-changer/source-video/clip.mp4",
        uploadToken: "token-1",
        mimeType: "video/mp4",
        name: "clip.mp4",
      },
    });
  });

  it("rejects missing source fields", async () => {
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareVoiceChangerSourceUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source name is required.",
    });
  });

  it("returns a sanitized 500 when preparation fails unexpectedly", async () => {
    prepareVoiceChangerSourceUploadForUserMock.mockRejectedValueOnce(
      new Error("signed upload target exploded")
    );
    const req = {
      method: "POST",
      body: {
        sourceKind: "audio",
        sourceMimeType: "audio/wav",
        sourceName: "sample.wav",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare voice changer upload",
    });
  });
});
