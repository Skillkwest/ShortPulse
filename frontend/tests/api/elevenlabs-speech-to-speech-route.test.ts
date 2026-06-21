import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/speech-to-speech";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const assertTrustedRemoteMediaUrlMock = vi.fn();
const listSavedVoicesForUserMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateElevenLabsVoiceChangerMock = vi.fn();
const createRemuxedVoiceChangerVideoMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const persistGeneratedVideoAssetMock = vi.fn();
const probeMediaDurationSecondsMock = vi.fn();
const readRemoteSourceBufferMock = vi.fn();
const readRemoteMediaBufferMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();
const markAudioCompanionArtPendingBestEffortMock = vi.fn();
const generateAudioCompanionArtNowBestEffortMock = vi.fn();
const transcribeAudioBufferMock = vi.fn();
const generateAudioReferenceTitleBestEffortMock = vi.fn();

let mockFields: Record<string, unknown> = {};
let mockFiles: Record<string, unknown> = {};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (
      err: unknown,
      fields: Record<string, unknown>,
      files: Record<string, unknown>
    ) => void
  ) => {
    callback(null, mockFields, mockFiles);
  },
}));

const { MockTrustedRemoteMediaUrlError, MockMediaAudioExtractionInputError } = vi.hoisted(() => {
  class TrustedRemoteMediaUrlError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  class MediaAudioExtractionInputError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    MockTrustedRemoteMediaUrlError: TrustedRemoteMediaUrlError,
    MockMediaAudioExtractionInputError: MediaAudioExtractionInputError,
  };
});

vi.mock("formidable", () => ({
  default: () => formidableFactoryMock(),
}));

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  listSavedVoicesForUser: (...args: unknown[]) => listSavedVoicesForUserMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
  captureSucceededGenerationByProviderRequest: (...args: unknown[]) =>
    captureSucceededGenerationByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/api/trustedRemoteMediaUrl", () => ({
  assertTrustedRemoteMediaUrl: (...args: unknown[]) => assertTrustedRemoteMediaUrlMock(...args),
  TrustedRemoteMediaUrlError: MockTrustedRemoteMediaUrlError,
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  listElevenLabsVoices: (...args: unknown[]) => listElevenLabsVoicesMock(...args),
  generateElevenLabsVoiceChanger: (...args: unknown[]) =>
    generateElevenLabsVoiceChangerMock(...args),
  createRemuxedVoiceChangerVideo: (...args: unknown[]) =>
    createRemuxedVoiceChangerVideoMock(...args),
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
  persistGeneratedVideoAsset: (...args: unknown[]) => persistGeneratedVideoAssetMock(...args),
  readRemoteSourceBuffer: (...args: unknown[]) => readRemoteSourceBufferMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  probeMediaDurationSeconds: (...args: unknown[]) => probeMediaDurationSecondsMock(...args),
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
  readRemoteMediaBuffer: (...args: unknown[]) => readRemoteMediaBufferMock(...args),
  MAX_VOICE_CHANGER_SOURCE_BYTES: 40 * 1024 * 1024,
  MediaAudioExtractionInputError: MockMediaAudioExtractionInputError,
}));

vi.mock("../../lib/server/audioCompanionArt/routePending", () => ({
  markAudioCompanionArtPendingBestEffort: (...args: unknown[]) =>
    markAudioCompanionArtPendingBestEffortMock(...args),
  generateAudioCompanionArtNowBestEffort: (...args: unknown[]) =>
    generateAudioCompanionArtNowBestEffortMock(...args),
}));

vi.mock("../../lib/server/audioTitleGeneration", () => ({
  generateAudioReferenceTitleBestEffort: (...args: unknown[]) =>
    generateAudioReferenceTitleBestEffortMock(...args),
}));

