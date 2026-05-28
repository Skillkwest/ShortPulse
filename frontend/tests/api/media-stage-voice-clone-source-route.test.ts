import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/stage-voice-clone-source";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const uploadVoiceCloneSourceForUserMock = vi.fn();

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
    uploadVoiceCloneSourceForUser: (...args: unknown[]) =>
      uploadVoiceCloneSourceForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/stage-voice-clone-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    uploadVoiceCloneSourceForUserMock.mockResolvedValue({
      path: "user-1/voice-clone/source-audio/sample.wav",
      url: "https://signed.example/sample.wav",
      size: 128,
      mimeType: "audio/wav",
      name: "sample.wav",
    });
  });

  it("stages a local audio source into the voice-clone namespace", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(uploadVoiceCloneSourceForUserMock).toHaveBeenCalledWith({
      req,
      userId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      source: {
        storagePath: "user-1/voice-clone/source-audio/sample.wav",
        previewUrl: "https://signed.example/sample.wav",
        mimeType: "audio/wav",
        name: "sample.wav",
        size: 128,
      },
    });
  });

  it("returns service validation errors", async () => {
    const { MediaUploadServiceError } = await import("../../lib/server/mediaUploadService");
    uploadVoiceCloneSourceForUserMock.mockRejectedValueOnce(
      new MediaUploadServiceError(
        400,
        "Invalid file type",
        "Voice clone source file is not a supported audio format."
      )
    );
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details: "Voice clone source file is not a supported audio format.",
    });
  });

  it("returns a sanitized 500 when staging fails unexpectedly", async () => {
    uploadVoiceCloneSourceForUserMock.mockRejectedValueOnce(new Error("storage write exploded"));
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage voice clone source",
    });
  });
});
