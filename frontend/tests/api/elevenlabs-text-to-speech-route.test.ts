import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-speech";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listSavedVoicesForUserMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsVoiceoverMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingBestEffortMock = vi.fn();
const generateAudioReferenceTitleBestEffortMock = vi.fn();

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
  persistGeneratedAudioAsset: async (...args: unknown[]) => {
    const result = await persistGeneratedAudioAssetMock(...args);
    const input = args[0] as {
      beforeVisibleSettlement?: (context: {
        generationId: string;
        requestId: string;
        providerRequestId: string | null;
        outputRowId: string | null;
        mediaFileId: string | null;
        mediaKind: "audio";
        sourceMode: string;
      }) => Promise<void>;
      providerRequestId?: string | null;
      sourceMode: string;
    };
    await input.beforeVisibleSettlement?.({
      generationId: result.generationId,
      requestId: result.requestId,
      providerRequestId: input.providerRequestId ?? null,
      outputRowId: result.outputRowId ?? null,
      mediaFileId: result.mediaFileId ?? null,
      mediaKind: "audio",
      sourceMode: input.sourceMode,
    });
    return result;
  },
}));

vi.mock("../../lib/server/audioCompanionArt/routePending", () => ({
  markAudioCompanionArtPendingBestEffort: (...args: unknown[]) =>
    markAudioCompanionArtPendingBestEffortMock(...args),
}));

vi.mock("../../lib/server/audioTitleGeneration", () => ({
  generateAudioReferenceTitleBestEffort: (...args: unknown[]) =>
    generateAudioReferenceTitleBestEffortMock(...args),
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
      modelId: "eleven_v3",
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
    markAudioCompanionArtPendingBestEffortMock.mockResolvedValue(undefined);
    generateAudioReferenceTitleBestEffortMock.mockResolvedValue(
      "Voiceover Billing Path Verificati 2Y56RG"
    );
  });

  it("rejects invalid payloads", async () => {
    const req = { method: "POST", body: { voiceId: "voice-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
  });

  it("logs auth verifier failures before voice lookup, billing, provider, or persistence work", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));

    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover auth failure verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_v3",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "elevenlabs-text-to-speech.auth",
        scope: "generation",
      })
    );
    expect(listSavedVoicesForUserMock).not.toHaveBeenCalled();
    expect(listElevenLabsVoicesMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate speech",
      details: "auth verifier exploded",
    });
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
          model_id: "eleven_v3",
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
          mode: "audio",
          selected_tool: "voiceover",
          displayed_billed_credits: 15,
          pricing_display_source: "pricing_grid",
        },
        config: {
          model_id: "eleven_v3",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "eleven_v3",
        payload: expect.objectContaining({
          text_characters: "Voiceover billing path verification script.".length,
        }),
        shortpulseContext: {
          mode: "audio",
          selected_tool: "voiceover",
          displayed_billed_credits: 15,
          pricing_display_source: "pricing_grid",
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
            mode: "audio",
            selected_tool: "voiceover",
            displayed_billed_credits: 15,
            pricing_display_source: "pricing_grid",
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
        title: "Voiceover Billing Path Verificati 2Y56RG",
        modelId: "eleven_v3",
        voiceId: "voice-1",
        voiceName: "Darian",
        saveState: undefined,
        saveError: undefined,
      },
    });
  });

  it("passes through provider concurrency responses with retry guidance", async () => {
    const charge = {
      userId: "user-1",
      modelId: "eleven_v3",
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
    };
    chargeGenerationRequestMock.mockResolvedValueOnce(charge);
    generateElevenLabsVoiceoverMock.mockRejectedValueOnce(
      Object.assign(new Error("too_many_concurrent_requests"), {
        status: 429,
        retryAfterSeconds: 12,
        code: "concurrent_limit_exceeded",
      })
    );

    const req = {
      method: "POST",
      body: {
        voiceId: "voice-1",
        voiceName: "Darian",
        text: "Voiceover billing path verification script.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_v3",
        },
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(charge.refund).toHaveBeenCalledWith("Auto-refund: audio voiceover generation failed.", {
      source_mode: "voiceover",
    });
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "12");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate speech",
      details:
        "The audio provider is at its concurrency limit right now. Please retry in 12 seconds.",
      code: "concurrent_limit_exceeded",
      retryAfterSeconds: 12,
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
          model_id: "eleven_v3",
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
          model_id: "eleven_v3",
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
          model_id: "eleven_v3",
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