vi.mock("../../lib/server/openAiAudioTranscription", () => ({
  transcribeAudioBuffer: (...args: unknown[]) => transcribeAudioBufferMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/elevenlabs/speech-to-speech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    listSavedVoicesForUserMock.mockResolvedValue([]);
    assertTrustedRemoteMediaUrlMock.mockReset();
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
    mockFiles = {};
    mockFields = {
      voiceId: "voice-1",
      voiceName: "Darian",
      outputFormat: "mp3_44100_128",
      modelId: "eleven_multilingual_sts_v2",
      inputFormat: "mp3_44100_128",
      sourceStoragePath: "user-1/voice-changer/staged-audio/source.wav",
      sourceName: "source.wav",
      sourceOrigin: "local",
      shortpulseContext: JSON.stringify({
        mode: "audio",
        selected_tool: "voice-changer",
        displayed_billed_credits: 15,
        pricing_display_source: "pricing_grid",
      }),
      removeBackgroundNoise: "false",
      voiceSettings: JSON.stringify({
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
        use_speaker_boost: true,
      }),
    };
    readRemoteSourceBufferMock.mockReset();
    readRemoteMediaBufferMock.mockReset();
    readStoredMediaBufferMock.mockReset();
    probeMediaDurationSecondsMock.mockReset();
    markAudioCompanionArtPendingBestEffortMock.mockReset();
    generateAudioCompanionArtNowBestEffortMock.mockReset();
    transcribeAudioBufferMock.mockReset();
    generateAudioReferenceTitleBestEffortMock.mockReset();
    probeMediaDurationSecondsMock.mockResolvedValue(12);
    markAudioCompanionArtPendingBestEffortMock.mockResolvedValue(undefined);
    generateAudioCompanionArtNowBestEffortMock.mockResolvedValue(null);
    transcribeAudioBufferMock.mockResolvedValue("I can hear the city waking up below us.");
    generateAudioReferenceTitleBestEffortMock.mockResolvedValue("I Can Hear The City I0OZ21");
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "eleven_multilingual_sts_v2",
      credits: 15,
      sourceRef: "billing-source-voice-1",
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
      pricingParams: { sourceDurationSeconds: 12 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-voice-1",
      note: "captured",
    });
    generateElevenLabsVoiceChangerMock.mockResolvedValue({
      buffer: Buffer.from("converted-audio"),
      contentType: "audio/mpeg",
      providerRequestId: "provider-voice-req-1",
    });
    createRemuxedVoiceChangerVideoMock.mockResolvedValue({
      buffer: Buffer.from("remuxed-video"),
      contentType: "video/mp4",
    });
    assertTrustedRemoteMediaUrlMock.mockImplementation(
      async ({ rawUrl }: { rawUrl: string }) => new URL(rawUrl)
    );
    readRemoteSourceBufferMock.mockResolvedValue({
      buffer: Buffer.from("remote-audio"),
      contentType: "audio/wav",
    });
    readRemoteMediaBufferMock.mockResolvedValue({
      buffer: Buffer.from("remote-video"),
      contentType: "video/mp4",
    });
    persistGeneratedAudioAssetMock.mockResolvedValue({
      generationId: "gen-audio-1",
      mediaFileId: "media-audio-1",
      requestId: "req-audio-1",
      storagePath: "user-1/generations/audio/gen-audio-1/source.mp3",
      signedUrl: "https://signed.example/generated-audio.mp3",
      outputRowId: "output-audio-1",
    });
    persistGeneratedVideoAssetMock.mockResolvedValue({
      generationId: "gen-video-1",
      mediaFileId: "media-video-1",
      requestId: "req-video-1",
      storagePath: "user-1/generations/video/gen-video-1/source.mp4",
      previewStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
      fullStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
      previewPosterStoragePath: null,
      previewPosterUrl: null,
      signedUrl: "https://signed.example/generated-video.mp4",
      outputRowId: "output-video-1",
    });
  });

  it("logs auth verifier failures before parsing, voice lookup, billing, provider, or persistence work", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));

    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "elevenlabs-speech-to-speech.auth",
        scope: "generation",
      })
    );
    expect(formidableFactoryMock).not.toHaveBeenCalled();
    expect(listSavedVoicesForUserMock).not.toHaveBeenCalled();
    expect(listElevenLabsVoicesMock).not.toHaveBeenCalled();
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to convert voice",
      details: "auth verifier exploded",
    });
  });

  it("fails closed before parsing, voice lookup, billing, or provider work when the ElevenLabs key is missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;

    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(formidableFactoryMock).not.toHaveBeenCalled();
    expect(listSavedVoicesForUserMock).not.toHaveBeenCalled();
    expect(listElevenLabsVoicesMock).not.toHaveBeenCalled();
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Service unavailable",
      details: "Audio generation is temporarily unavailable.",
    });
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds: 10,
        admissionScope: "per_user",
      });
      return null;
    });
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("staged-audio"),
      contentType: "audio/wav",
      size: 12,
    });

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
    expect(createRemuxedVoiceChangerVideoMock).not.toHaveBeenCalled();
    expect(persistGeneratedAudioAssetMock).not.toHaveBeenCalled();
    expect(persistGeneratedVideoAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 10,
      admissionScope: "per_user",
    });
  });

  it("rejects direct multipart media without a staged or trusted source", async () => {
    mockFields = {
      ...mockFields,
      sourceStoragePath: undefined,
      sourceUrl: undefined,
    };
    mockFiles = {
      source: {
        filepath: "/tmp/direct-source.wav",
        originalFilename: "direct-source.wav",
        mimetype: "audio/wav",
      },
    };

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "sourceStoragePath or sourceUrl is required.",
    });
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(readRemoteSourceBufferMock).not.toHaveBeenCalled();
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
  });

  it("returns both audio and remuxed video when an original staged video is supplied", async () => {
    mockFields = {
      ...mockFields,
      originalVideoStoragePath: "user-1/voice-changer/source-video/source.mp4",
      originalVideoName: "source.mp4",
      originalVideoMimeType: "video/mp4",
      originalVideoAspect: "9:16",
      project_id: "project-1",
    };
    readStoredMediaBufferMock
      .mockResolvedValueOnce({
        buffer: Buffer.from("staged-audio"),
        contentType: "audio/wav",
        size: 12,
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("source-video"),
        contentType: "video/mp4",
        size: 24,
      });

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readStoredMediaBufferMock).toHaveBeenNthCalledWith(1, {
      storagePath: "user-1/voice-changer/staged-audio/source.wav",
    });
    expect(readStoredMediaBufferMock).toHaveBeenNthCalledWith(2, {
      storagePath: "user-1/voice-changer/source-video/source.mp4",
      maxBytes: 40 * 1024 * 1024,
    });
    expect(generateElevenLabsVoiceChangerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceBuffer: Buffer.from("staged-audio"),
        sourceFilename: "source.wav",
      })
    );
    expect(transcribeAudioBufferMock).toHaveBeenCalledWith({
      audioBuffer: Buffer.from("staged-audio"),
      audioContentType: "audio/wav",
      filename: "source.wav",
    });
    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shortpulseContext: {
          mode: "audio",
          selected_tool: "voice-changer",
          displayed_billed_credits: 15,
          pricing_display_source: "pricing_grid",
        },
      })
    );
    expect(createRemuxedVoiceChangerVideoMock).toHaveBeenCalledWith({
      sourceVideoBuffer: Buffer.from("source-video"),
      sourceVideoFilename: "source.mp4",
      sourceVideoMimeType: "video/mp4",
      convertedAudioBuffer: Buffer.from("converted-audio"),
      convertedAudioContentType: "audio/mpeg",
    });
    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        sourceMode: "voice-changer",
        transcriptText: "I can hear the city waking up below us.",
        extraMetadata: expect.objectContaining({
          shortpulse_context: {
            mode: "audio",
            selected_tool: "voice-changer",
            displayed_billed_credits: 15,
            pricing_display_source: "pricing_grid",
          },
        }),
      })
    );
    expect(persistGeneratedVideoAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        provider: "elevenlabs",
        modelId: "eleven_multilingual_sts_v2",
        projectId: "project-1",
        outputBuffer: Buffer.from("remuxed-video"),
        outputContentType: "video/mp4",
        generationReplay: {
          aspect: "9:16",
        },
        extraMetadata: expect.objectContaining({
          billing_source_ref: "billing-source-voice-1",
          debited_credits: 15,
          derivative_kind: "voice_changer_remuxed_video",
          provider_request_id: "provider-voice-req-1",
          source_audio_generation_id: "gen-audio-1",
          source_duration_ms: 12000,
          source_duration_seconds: 12,
          source_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
          shortpulse_context: {
            mode: "audio",
            selected_tool: "voice-changer",
            displayed_billed_credits: 15,
            pricing_display_source: "pricing_grid",
          },
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-voice-req-1",
      reason: "Audio voice changer generation completed.",
      routeLabel: "elevenlabs-speech-to-speech",
      detail: {
        generation_id: "gen-audio-1",
        source_ref: "billing-source-voice-1",
        source_mode: "voice-changer",
        source_duration_seconds: 12,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: "gen-audio-1",
        mediaFileId: "media-audio-1",
        requestId: "req-audio-1",
        previewUrl: "https://signed.example/generated-audio.mp3",
        resultUrls: ["https://signed.example/generated-audio.mp3"],
        previewStoragePath: "user-1/generations/audio/gen-audio-1/source.mp3",
        fullStoragePath: "user-1/generations/audio/gen-audio-1/source.mp3",
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: "audio/mpeg",
        durationMs: 12000,
        waveformPeaks: null,
        title: "I Can Hear The City I0OZ21",
        modelId: "eleven_multilingual_sts_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
        transcriptText: "I can hear the city waking up below us.",
        saveState: undefined,
        saveError: undefined,
      },
      remuxedVideo: {
        provider: "elevenlabs",
        mode: "video",
        generationId: "gen-video-1",
        mediaFileId: "media-video-1",
        requestId: "req-video-1",
        previewUrl: "https://signed.example/generated-video.mp4",
        previewPosterUrl: null,
        resultUrls: ["https://signed.example/generated-video.mp4"],
        previewPosterStoragePath: null,
        previewStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
        fullStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
        mimeType: "video/mp4",
        modelId: "eleven_multilingual_sts_v2",
        transcriptText: "I can hear the city waking up below us.",
        saveState: undefined,
        saveError: undefined,
      },
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("requires user-scoped trusted media urls for remote source and remux video inputs", async () => {
    mockFields = {
      ...mockFields,
      sourceStoragePath: undefined,
      sourceUrl: "https://cdn.shortpulse.test/user-1/staged-audio/source.wav",
      sourceOrigin: "local",
      originalVideoStoragePath: undefined,
      originalVideoSourceUrl: "https://cdn.shortpulse.test/user-1/source-video/source.mp4",
      originalVideoName: "source.mp4",
      originalVideoMimeType: "video/mp4",
      originalVideoAspect: "9:16",
    };

    const req = { method: "POST", headers: { host: "www.shortpulse.ai" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(assertTrustedRemoteMediaUrlMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        rawUrl: "https://cdn.shortpulse.test/user-1/staged-audio/source.wav",
        req,
        userId: "user-1",
        requireUserScope: true,
        label: "Voice changer source URL",
      })
    );
    expect(assertTrustedRemoteMediaUrlMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        rawUrl: "https://cdn.shortpulse.test/user-1/source-video/source.mp4",
        req,
        userId: "user-1",
        requireUserScope: true,
        label: "Voice changer source video URL",
      })
    );
    expect(readRemoteSourceBufferMock).toHaveBeenCalledWith({
      sourceUrl: "https://cdn.shortpulse.test/user-1/staged-audio/source.wav",
    });
    expect(readRemoteMediaBufferMock).toHaveBeenCalledWith({
      sourceUrl: "https://cdn.shortpulse.test/user-1/source-video/source.mp4",
      maxBytes: 40 * 1024 * 1024,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("passes through provider rate-limit responses with retry guidance", async () => {
    readStoredMediaBufferMock.mockResolvedValue({
      buffer: Buffer.from("staged-audio"),
      contentType: "audio/wav",
      size: 12,
    });
    const charge = {
      userId: "user-1",
      modelId: "eleven_multilingual_sts_v2",
      credits: 15,
      sourceRef: "billing-source-voice-1",
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
      pricingParams: { sourceDurationSeconds: 12 },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    };
    chargeGenerationRequestMock.mockResolvedValueOnce(charge);
    generateElevenLabsVoiceChangerMock.mockRejectedValueOnce(
      Object.assign(new Error("rate_limit_exceeded"), {
        status: 429,
        retryAfterSeconds: 7,
        code: "rate_limit_exceeded",
      })
    );

    const req = {
      method: "POST",
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: audio voice changer generation failed.",
      {
        source_mode: "voice-changer",
      }
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "7");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to convert voice",
      details: "The audio provider is rate limiting requests right now. Please retry in 7 seconds.",
      code: "rate_limit_exceeded",
      retryAfterSeconds: 7,
    });
  });

  it("rejects unsupported model ids before billing", async () => {
    mockFields = {
      ...mockFields,
      modelId: "unsupported-model",
    };
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("staged-audio"),
      contentType: "audio/wav",
      size: 12,
    });

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "modelId is not supported for this audio workflow.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
  });

  it("rejects foreign custom voices before billing or provider submission", async () => {
    mockFields = {
      ...mockFields,
      voiceId: "foreign-generated-1",
      voiceName: "Foreign Voice",
    };
    listElevenLabsVoicesMock.mockResolvedValueOnce([
      {
        voiceId: "foreign-generated-1",
        name: "Foreign Voice",
        previewUrl: null,
        description: "Belongs to another user",
        isFallback: false,
        providerCategory: "generated",
        providerVoiceType: null,
      },
    ]);
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("staged-audio"),
      contentType: "audio/wav",
      size: 12,
    });

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice is unavailable",
      details: "The selected voice is not available for this account.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
  });

  it("rejects unowned provider voices with missing ownership metadata before billing", async () => {
    mockFields = {
      ...mockFields,
      voiceId: "unknown-provider-1",
      voiceName: "Unknown Provider Voice",
    };
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
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from("staged-audio"),
      contentType: "audio/wav",
      size: 12,
    });

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice is unavailable",
      details: "The selected voice is not available for this account.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
  });

  it("returns the remux source size error as a client-visible 413", async () => {
    mockFields = {
      ...mockFields,
      originalVideoStoragePath: "user-1/voice-changer/source-video/source.mp4",
    };
    readStoredMediaBufferMock
      .mockResolvedValueOnce({
        buffer: Buffer.from("staged-audio"),
        contentType: "audio/wav",
        size: 12,
      })
      .mockRejectedValueOnce(
        new MockMediaAudioExtractionInputError(
          "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again.",
          413
        )
      );

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again.",
    });
    expect(generateElevenLabsVoiceChangerMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("still returns the converted audio when remuxing the sibling video fails", async () => {
    mockFields = {
      ...mockFields,
      originalVideoStoragePath: "user-1/voice-changer/source-video/source.mp4",
      originalVideoName: "source.mp4",
      originalVideoMimeType: "video/mp4",
      originalVideoAspect: "9:16",
    };
    readStoredMediaBufferMock
      .mockResolvedValueOnce({
        buffer: Buffer.from("staged-audio"),
        contentType: "audio/wav",
        size: 12,
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("source-video"),
        contentType: "video/mp4",
        size: 24,
      });
    createRemuxedVoiceChangerVideoMock.mockRejectedValueOnce(
      new Error("Unable to combine the converted audio with the source video.")
    );

    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(persistGeneratedAudioAssetMock).toHaveBeenCalledTimes(1);
    expect(persistGeneratedVideoAssetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: "gen-audio-1",
        mediaFileId: "media-audio-1",
        requestId: "req-audio-1",
        previewUrl: "https://signed.example/generated-audio.mp3",
        resultUrls: ["https://signed.example/generated-audio.mp3"],
        previewStoragePath: "user-1/generations/audio/gen-audio-1/source.mp3",
        fullStoragePath: "user-1/generations/audio/gen-audio-1/source.mp3",
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: "audio/mpeg",
        durationMs: 12000,
        waveformPeaks: null,
        title: "I Can Hear The City I0OZ21",
        modelId: "eleven_multilingual_sts_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
        transcriptText: "I can hear the city waking up below us.",
        saveState: undefined,
        saveError: undefined,
      },
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "elevenlabs-speech-to-speech-remux",
        scope: "generation",
        user: expect.objectContaining({ id: "user-1" }),
      })
    );
  });
});
