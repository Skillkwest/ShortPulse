import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/music";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsMusicMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingMock = vi.fn();
const probeMediaDurationSecondsMock = vi.fn();

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
  generateElevenLabsMusic: (...args: unknown[]) => generateElevenLabsMusicMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
}));

vi.mock("../../lib/server/audioCompanionArt/processing", () => ({
  markAudioCompanionArtPending: (...args: unknown[]) => markAudioCompanionArtPendingMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  probeMediaDurationSeconds: (...args: unknown[]) => probeMediaDurationSecondsMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/elevenlabs/music", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "music_v1",
      credits: 20,
      sourceRef: "billing-source-music-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 20 },
      pricingBreakdown: {
        billedCredits: 20,
        billedUsd: 0.2,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 18,
        usdRaw: 0.18,
      },
      pricingParams: { durationSeconds: 30 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-music-1",
      note: "captured",
    });
    markAudioCompanionArtPendingMock.mockResolvedValue(undefined);
    probeMediaDurationSecondsMock.mockResolvedValue(null);
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds: 6,
        admissionScope: "per_user",
      });
      return null;
    });

    const req = {
      method: "POST",
      body: {
        text: "Night-drive synth anthem",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 6,
      admissionScope: "per_user",
    });
  });

  it("falls back to the catalog-backed default music model id for auto duration", async () => {
    generateElevenLabsMusicMock.mockResolvedValue({
      buffer: Buffer.from("music"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-music-1",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-music-1",
      mediaFileId: "media-music-1",
      requestId: "billing-source-music-1",
      storagePath: "user-1/generations/audio/gen-music-1/song.mp3",
      signedUrl: "https://signed.example/song.mp3",
      outputRowId: "out-music-1",
    });
    probeMediaDurationSecondsMock.mockResolvedValue(182.345);

    const req = {
      method: "POST",
      body: {
        text: "Night-drive synth anthem",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        project_id: "project-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "music_v1",
        payload: {},
      })
    );
    expect(generateElevenLabsMusicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          model_id: "music_v1",
          force_instrumental: true,
        }),
      })
    );
    expect(generateElevenLabsMusicMock.mock.calls[0]?.[0]?.body).not.toHaveProperty(
      "music_length_ms"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(probeMediaDurationSecondsMock).toHaveBeenCalledWith({
      buffer: Buffer.from("music"),
      filename: null,
      mimeType: "audio/mpeg",
    });
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extraMetadata: expect.objectContaining({
          resolved_duration_seconds: 182.345,
          duration_ms: 182345,
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      output: expect.objectContaining({
        modelId: "music_v1",
        durationMs: 182345,
      }),
    });
  });

  it("passes through explicit duration when one is provided", async () => {
    generateElevenLabsMusicMock.mockResolvedValue({
      buffer: Buffer.from("music"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-music-2",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-music-2",
      mediaFileId: "media-music-2",
      requestId: "billing-source-music-1",
      storagePath: "user-1/generations/audio/gen-music-2/song.mp3",
      signedUrl: "https://signed.example/song-2.mp3",
      outputRowId: "out-music-2",
    });

    const req = {
      method: "POST",
      body: {
        text: "Night-drive synth anthem",
        durationSeconds: 30,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        shortpulse_context: {
          displayed_billed_credits: 20,
          pricing_display_source: "shared_adapter",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          duration_seconds: 30,
        },
        shortpulseContext: {
          displayed_billed_credits: 20,
          pricing_display_source: "shared_adapter",
        },
      })
    );
    expect(generateElevenLabsMusicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          music_length_ms: 30000,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extraMetadata: expect.objectContaining({
          shortpulse_context: {
            displayed_billed_credits: 20,
            pricing_display_source: "shared_adapter",
          },
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      output: expect.objectContaining({
        durationMs: 30000,
      }),
    });
  });

  it("passes through provider busy responses with retry guidance", async () => {
    const charge = {
      userId: "user-1",
      modelId: "music_v1",
      credits: 20,
      sourceRef: "billing-source-music-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 20 },
      pricingBreakdown: {
        billedCredits: 20,
        billedUsd: 0.2,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 18,
        usdRaw: 0.18,
      },
      pricingParams: { durationSeconds: 30 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    };
    chargeGenerationRequestMock.mockResolvedValueOnce(charge);
    generateElevenLabsMusicMock.mockRejectedValueOnce(
      Object.assign(new Error("system_busy"), {
        status: 429,
        retryAfterSeconds: 9,
        code: "system_busy",
      })
    );

    const req = {
      method: "POST",
      body: {
        text: "Night-drive synth anthem",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(charge.refund).toHaveBeenCalledWith("Auto-refund: audio music generation failed.", {
      source_mode: "music",
    });
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "9");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate music",
      details: "The audio provider is busy right now. Please retry in 9 seconds.",
      code: "system_busy",
      retryAfterSeconds: 9,
    });
  });
});
