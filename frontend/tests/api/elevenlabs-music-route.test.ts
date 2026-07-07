import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/music";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsMusicMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const markAudioCompanionArtPendingBestEffortMock = vi.fn();
const probeMediaDurationSecondsMock = vi.fn();
const resolveBillingConcurrencyEntitlementMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/billingConcurrencyEntitlements", () => ({
  resolveBillingConcurrencyEntitlement: (...args: unknown[]) =>
    resolveBillingConcurrencyEntitlementMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
  captureSucceededGenerationByProviderRequest: (...args: unknown[]) =>
    captureSucceededGenerationByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  generateElevenLabsMusic: (...args: unknown[]) => generateElevenLabsMusicMock(...args),
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
    resolveBillingConcurrencyEntitlementMock.mockResolvedValue({
      userId: "user-1",
      planId: "studio",
      source: "profile",
      maxConcurrentGenerations: 3,
    });
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
    markAudioCompanionArtPendingBestEffortMock.mockResolvedValue(undefined);
    probeMediaDurationSecondsMock.mockResolvedValue(null);
  });

  it("logs auth verifier failures before billing, provider, duration probing, or persistence work", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));

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

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "elevenlabs-music.auth",
        scope: "generation",
      })
    );
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
    expect(probeMediaDurationSecondsMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate music",
      details: "auth verifier exploded",
    });
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

  it("rejects Starter audio workflow submits before billing or provider dispatch", async () => {
    resolveBillingConcurrencyEntitlementMock.mockResolvedValueOnce({
      userId: "user-1",
      planId: "starter",
      source: "profile",
      maxConcurrentGenerations: 1,
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

    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsMusicMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "WORKFLOW_PLAN_REQUIRED",
        workflow: "audio",
        planId: "starter",
        ctaHref: "/profile?section=subscription",
        ctaLabel: "View plans",
      })
    );
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
        prompt: expect.stringContaining("- Keep the track fully instrumental."),
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
        musicMode: "instrumental",
      }),
    });
  });

  it("asks the provider to generate and sing lyrics for vocal music without authored lyrics", async () => {
    generateElevenLabsMusicMock.mockResolvedValue({
      buffer: Buffer.from("music"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-music-vocal-1",
      lyricsText: "The streetlights hum in harmony\nWe rise into the morning",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-music-vocal-1",
      mediaFileId: "media-music-vocal-1",
      requestId: "billing-source-music-1",
      storagePath: "user-1/generations/audio/gen-music-vocal-1/song.mp3",
      signedUrl: "https://signed.example/vocal-song.mp3",
      outputRowId: "out-music-vocal-1",
    });

    const req = {
      method: "POST",
      body: {
        text: "Warm indie pop cue with intimate verses and a bright chorus lift.",
        durationSeconds: null,
        bpm: 112,
        mode: "vocal",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        project_id: "project-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsMusicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          "- Generate and sing structured lyrics that match the style, tone, and duration of the prompt."
        ),
        body: expect.objectContaining({
          model_id: "music_v1",
          force_instrumental: false,
        }),
      })
    );
    expect(generateElevenLabsMusicMock.mock.calls[0]?.[0]?.prompt).not.toContain(
      "- Keep the track fully instrumental."
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extraMetadata: expect.objectContaining({
          lyrics_text: "The streetlights hum in harmony\nWe rise into the morning",
          music_mode: "vocal",
          provider_prompt: expect.stringContaining("Generate and sing structured lyrics"),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: expect.objectContaining({
        lyricsText: "The streetlights hum in harmony\nWe rise into the morning",
      }),
    });
  });

  it("uses authored lyrics as the sung lyrics for vocal music when provided", async () => {
    generateElevenLabsMusicMock.mockResolvedValue({
      buffer: Buffer.from("music"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-music-vocal-lyrics-1",
      lyricsText: "Provider returned an alternate line.",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-music-vocal-lyrics-1",
      mediaFileId: "media-music-vocal-lyrics-1",
      requestId: "billing-source-music-1",
      storagePath: "user-1/generations/audio/gen-music-vocal-lyrics-1/song.mp3",
      signedUrl: "https://signed.example/vocal-song-lyrics.mp3",
      outputRowId: "out-music-vocal-lyrics-1",
    });

    const req = {
      method: "POST",
      body: {
        text: "Melancholic synth-pop duet with a slow-burn chorus.\n\nLyrics:\nStay with me through the neon afterglow.",
        lyrics: "Stay with me through the neon afterglow.",
        durationSeconds: null,
        bpm: 112,
        mode: "vocal",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsMusicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("- Use the provided Lyrics section as the sung lyrics."),
        body: expect.objectContaining({
          force_instrumental: false,
        }),
      })
    );
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extraMetadata: expect.objectContaining({
          lyrics_text: "Stay with me through the neon afterglow.",
          music_mode: "vocal",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
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
          mode: "audio",
          selected_tool: "music",
          displayed_billed_credits: 20,
          pricing_display_source: "pricing_grid",
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
          mode: "audio",
          selected_tool: "music",
          displayed_billed_credits: 20,
          pricing_display_source: "pricing_grid",
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
            mode: "audio",
            selected_tool: "music",
            displayed_billed_credits: 20,
            pricing_display_source: "pricing_grid",
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
