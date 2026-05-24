import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-voice/create";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const saveVoiceForUserMock = vi.fn();
const cleanupFailedElevenLabsCustomVoiceMock = vi.fn();
const createElevenLabsDesignedVoiceMock = vi.fn();
const createPersistedElevenLabsVoiceSampleMock = vi.fn();

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

vi.mock("../../lib/server/elevenlabsVoiceSamples", () => ({
  createPersistedElevenLabsVoiceSample: (...args: unknown[]) =>
    createPersistedElevenLabsVoiceSampleMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/text-to-voice/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
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
        playedNotSelectedVoiceIds: ["preview-2", "preview-1"],
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

  it("fails closed when ownership persistence does not succeed", async () => {
    saveVoiceForUserMock.mockResolvedValueOnce(null);
    const req = {
      method: "POST",
      body: {
        voiceName: "Generated Narrator",
        voiceDescription: "Measured, warm narration with a gentle documentary tone.",
        generatedVoiceId: "preview-1",
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
      details: "We couldn't securely save this voice. Please try again.",
    });
  });
});
