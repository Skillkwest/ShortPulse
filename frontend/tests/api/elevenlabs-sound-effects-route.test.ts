import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/sound-effects";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsSoundEffectMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingMock = vi.fn();
const probeMediaDurationSecondsMock = vi.fn();
const generateSoundEffectTitleBestEffortMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
  captureSucceededGenerationByProviderRequest: (...args: unknown[]) =>
    captureSucceededGenerationByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  generateElevenLabsSoundEffect: (...args: unknown[]) => generateElevenLabsSoundEffectMock(...args),
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

vi.mock("../../lib/server/audioCompanionArt/processing", () => ({
  markAudioCompanionArtPending: (...args: unknown[]) => markAudioCompanionArtPendingMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  probeMediaDurationSeconds: (...args: unknown[]) => probeMediaDurationSecondsMock(...args),
}));

vi.mock("../../lib/server/audioTitleGeneration", () => ({
  generateSoundEffectTitleBestEffort: (...args: unknown[]) =>
    generateSoundEffectTitleBestEffortMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/elevenlabs/sound-effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "eleven_text_to_sound_v2",
      credits: 15,
      sourceRef: "billing-source-sfx-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 15 },
      pricingBreakdown: {
        billedCredits: 15,
        billedUsd: 0.15,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 13,
        usdRaw: 0.12,
      },
      pricingParams: { generationCount: 1 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-sfx-1",
      note: "captured",
    });
    markAudioCompanionArtPendingMock.mockResolvedValue(undefined);
    probeMediaDurationSecondsMock.mockResolvedValue(2.4);
    generateSoundEffectTitleBestEffortMock.mockResolvedValue("Huge Downlift Boom");
  });

  it("rejects out-of-range explicit durations", async () => {
    const req = {
      method: "POST",
      body: {
        text: "Huge downlift boom.",
        durationSeconds: 60,
        outputFormat: "mp3_44100_128",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsSoundEffectMock).not.toHaveBeenCalled();
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(402).json({
        error:
          "You don't have enough ShortPulse credits for this run. Add credits or choose a lower-cost model before retrying.",
        code: "INSUFFICIENT_CREDITS",
        chargeState: "not_reserved",
      });
      return null;
    });

    const req = {
      method: "POST",
      body: {
        text: "Huge downlift boom.",
        durationSeconds: null,
        loop: false,
        outputFormat: "mp3_44100_128",
        modelId: "eleven_text_to_sound_v2",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsSoundEffectMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "You don't have enough ShortPulse credits for this run. Add credits or choose a lower-cost model before retrying.",
      code: "INSUFFICIENT_CREDITS",
      chargeState: "not_reserved",
    });
  });

  it("rejects unsupported model ids before billing", async () => {
    const req = {
      method: "POST",
      body: {
        text: "Huge downlift boom.",
        outputFormat: "mp3_44100_128",
        modelId: "unsupported-model",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "modelId is not supported for this audio workflow.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsSoundEffectMock).not.toHaveBeenCalled();
  });

  it("charges and persists auto-duration sound effects with shared pricing metadata", async () => {
    generateElevenLabsSoundEffectMock.mockResolvedValue({
      buffer: Buffer.from("sfx"),
      characterCost: 100,
      contentType: "audio/mpeg",
      providerRequestId: "provider-sfx-1",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-sfx-1",
      mediaFileId: "media-sfx-1",
      requestId: "billing-source-sfx-1",
      storagePath: "user-1/generations/audio/gen-sfx-1/effect.mp3",
      signedUrl: "https://signed.example/effect.mp3",
      outputRowId: "out-sfx-1",
    });

    const req = {
      method: "POST",
      body: {
        text: "Huge downlift boom.",
        durationSeconds: null,
        loop: true,
        outputFormat: "mp3_44100_128",
        modelId: "eleven_text_to_sound_v2",
        project_id: "project-1",
        shortpulse_context: {
          mode: "audio",
          selected_tool: "sound-effects",
          displayed_billed_credits: 15,
          pricing_display_source: "pricing_grid",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "eleven_text_to_sound_v2",
        payload: expect.objectContaining({
          generation_count: 1,
        }),
        shortpulseContext: {
          mode: "audio",
          selected_tool: "sound-effects",
          displayed_billed_credits: 15,
          pricing_display_source: "pricing_grid",
        },
      })
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "billing-source-sfx-1",
        providerRequestId: "provider-sfx-1",
        projectId: "project-1",
        displayTitle: "Huge Downlift Boom",
        extraMetadata: expect.objectContaining({
          debited_credits: 15,
          duration_ms: 2400,
          resolved_duration_seconds: 2.4,
          loop_enabled: true,
          provider_character_cost: 100,
          provider_request_id: "provider-sfx-1",
          sound_effect_title: "Huge Downlift Boom",
          shortpulse_context: {
            mode: "audio",
            selected_tool: "sound-effects",
            displayed_billed_credits: 15,
            pricing_display_source: "pricing_grid",
          },
        }),
      })
    );
    expect(generateSoundEffectTitleBestEffortMock).toHaveBeenCalledWith({
      promptText: "Huge downlift boom.",
      durationSeconds: null,
      loop: true,
    });
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-sfx-1",
      reason: "Audio sound effect generation completed.",
      routeLabel: "elevenlabs-sound-effects",
      detail: {
        generation_id: "gen-sfx-1",
        source_ref: "billing-source-sfx-1",
        source_mode: "sound-effects",
        provider_character_cost: 100,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: "gen-sfx-1",
        mediaFileId: "media-sfx-1",
        requestId: "billing-source-sfx-1",
        previewUrl: "https://signed.example/effect.mp3",
        resultUrls: ["https://signed.example/effect.mp3"],
        previewStoragePath: "user-1/generations/audio/gen-sfx-1/effect.mp3",
        fullStoragePath: "user-1/generations/audio/gen-sfx-1/effect.mp3",
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: "audio/mpeg",
        durationMs: 2400,
        waveformPeaks: null,
        title: "Huge Downlift Boom",
        modelId: "eleven_text_to_sound_v2",
        characterCost: 100,
      },
    });
  });

  it("passes through provider concurrency responses with retry guidance", async () => {
    const charge = {
      userId: "user-1",
      modelId: "eleven_text_to_sound_v2",
      credits: 15,
      sourceRef: "billing-source-sfx-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 15 },
      pricingBreakdown: {
        billedCredits: 15,
        billedUsd: 0.15,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 13,
        usdRaw: 0.12,
      },
      pricingParams: { generationCount: 1 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    };
    chargeGenerationRequestMock.mockResolvedValueOnce(charge);
    generateElevenLabsSoundEffectMock.mockRejectedValueOnce(
      Object.assign(new Error("too_many_concurrent_requests"), {
        status: 429,
        retryAfterSeconds: 12,
        code: "concurrent_limit_exceeded",
      })
    );

    const req = {
      method: "POST",
      body: {
        text: "Huge downlift boom.",
        durationSeconds: null,
        loop: false,
        outputFormat: "mp3_44100_128",
        modelId: "eleven_text_to_sound_v2",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: audio sound effect generation failed.",
      {
        source_mode: "sound-effects",
      }
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "12");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate sound effect",
      details:
        "The audio provider is at its concurrency limit right now. Please retry in 12 seconds.",
      code: "concurrent_limit_exceeded",
      retryAfterSeconds: 12,
    });
  });
});
