import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/sound-effects";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsSoundEffectMock = vi.fn();
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
  generateElevenLabsSoundEffect: (...args: unknown[]) => generateElevenLabsSoundEffectMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
}));

vi.mock("../../lib/server/audioCompanionArt/processing", () => ({
  markAudioCompanionArtPending: (...args: unknown[]) => markAudioCompanionArtPendingMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

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
      details: "modelId must be eleven_text_to_sound_v2.",
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
          displayed_billed_credits: 15,
          pricing_display_source: "shared_adapter",
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
          displayed_billed_credits: 15,
          pricing_display_source: "shared_adapter",
        },
      })
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "billing-source-sfx-1",
        providerRequestId: "provider-sfx-1",
        projectId: "project-1",
        extraMetadata: expect.objectContaining({
          debited_credits: 15,
          loop_enabled: true,
          provider_character_cost: 100,
          provider_request_id: "provider-sfx-1",
          shortpulse_context: {
            displayed_billed_credits: 15,
            pricing_display_source: "shared_adapter",
          },
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-sfx-1",
      reason: "ElevenLabs sound effect generation completed.",
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
        durationMs: null,
        waveformPeaks: null,
        modelId: "eleven_text_to_sound_v2",
        characterCost: 100,
      },
    });
  });
});
