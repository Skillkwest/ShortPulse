import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/voices/clone";
import { MAX_CUSTOM_VOICE_NAME_CHARACTERS } from "../../lib/customVoiceName";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const saveVoiceForUserMock = vi.fn();
const cleanupFailedElevenLabsCustomVoiceMock = vi.fn();
const createElevenLabsClonedVoiceMock = vi.fn();
const createPersistedElevenLabsVoiceSampleMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();
const recordVoiceSourceLifecycleStateMock = vi.fn();
const { MockMediaAudioExtractionInputError } = vi.hoisted(() => ({
  MockMediaAudioExtractionInputError: class MockMediaAudioExtractionInputError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = "MediaAudioExtractionInputError";
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  saveVoiceForUser: (...args: unknown[]) => saveVoiceForUserMock(...args),
}));

vi.mock("../../lib/server/elevenlabsCustomVoiceCleanup", () => ({
  cleanupFailedElevenLabsCustomVoice: (...args: unknown[]) =>
    cleanupFailedElevenLabsCustomVoiceMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  createElevenLabsClonedVoice: (...args: unknown[]) => createElevenLabsClonedVoiceMock(...args),
}));

vi.mock("../../lib/server/elevenlabsVoiceSamples", () => ({
  createPersistedElevenLabsVoiceSample: (...args: unknown[]) =>
    createPersistedElevenLabsVoiceSampleMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
  MediaAudioExtractionInputError: MockMediaAudioExtractionInputError,
}));

vi.mock("../../lib/server/voiceSourceLifecycle", () => ({
  VOICE_CLONE_SOURCE_RETENTION_DAYS: 90,
  recordVoiceSourceLifecycleState: (...args: unknown[]) =>
    recordVoiceSourceLifecycleStateMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/voices/clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    readStoredMediaBufferMock.mockResolvedValue({
      buffer: Buffer.from("voice-sample"),
      contentType: "audio/mpeg",
      size: 12,
    });
    createElevenLabsClonedVoiceMock.mockResolvedValue({
      voiceId: "cloned-voice-1",
      name: "Cloned Narrator",
      previewUrl: null,
      description: "Warm cloned narrator",
      isFallback: false,
    });
    createPersistedElevenLabsVoiceSampleMock.mockResolvedValue({
      previewUrl: "https://signed.example/voice-sample.mp3",
      sampleStoragePath: "user-1/voice-samples/cloned-voice-1/sample.mp3",
      mimeType: "audio/mpeg",
      providerRequestId: "tts-request-1",
    });
    cleanupFailedElevenLabsCustomVoiceMock.mockResolvedValue({
      providerVoiceDeleted: true,
      sampleDeleted: true,
      cleanupErrors: [],
    });
    saveVoiceForUserMock.mockResolvedValue({
      voiceId: "cloned-voice-1",
      name: "Cloned Narrator",
      previewUrl: "https://signed.example/voice-sample.mp3",
      description: "Warm cloned narrator",
      provider: "elevenlabs",
      isFallback: false,
      createdAt: new Date().toISOString(),
    });
    recordVoiceSourceLifecycleStateMock.mockResolvedValue({ recorded: true });
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
    expect(createPersistedElevenLabsVoiceSampleMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "cloned-voice-1",
    });
    expect(saveVoiceForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      voice: {
        voiceId: "cloned-voice-1",
        name: "Cloned Narrator",
        previewUrl: "https://signed.example/voice-sample.mp3",
        description: "Warm cloned narrator",
        sampleStoragePath: "user-1/voice-samples/cloned-voice-1/sample.mp3",
        originKind: "provider-user-created",
        savedSource: "voice-clone",
        providerDeleteEligible: true,
      },
    });
    expect(recordVoiceSourceLifecycleStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workflowKind: "voice_clone",
        sourceKind: "audio",
        storagePath: "user-1/voice-clone/source-audio/sample.mp3",
        state: "submitted",
        retentionDays: null,
      })
    );
    expect(recordVoiceSourceLifecycleStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workflowKind: "voice_clone",
        sourceKind: "audio",
        storagePath: "user-1/voice-clone/source-audio/sample.mp3",
        state: "retained_for_custom_voice",
        providerVoiceId: "cloned-voice-1",
        retentionDays: 90,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voice: {
        voiceId: "cloned-voice-1",
        name: "Cloned Narrator",
        previewUrl: "https://signed.example/voice-sample.mp3",
        description: "Warm cloned narrator",
        isFallback: false,
      },
    });
  });

  it("passes staged clone samples through to the ElevenLabs clone request", async () => {
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
        previewUrl: "https://signed.example/voice-sample.mp3",
        description: "Warm cloned narrator",
        isFallback: false,
      },
    });
  });

  it("logs auth verifier failures before storage reads, provider clone, samples, cleanup, or ownership persistence", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        voiceName: "Cloned Narrator",
        voiceDescription: "Warm cloned narrator",
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "elevenlabs-voice-clone.auth",
        scope: "generation",
      })
    );
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(createElevenLabsClonedVoiceMock).not.toHaveBeenCalled();
    expect(createPersistedElevenLabsVoiceSampleMock).not.toHaveBeenCalled();
    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(cleanupFailedElevenLabsCustomVoiceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to clone voice",
      details: "Unable to clone voice.",
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

  it("fails closed when ownership persistence does not succeed", async () => {
    saveVoiceForUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        voiceName: "Cloned Narrator",
        voiceDescription: "Warm cloned narrator",
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(cleanupFailedElevenLabsCustomVoiceMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "cloned-voice-1",
      sampleStoragePath: "user-1/voice-samples/cloned-voice-1/sample.mp3",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to clone voice",
      details: "This voice could not be saved securely. Try again.",
    });
  });

  it("rejects voice names that exceed the supported persisted length", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "a".repeat(MAX_CUSTOM_VOICE_NAME_CHARACTERS + 1),
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsClonedVoiceMock).not.toHaveBeenCalled();
    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: `voiceName must be between 1 and ${MAX_CUSTOM_VOICE_NAME_CHARACTERS} characters.`,
    });
  });

  it("returns local validation details when clone preparation fails before provider submit", async () => {
    createElevenLabsClonedVoiceMock.mockRejectedValueOnce(
      new MockMediaAudioExtractionInputError("Voice clone source must be a supported audio file.")
    );
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

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice clone source must be a supported audio file.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated voice clone requests for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        voiceName: "Cloned Narrator",
        voiceDescription: "Warm cloned narrator",
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
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

  it("logs and returns a server failure when clone preparation infrastructure is unavailable", async () => {
    const preparationError = Object.assign(
      new Error("Voice clone audio preparation is temporarily unavailable. Please try again."),
      {
        status: 503,
        statusCode: 503,
      }
    );
    createElevenLabsClonedVoiceMock.mockRejectedValueOnce(preparationError);
    const req = {
      method: "POST",
      body: {
        voiceName: "Recorded Clone",
        sourceStoragePath: "user-1/voice-clone/source-audio/recording.webm",
        sourceName: "recording.webm",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "elevenlabs-voice-clone",
        scope: "generation",
        error: preparationError,
      })
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to clone voice",
      details: "Voice clone audio preparation is temporarily unavailable. Please try again.",
    });
  });
});
