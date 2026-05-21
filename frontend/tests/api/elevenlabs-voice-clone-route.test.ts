import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/voices/clone";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const saveVoiceForUserMock = vi.fn();
const createElevenLabsClonedVoiceMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  saveVoiceForUser: (...args: unknown[]) => saveVoiceForUserMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  createElevenLabsClonedVoice: (...args: unknown[]) => createElevenLabsClonedVoiceMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/voices/clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    readStoredMediaBufferMock.mockResolvedValue({
      buffer: Buffer.from("voice-sample"),
      contentType: "audio/mpeg",
      size: 12,
    });
    createElevenLabsClonedVoiceMock.mockResolvedValue({
      voiceId: "cloned-voice-1",
      name: "Cloned Narrator",
      previewUrl: "https://cdn.example/cloned.mp3",
      description: "Warm cloned narrator",
      isFallback: false,
    });
    saveVoiceForUserMock.mockResolvedValue({
      voiceId: "cloned-voice-1",
      name: "Cloned Narrator",
      previewUrl: "https://cdn.example/cloned.mp3",
      description: "Warm cloned narrator",
      provider: "elevenlabs",
      isFallback: false,
      createdAt: new Date().toISOString(),
    });
  });

  it("creates and saves a cloned provider voice from staged audio", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "Cloned Narrator",
        voiceDescription: "Warm cloned narrator",
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
        sourceName: "sample.mp3",
        removeBackgroundNoise: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readStoredMediaBufferMock).toHaveBeenCalledWith({
      storagePath: "user-1/voice-clone/source-audio/sample.mp3",
      maxBytes: 100 * 1024 * 1024,
    });
    expect(createElevenLabsClonedVoiceMock).toHaveBeenCalledWith({
      voiceName: "Cloned Narrator",
      voiceDescription: "Warm cloned narrator",
      sourceBuffer: Buffer.from("voice-sample"),
      sourceFilename: "sample.mp3",
      sourceMimeType: "audio/mpeg",
      removeBackgroundNoise: true,
    });
    expect(saveVoiceForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      voice: {
        voiceId: "cloned-voice-1",
        name: "Cloned Narrator",
        previewUrl: "https://cdn.example/cloned.mp3",
        description: "Warm cloned narrator",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voice: {
        voiceId: "cloned-voice-1",
        name: "Cloned Narrator",
        previewUrl: "https://cdn.example/cloned.mp3",
        description: "Warm cloned narrator",
        isFallback: false,
      },
    });
  });

  it("allows shorter samples through to the ElevenLabs clone request", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "Too Short",
        sourceStoragePath: "user-1/voice-clone/source-audio/short.mp3",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsClonedVoiceMock).toHaveBeenCalledWith({
      voiceName: "Too Short",
      voiceDescription: null,
      sourceBuffer: Buffer.from("voice-sample"),
      sourceFilename: "short.mp3",
      sourceMimeType: "audio/mpeg",
      removeBackgroundNoise: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voice: {
        voiceId: "cloned-voice-1",
        name: "Cloned Narrator",
        previewUrl: "https://cdn.example/cloned.mp3",
        description: "Warm cloned narrator",
        isFallback: false,
      },
    });
  });

  it("returns provider validation details when ElevenLabs rejects the clone", async () => {
    const providerError = new Error("Voice clone source audio is too short.") as Error & {
      status: number;
    };
    providerError.status = 422;
    createElevenLabsClonedVoiceMock.mockRejectedValueOnce(providerError);
    const req = {
      method: "POST",
      body: {
        voiceName: "Rejected Clone",
        sourceStoragePath: "user-1/voice-clone/source-audio/source.mp3",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to clone voice",
      details: "Voice clone source audio is too short.",
    });
  });

  it("rejects non-audio staged sources before the ElevenLabs clone request", async () => {
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("video"),
      contentType: "video/mp4",
      size: 12,
    });
    const req = {
      method: "POST",
      body: {
        voiceName: "Video Source",
        sourceStoragePath: "user-1/voice-clone/source-audio/source.mp4",
        sourceName: "source.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsClonedVoiceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice clone source must be a supported audio file.",
    });
  });
});
