import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-speech";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listSavedVoicesForUserMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsVoiceoverMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  listSavedVoicesForUser: (...args: unknown[]) => listSavedVoicesForUserMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
  captureSucceededGenerationByProviderRequest: (...args: unknown[]) =>
    captureSucceededGenerationByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  listElevenLabsVoices: (...args: unknown[]) => listElevenLabsVoicesMock(...args),
  generateElevenLabsVoiceover: (...args: unknown[]) => generateElevenLabsVoiceoverMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
}));

vi.mock("../../lib/server/audioCompanionArt/processing", () => ({
  markAudioCompanionArtPending: (...args: unknown[]) => markAudioCompanionArtPendingMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/elevenlabs/text-to-speech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-1",
        name: "Darian",
        previewUrl: null,
        description: "Warm narrator",
        isFallback: false,
        providerCategory: "premade",
        providerVoiceType: "default",
      },
    ]);
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "eleven_multilingual_v2",
      credits: 15,
      sourceRef: "billing-source-tts-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 15 },
      pricingBreakdown: {
        billedCredits: 15,
        billedUsd: 0.15,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 11,
        usdRaw: 0.1,
      },
      pricingParams: { textCharacters: 1000 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-tts-1",
      note: "captured",
    });
    markAudioCompanionArtPendingMock.mockResolvedValue(undefined);
  });

  it("rejects invalid payloads", async () => {
    const req = { method: "POST", body: { voiceId: "voice-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds: 9,
        admissionScope: "per_user",
      });
      return null;
    });

    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 9,
      admissionScope: "per_user",
    });
  });

  it("rejects unsupported model ids before billing", async () => {
    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "unsupported-model",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "config.model_id is not supported for this audio workflow.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
  });

  it("charges, generates, and persists the voiceover output", async () => {
    generateElevenLabsVoiceoverMock.mockResolvedValue({
      buffer: Buffer.from("voice"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-tts-1",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-tts-1",
      mediaFileId: "media-tts-1",
      requestId: "billing-source-tts-1",
      storagePath: "user-1/generations/audio/gen-tts-1/voice.mp3",
      signedUrl: "https://signed.example/voice.mp3",
      outputRowId: "out-tts-1",
    });

    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        project_id: "project-1",
        shortpulse_context: {
          displayed_billed_credits: 15,
          pricing_display_source: "shared_adapter",
        },
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "eleven_multilingual_v2",
        payload: expect.objectContaining({
          text_characters: "Voiceover billing path verification script.".length,
        }),
        shortpulseContext: {
          displayed_billed_credits: 15,
          pricing_display_source: "shared_adapter",
        },
      })
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "billing-source-tts-1",
        providerRequestId: "provider-tts-1",
        projectId: "project-1",
        voiceName: "Darian",
        extraMetadata: expect.objectContaining({
          debited_credits: 15,
          provider_request_id: "provider-tts-1",
          text_character_count: "Voiceover billing path verification script.".length,
          shortpulse_context: {
            displayed_billed_credits: 15,
            pricing_display_source: "shared_adapter",
          },
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-tts-1",
      reason: "Audio voiceover generation completed.",
      routeLabel: "elevenlabs-text-to-speech",
      detail: {
        generation_id: "gen-tts-1",
        source_ref: "billing-source-tts-1",
        source_mode: "voiceover",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: "gen-tts-1",
        mediaFileId: "media-tts-1",
        requestId: "billing-source-tts-1",
        previewUrl: "https://signed.example/voice.mp3",
        resultUrls: ["https://signed.example/voice.mp3"],
        previewStoragePath: "user-1/generations/audio/gen-tts-1/voice.mp3",
        fullStoragePath: "user-1/generations/audio/gen-tts-1/voice.mp3",
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: "audio/mpeg",
        durationMs: null,
        waveformPeaks: null,
        modelId: "eleven_multilingual_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
      },
    });
  });

  it("rate limits repeated text-to-speech generations for the same authenticated user", async () => {
    generateElevenLabsVoiceoverMock.mockResolvedValue({
      buffer: Buffer.from("voice"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-tts-1",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-tts-1",
      mediaFileId: "media-tts-1",
      requestId: "billing-source-tts-1",
      storagePath: "user-1/generations/audio/gen-tts-1/voice.mp3",
      signedUrl: "https://signed.example/voice.mp3",
      outputRowId: "out-tts-1",
    });

    const buildReq = () => ({
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
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

  it("surfaces plain-object backend messages instead of Unknown error", async () => {
    generateElevenLabsVoiceoverMock.mockResolvedValue({
      buffer: Buffer.from("voice"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-tts-1",
    });
    persistGeneratedAudioAssetMock.mockRejectedValue({
      code: "PGRST204",
      message: "save_error missing from schema cache",
    });

    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate speech",
      details: "save_error missing from schema cache",
    });
  });

  it("rejects foreign provider-created custom voices before billing", async () => {
    listElevenLabsVoicesMock.mockResolvedValueOnce([
      {
        voiceId: "foreign-generated-1",
        name: "Foreign Generated",
        previewUrl: null,
        description: "Should stay private",
        isFallback: false,
        providerCategory: "generated",
        providerVoiceType: "personal",
      },
    ]);

    const req = {
      method: "POST",
      body: {
        voiceId: "foreign-generated-1",
        voiceName: "Foreign Generated",
        text: "Nope.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice is unavailable",
      details: "The selected voice is not available for this account.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
  });

  it("rejects unowned provider voices with missing ownership metadata before billing", async () => {
    listElevenLabsVoicesMock.mockResolvedValueOnce([
      {
        voiceId: "unknown-provider-1",
        name: "Unknown Provider Voice",
        previewUrl: null,
        description: "Provider voice without reliable shared catalog metadata",
        isFallback: false,
        providerCategory: null,
        providerVoiceType: null,
      },
    ]);

    const req = {
      method: "POST",
      body: {
        voiceId: "unknown-provider-1",
        voiceName: "Unknown Provider Voice",
        text: "Nope.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_multilingual_v2",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice is unavailable",
      details: "The selected voice is not available for this account.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
  });
});
