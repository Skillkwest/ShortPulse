import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/speech-to-speech";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const generateElevenLabsVoiceChangerMock = vi.fn();
const createRemuxedVoiceChangerVideoMock = vi.fn();
const persistGeneratedAudioAssetMock = vi.fn();
const persistGeneratedVideoAssetMock = vi.fn();
const probeMediaDurationSecondsMock = vi.fn();
const readRemoteSourceBufferMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();

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
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
}));

vi.mock("../../lib/server/api/trustedRemoteMediaUrl", () => ({
  assertTrustedRemoteMediaUrl: vi.fn(),
  TrustedRemoteMediaUrlError: MockTrustedRemoteMediaUrlError,
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  generateElevenLabsVoiceChanger: (...args: unknown[]) =>
    generateElevenLabsVoiceChangerMock(...args),
  createRemuxedVoiceChangerVideo: (...args: unknown[]) =>
    createRemuxedVoiceChangerVideoMock(...args),
  persistGeneratedAudioAsset: (...args: unknown[]) => persistGeneratedAudioAssetMock(...args),
  persistGeneratedVideoAsset: (...args: unknown[]) => persistGeneratedVideoAssetMock(...args),
  readRemoteSourceBuffer: (...args: unknown[]) => readRemoteSourceBufferMock(...args),
}));

vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  probeMediaDurationSeconds: (...args: unknown[]) => probeMediaDurationSecondsMock(...args),
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
  readRemoteMediaBuffer: vi.fn(),
  MAX_VOICE_CHANGER_SOURCE_BYTES: 40 * 1024 * 1024,
  MediaAudioExtractionInputError: MockMediaAudioExtractionInputError,
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/speech-to-speech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
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
      removeBackgroundNoise: "false",
      voiceSettings: JSON.stringify({
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
        use_speaker_boost: true,
      }),
    };
    readRemoteSourceBufferMock.mockReset();
    readStoredMediaBufferMock.mockReset();
    probeMediaDurationSecondsMock.mockReset();
    probeMediaDurationSecondsMock.mockResolvedValue(12);
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "eleven_multilingual_sts_v2",
      credits: 15,
      sourceRef: "billing-source-voice-1",
      billingMode: "direct_debit",
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
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "attached" }),
      refund: vi.fn().mockResolvedValue(undefined),
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
      signedUrl: "https://signed.example/generated-video.mp4",
      outputRowId: "output-video-1",
    });
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
        }),
      })
    );
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
        mimeType: "audio/mpeg",
        durationMs: 12000,
        waveformPeaks: null,
        modelId: "eleven_multilingual_sts_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
      },
      remuxedVideo: {
        provider: "elevenlabs",
        mode: "video",
        generationId: "gen-video-1",
        mediaFileId: "media-video-1",
        requestId: "req-video-1",
        previewUrl: "https://signed.example/generated-video.mp4",
        resultUrls: ["https://signed.example/generated-video.mp4"],
        previewStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
        fullStoragePath: "user-1/generations/video/gen-video-1/source.mp4",
        mimeType: "video/mp4",
        modelId: "eleven_multilingual_sts_v2",
      },
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
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
        mimeType: "audio/mpeg",
        durationMs: 12000,
        waveformPeaks: null,
        modelId: "eleven_multilingual_sts_v2",
        voiceId: "voice-1",
        voiceName: "Darian",
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
