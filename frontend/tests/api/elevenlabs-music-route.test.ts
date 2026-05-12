import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/music";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsMusicMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingMock = vi.fn();

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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

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
    expect(res.json).toHaveBeenCalledWith({
      output: expect.objectContaining({
        modelId: "music_v1",
        durationMs: null,
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
});
