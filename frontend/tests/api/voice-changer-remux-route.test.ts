/**
 * Route contract tests for no-charge Voice Changer video retry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/voice-changer-remux";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const enforceApiRateLimitMock = vi.fn();
const readStoredMediaBufferMock = vi.fn();
const executeVoiceChangerRemuxMock = vi.fn();
const patchVoiceChangerRemuxMetadataMock = vi.fn();
const readAndRepairPublishedVoiceChangerGenerationMock = vi.fn();
const resolveExistingVoiceChangerRemuxGenerationMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const recordVoiceSourceLifecycleStateMock = vi.fn();
const detectVideoMimeTypeMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));
vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));
vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));
vi.mock("../../lib/server/mediaAudioExtraction", () => ({
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
}));
vi.mock("../../lib/server/voiceChangerRemux", () => ({
  buildVoiceChangerRemuxRequestId: (id: string) => `voice-changer-remux:${id}`,
  executeVoiceChangerRemux: (...args: unknown[]) => executeVoiceChangerRemuxMock(...args),
  patchVoiceChangerRemuxMetadata: (...args: unknown[]) =>
    patchVoiceChangerRemuxMetadataMock(...args),
  readAndRepairPublishedVoiceChangerGeneration: (...args: unknown[]) =>
    readAndRepairPublishedVoiceChangerGenerationMock(...args),
  resolveExistingVoiceChangerRemuxGeneration: (...args: unknown[]) =>
    resolveExistingVoiceChangerRemuxGenerationMock(...args),
}));
vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));
vi.mock("../../lib/server/voiceSourceLifecycle", () => ({
  VOICE_CHANGER_SOURCE_RETENTION_DAYS: 14,
  recordVoiceSourceLifecycleState: (...args: unknown[]) =>
    recordVoiceSourceLifecycleStateMock(...args),
}));
vi.mock("../../lib/server/uploadSignature", () => ({
  detectVideoMimeType: (...args: unknown[]) => detectVideoMimeTypeMock(...args),
}));

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createQuery = (result: unknown) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

describe("POST /api/media/voice-changer-remux", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    enforceApiRateLimitMock.mockReturnValue(true);
    patchVoiceChangerRemuxMetadataMock.mockResolvedValue(undefined);
    readAndRepairPublishedVoiceChangerGenerationMock.mockResolvedValue(null);
    resolveExistingVoiceChangerRemuxGenerationMock.mockResolvedValue({ state: "none" });
    writeAppErrorLogMock.mockResolvedValue(undefined);
    recordVoiceSourceLifecycleStateMock.mockResolvedValue({ recorded: true });
    detectVideoMimeTypeMock.mockReturnValue("video/mp4");
  });

  it("stops before database or ffmpeg work when authenticated retry admission is exhausted", async () => {
    enforceApiRateLimitMock.mockReturnValue(false);
    const res = createResponse();

    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(enforceApiRateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      res,
      expect.objectContaining({
        keyPrefix: "media-voice-changer-remux:user-1",
        maxRequests: 3,
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(executeVoiceChangerRemuxMock).not.toHaveBeenCalled();
  });

  it("requires an owned source audio generation id before any database work", async () => {
    const res = createResponse();
    await handler({ method: "POST", body: {} } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(executeVoiceChangerRemuxMock).not.toHaveBeenCalled();
  });

  it("rejects retry metadata that points outside canonical source-video authority", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/generations/video/source.mp4",
        },
      },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ from: vi.fn().mockReturnValue(audioQuery) });

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "VOICE_CHANGER_ORIGINAL_VIDEO_AUTHORITY_INVALID" })
    );
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(executeVoiceChangerRemuxMock).not.toHaveBeenCalled();
  });

  it("reuses persisted audio and video without provider generation or billing", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "Source voice",
        request_id: "request-1",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
          original_video_name: "source.mp4",
          original_video_mime_type: "video/mp4",
          mime_type: "audio/mpeg",
        },
      },
      error: null,
    });
    const existingQuery = createQuery({ data: null, error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(audioQuery).mockReturnValueOnce(existingQuery),
    });
    readStoredMediaBufferMock
      .mockResolvedValueOnce({ buffer: Buffer.from("audio"), contentType: "audio/mpeg" })
      .mockResolvedValueOnce({ buffer: Buffer.from("video"), contentType: "video/mp4" });
    executeVoiceChangerRemuxMock.mockResolvedValue({
      remuxedVideo: { buffer: Buffer.from("output"), contentType: "video/mp4" },
      persistedVideo: {
        generationId: "video-1",
        mediaFileId: "media-1",
        requestId: "voice-changer-remux:audio-1",
        signedUrl: "https://signed.example/video.mp4",
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        previewStoragePath: "user-1/generations/video/video-1/video.mp4",
        fullStoragePath: "user-1/generations/video/video-1/video.mp4",
        saveState: "saved",
        saveError: null,
      },
    });

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(executeVoiceChangerRemuxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        audioGenerationId: "audio-1",
        convertedAudioBuffer: Buffer.from("audio"),
        sourceVideoBuffer: Buffer.from("video"),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", videoGenerationId: "video-1" })
    );
  });

  it("returns an existing published derivative without reading source buffers", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.webm",
        },
      },
      error: null,
    });
    const existingQuery = createQuery({ data: { id: "video-existing" }, error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(audioQuery).mockReturnValueOnce(existingQuery),
    });
    resolveExistingVoiceChangerRemuxGenerationMock.mockResolvedValue({
      state: "published",
      generation: {
        generationId: "video-existing",
        modelId: "eleven_multilingual_sts_v2",
        promptText: "source.webm remux",
        transcriptText: null,
        mimeType: "video/webm",
        previewStoragePath: "user-1/generations/video/video-existing/preview.webm",
        fullStoragePath: "user-1/generations/video/video-existing/video.webm",
        mediaFileId: null,
        signedUrl: "https://signed.example/video-existing.webm",
        saveState: "idle",
        saveError: null,
      },
    });

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        videoGenerationId: "video-existing",
        reused: true,
        video: expect.objectContaining({ mimeType: "video/webm" }),
      })
    );
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(executeVoiceChangerRemuxMock).not.toHaveBeenCalled();
  });

  it("returns retryable in-progress state without disturbing a fresh deterministic row", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
        },
      },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ from: vi.fn().mockReturnValue(audioQuery) });
    resolveExistingVoiceChangerRemuxGenerationMock.mockResolvedValueOnce({
      state: "in_progress",
      generationId: "video-running",
    });

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice Changer video assembly is already in progress.",
      code: "VOICE_CHANGER_REMUX_IN_PROGRESS",
      retryable: true,
    });
    expect(readStoredMediaBufferMock).not.toHaveBeenCalled();
    expect(executeVoiceChangerRemuxMock).not.toHaveBeenCalled();
    expect(patchVoiceChangerRemuxMetadataMock).not.toHaveBeenCalled();
  });

  it("returns the winning persisted video when concurrent retries race", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
          original_video_name: "source.mp4",
          original_video_mime_type: "video/mp4",
          mime_type: "audio/mpeg",
        },
      },
      error: null,
    });
    const noExistingQuery = createQuery({ data: null, error: null });
    const winningGenerationQuery = createQuery({ data: { id: "video-winner" }, error: null });
    const winningGeneration = {
      generationId: "video-winner",
      modelId: "eleven_multilingual_sts_v2",
      promptText: "Source video remux",
      transcriptText: null,
      mimeType: "video/mp4",
      previewStoragePath: "user-1/generations/video/video-winner/video.mp4",
      fullStoragePath: "user-1/generations/video/video-winner/video.mp4",
      mediaFileId: "media-winner",
      signedUrl: "https://signed.example/video-winner.mp4",
      saveState: "saved",
      saveError: null,
    };
    resolveExistingVoiceChangerRemuxGenerationMock
      .mockResolvedValueOnce({ state: "none" })
      .mockResolvedValueOnce({ state: "published", generation: winningGeneration });
    getSupabaseAdminMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(audioQuery)
        .mockReturnValueOnce(noExistingQuery)
        .mockReturnValueOnce(winningGenerationQuery),
    });
    readStoredMediaBufferMock
      .mockResolvedValueOnce({ buffer: Buffer.from("audio"), contentType: "audio/mpeg" })
      .mockResolvedValueOnce({ buffer: Buffer.from("video"), contentType: "video/mp4" });
    executeVoiceChangerRemuxMock.mockRejectedValue(
      new Error("duplicate key value violates unique constraint")
    );

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        videoGenerationId: "video-winner",
        reused: true,
      })
    );
    expect(patchVoiceChangerRemuxMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({
          remux_status: "succeeded",
          remuxed_video_generation_id: "video-winner",
        }),
      })
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(resolveExistingVoiceChangerRemuxGenerationMock).toHaveBeenLastCalledWith({
      userId: "user-1",
      remuxRequestId: "voice-changer-remux:audio-1",
    });
  });

  it("returns a newly persisted video when its terminal metadata patch fails", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
          original_video_name: "source.mp4",
          mime_type: "audio/mpeg",
        },
      },
      error: null,
    });
    const noExistingQuery = createQuery({ data: null, error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(audioQuery).mockReturnValueOnce(noExistingQuery),
    });
    readStoredMediaBufferMock
      .mockResolvedValueOnce({ buffer: Buffer.from("audio"), contentType: "audio/mpeg" })
      .mockResolvedValueOnce({ buffer: Buffer.from("video"), contentType: "video/mp4" });
    executeVoiceChangerRemuxMock.mockResolvedValue({
      remuxedVideo: { buffer: Buffer.from("output"), contentType: "video/mp4" },
      persistedVideo: {
        generationId: "video-1",
        mediaFileId: "media-1",
        requestId: "voice-changer-remux:audio-1",
        signedUrl: "https://signed.example/video.mp4",
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        previewStoragePath: "user-1/generations/video/video-1/video.mp4",
        fullStoragePath: "user-1/generations/video/video-1/video.mp4",
        saveState: "saved",
        saveError: null,
      },
    });
    patchVoiceChangerRemuxMetadataMock.mockRejectedValueOnce(new Error("metadata update failed"));

    const res = createResponse();
    await handler(
      { method: "POST", body: { sourceAudioGenerationId: "audio-1" } } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", videoGenerationId: "video-1" })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        metadata: expect.objectContaining({ remuxed_video_generation_id: "video-1" }),
      })
    );
    expect(recordVoiceSourceLifecycleStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workflowKind: "voice_changer",
        sourceKind: "video",
        storagePath: "user-1/voice-changer/source-video/source.mp4",
        state: "terminal_success",
        generationId: "video-1",
        retentionDays: 14,
      })
    );
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("logs recovery identifiers and remux stage when retry assembly fails", async () => {
    const audioQuery = createQuery({
      data: {
        id: "audio-1",
        model_id: "eleven_multilingual_sts_v2",
        request_id: "audio-request-1",
        metadata: {
          expects_remux: true,
          generated_audio_storage_path: "user-1/generations/audio/audio-1/voice.mp3",
          original_video_storage_path: "user-1/voice-changer/source-video/source.mp4",
          original_video_name: "source.mp4",
          mime_type: "audio/mpeg",
        },
      },
      error: null,
    });
    const noExistingQuery = createQuery({ data: null, error: null });
    const noConcurrentQuery = createQuery({ data: null, error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(audioQuery)
        .mockReturnValueOnce(noExistingQuery)
        .mockReturnValueOnce(noConcurrentQuery),
    });
    readStoredMediaBufferMock
      .mockResolvedValueOnce({ buffer: Buffer.from("audio"), contentType: "audio/mpeg" })
      .mockResolvedValueOnce({ buffer: Buffer.from("video"), contentType: "video/mp4" });
    executeVoiceChangerRemuxMock.mockRejectedValueOnce(
      Object.assign(new Error("ffmpeg failed"), {
        code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
        stage: "assembly",
      })
    );

    const req = { method: "POST", body: { sourceAudioGenerationId: "audio-1" } };
    const res = createResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "media-voice-changer-remux",
        metadata: {
          source_audio_generation_id: "audio-1",
          remux_request_id: "voice-changer-remux:audio-1",
          remux_failure_code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
          remux_failure_stage: "assembly",
        },
      })
    );
  });
});
