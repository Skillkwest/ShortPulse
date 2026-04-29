import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-speech";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsVoiceoverMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();

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
  generateElevenLabsVoiceover: (...args: unknown[]) => generateElevenLabsVoiceoverMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/text-to-speech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
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
  });

  it("rejects invalid payloads", async () => {
    const req = { method: "POST", body: { voiceId: "voice-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(generateElevenLabsVoiceoverMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
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
      })
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "billing-source-tts-1",
        providerRequestId: "provider-tts-1",
        projectId: "project-1",
        extraMetadata: expect.objectContaining({
          debited_credits: 15,
          provider_request_id: "provider-tts-1",
          text_character_count: "Voiceover billing path verification script.".length,
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-tts-1",
      reason: "ElevenLabs voiceover generation completed.",
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
        mimeType: "audio/mpeg",
        durationMs: null,
        waveformPeaks: null,
        modelId: "eleven_multilingual_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
      },
    });
  });
});
