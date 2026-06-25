import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-voice/create";
import { MAX_CUSTOM_VOICE_NAME_CHARACTERS } from "../../lib/customVoiceName";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const saveVoiceForUserMock = vi.fn();
const cleanupFailedElevenLabsCustomVoiceMock = vi.fn();
const createElevenLabsDesignedVoiceMock = vi.fn();
const createPersistedElevenLabsVoiceSampleMock = vi.fn();
const verifyVoiceDesignPreviewTokenMock = vi.fn();

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
  createElevenLabsDesignedVoice: (...args: unknown[]) => createElevenLabsDesignedVoiceMock(...args),
}));

vi.mock("../../lib/server/elevenlabsVoiceDesignTokens", () => ({
  verifyVoiceDesignPreviewToken: (...args: unknown[]) => verifyVoiceDesignPreviewTokenMock(...args),
}));

vi.mock("../../lib/server/elevenlabsVoiceSamples", () => ({
  createPersistedElevenLabsVoiceSample: (...args: unknown[]) =>
    createPersistedElevenLabsVoiceSampleMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/text-to-voice/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    verifyVoiceDesignPreviewTokenMock.mockReturnValue(true);
    createElevenLabsDesignedVoiceMock.mockResolvedValue({
      voiceId: "generated-voice-1",
      name: "Generated Narrator",
      previewUrl: null,
      description: "Measured, warm narration with a gentle documentary tone.",
      isFallback: false,
    });
    createPersistedElevenLabsVoiceSampleMock.mockResolvedValue({
      previewUrl: "https://signed.example/generated-sample.mp3",
      sampleStoragePath: "user-1/voice-samples/generated-voice-1/sample.mp3",
      mimeType: "audio/mpeg",
      providerRequestId: "tts-request-1",
    });
    cleanupFailedElevenLabsCustomVoiceMock.mockResolvedValue({
      providerVoiceDeleted: true,
      sampleDeleted: true,
      cleanupErrors: [],
    });
    saveVoiceForUserMock.mockResolvedValue({
      voiceId: "generated-voice-1",
      name: "Generated Narrator",
      previewUrl: "https://signed.example/generated-sample.mp3",
      description: "Measured, warm narration with a gentle documentary tone.",
      provider: "elevenlabs",
      isFallback: false,
      createdAt: new Date().toISOString(),
    });
  });

  it("creates a designed voice, generates its sample, and saves the sample-backed preview", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
        playedNotSelectedVoiceIds: ["preview-2", "preview-1"],
        playedNotSelectedVoiceTokens: ["token-preview-2", "token-preview-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsDesignedVoiceMock).toHaveBeenCalledWith({
      voiceName: "Generated Narrator",
      voiceDescription: "Measured, warm narration with a gentle documentary tone.",
      generatedVoiceId: "preview-1",
      playedNotSelectedVoiceIds: ["preview-2"],
    });
    expect(createPersistedElevenLabsVoiceSampleMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "generated-voice-1",
    });
    expect(saveVoiceForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      voice: {
        voiceId: "generated-voice-1",
        name: "Generated Narrator",
        previewUrl: "https://signed.example/generated-sample.mp3",
        description: "Measured, warm narration with a gentle documentary tone.",
        sampleStoragePath: "user-1/voice-samples/generated-voice-1/sample.mp3",
        originKind: "provider-user-created",
        savedSource: "text-to-voice-create",
        providerDeleteEligible: true,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voice: {
        voiceId: "generated-voice-1",
        name: "Generated Narrator",
        previewUrl: "https://signed.example/generated-sample.mp3",
        description: "Measured, warm narration with a gentle documentary tone.",
        isFallback: false,
      },
    });
  });

  it("does not save a voice when sample generation fails", async () => {
    const sampleError = new Error("Unable to generate sample.");
    createPersistedElevenLabsVoiceSampleMock.mockRejectedValueOnce(sampleError);
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(cleanupFailedElevenLabsCustomVoiceMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "generated-voice-1",
      sampleStoragePath: null,
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "elevenlabs-text-to-voice-create",
        scope: "generation",
        error: sampleError,
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to create voice",
      details: "Unable to generate sample.",
    });
  });

  it("logs auth verifier failures before tokens, provider creation, samples, cleanup, or ownership persistence", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "elevenlabs-text-to-voice-create.auth",
        scope: "generation",
      })
    );
    expect(verifyVoiceDesignPreviewTokenMock).not.toHaveBeenCalled();
    expect(createElevenLabsDesignedVoiceMock).not.toHaveBeenCalled();
    expect(createPersistedElevenLabsVoiceSampleMock).not.toHaveBeenCalled();
    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(cleanupFailedElevenLabsCustomVoiceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to create voice",
      details: "Unable to create voice.",
    });
  });

  it("fails closed when ownership persistence does not succeed", async () => {
    saveVoiceForUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(cleanupFailedElevenLabsCustomVoiceMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "generated-voice-1",
      sampleStoragePath: "user-1/voice-samples/generated-voice-1/sample.mp3",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to create voice",
      details: "This voice could not be saved securely. Try again.",
    });
  });

  it("rejects voice names that exceed the supported persisted length", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "a".repeat(MAX_CUSTOM_VOICE_NAME_CHARACTERS + 1),
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsDesignedVoiceMock).not.toHaveBeenCalled();
    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: `voiceName must be between 1 and ${MAX_CUSTOM_VOICE_NAME_CHARACTERS} characters.`,
    });
  });

  it("rejects preview ids that were not issued to the current user", async () => {
    verifyVoiceDesignPreviewTokenMock.mockReturnValueOnce(false);
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "foreign-preview-token",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createElevenLabsDesignedVoiceMock).not.toHaveBeenCalled();
    expect(createPersistedElevenLabsVoiceSampleMock).not.toHaveBeenCalled();
    expect(saveVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice preview is unavailable",
      details: "The selected voice preview is no longer available for this account.",
    });
  });

  it("rate limits repeated voice creation requests for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
        generatedVoiceToken: "token-preview-1",
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
});
