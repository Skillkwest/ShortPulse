import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/music";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsMusicMock = vi.fn();
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
  generateElevenLabsMusic: (...args: unknown[]) => generateElevenLabsMusicMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/music", () => {
  const originalEnv = process.env.ELEVENLABS_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "music_v1",
      credits: 35,
      sourceRef: "billing-source-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 35 },
      pricingBreakdown: {
        billedCredits: 35,
        billedUsd: 0.35,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 31,
        usdRaw: 0.315,
      },
      pricingParams: { durationSeconds: 42 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-1",
      note: "captured",
    });
  });

  afterAll(() => {
    process.env.ELEVENLABS_API_KEY = originalEnv;
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 400 for invalid payloads", async () => {
    const req = {
      method: "POST",
      body: {
        text: "Test cue",
        durationSeconds: 42,
        bpm: 124,
        mode: "vocal",
        structure: "loop",
        energyPercent: 150,
        outputFormat: "mp3_44100_128",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "energyPercent must be between 0 and 100.",
    });
    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported output formats", async () => {
    const req = {
      method: "POST",
      body: {
        text: "Test cue",
        durationSeconds: 42,
        bpm: 124,
        mode: "vocal",
        structure: "loop",
        energyPercent: 50,
        outputFormat: "stems_zip",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "outputFormat must be one of: mp3_44100_128, wav_48000.",
    });
    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported model ids", async () => {
    const req = {
      method: "POST",
      body: {
        text: "Test cue",
        durationSeconds: 42,
        bpm: 124,
        mode: "vocal",
        structure: "loop",
        energyPercent: 50,
        outputFormat: "mp3_44100_128",
        modelId: "music_v2",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "modelId must be music_v1.",
    });
    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
  });

  it("submits the normalized provider request and persists the output", async () => {
    generateElevenLabsMusicMock.mockResolvedValue({
      buffer: Buffer.from("music"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-req-1",
      songId: "song-123",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-1",
      mediaFileId: "media-1",
      requestId: "req-1",
      storagePath: "user-1/generations/audio/gen-1/track.mp3",
      signedUrl: "https://signed.example/track.mp3",
      outputRowId: "out-1",
    });

    const req = {
      method: "POST",
      body: {
        text: "Warm melodic house cue with a soft vocal texture.",
        durationSeconds: 42,
        bpm: 124,
        mode: "vocal",
        structure: "full-track",
        energyPercent: 81,
        outputFormat: "mp3_44100_128",
        modelId: "music_v1",
        project_id: "project-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsMusicMock).toHaveBeenCalledWith({
      prompt: expect.stringContaining("Warm melodic house cue with a soft vocal texture."),
      outputFormat: "mp3_44100_128",
      body: {
        model_id: "music_v1",
        music_length_ms: 42000,
        force_instrumental: false,
      },
    });
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        promptText: "Warm melodic house cue with a soft vocal texture.",
        provider: "elevenlabs",
        modelId: "music_v1",
        requestId: "billing-source-1",
        providerRequestId: "provider-req-1",
        projectId: "project-1",
        sourceMode: "music",
        outputFormat: "mp3_44100_128",
        extraMetadata: expect.objectContaining({
          billing_source_ref: "billing-source-1",
          debited_credits: 35,
          duration_seconds: 42,
          tempo_bpm: 124,
          structure: "full-track",
          energy_percent: 81,
          music_mode: "vocal",
          provider_request_id: "provider-req-1",
          provider_song_id: "song-123",
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-req-1",
      reason: "ElevenLabs music generation completed.",
      routeLabel: "elevenlabs-music",
      detail: {
        generation_id: "gen-1",
        source_ref: "billing-source-1",
        source_mode: "music",
        song_id: "song-123",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: "gen-1",
        mediaFileId: "media-1",
        requestId: "req-1",
        previewUrl: "https://signed.example/track.mp3",
        resultUrls: ["https://signed.example/track.mp3"],
        previewStoragePath: "user-1/generations/audio/gen-1/track.mp3",
        fullStoragePath: "user-1/generations/audio/gen-1/track.mp3",
        mimeType: "audio/mpeg",
        durationMs: 42000,
        waveformPeaks: null,
        modelId: "music_v1",
      },
    });
  });
});
