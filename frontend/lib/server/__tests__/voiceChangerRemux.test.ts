import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const readPersistedGenerationOutputsMock = vi.fn();
const reconcileOwnedGenerationOutputSlotMock = vi.fn();

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));
vi.mock("../api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));
vi.mock("../api/generationOutputs", () => ({
  readPersistedGenerationOutputs: (...args: unknown[]) =>
    readPersistedGenerationOutputsMock(...args),
}));
vi.mock("../api/generationOutputConvergence", () => ({
  reconcileOwnedGenerationOutputSlot: (...args: unknown[]) =>
    reconcileOwnedGenerationOutputSlotMock(...args),
}));

import {
  patchVoiceChangerRemuxMetadata,
  readAndRepairPublishedVoiceChangerGeneration,
  resolveExistingVoiceChangerRemuxGeneration,
  VOICE_CHANGER_REMUX_STALE_GENERATION_MS,
} from "../voiceChangerRemux";

const createQuery = (result: unknown) => {
  const settled = Promise.resolve(result);
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: settled.then.bind(settled),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

describe("Voice Changer projection convergence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    readPersistedGenerationOutputsMock.mockResolvedValue([]);
    reconcileOwnedGenerationOutputSlotMock.mockResolvedValue(undefined);
  });

  it("rebuilds a missing projection from canonical generation and publication records", async () => {
    const generationQuery = createQuery({
      data: {
        id: "video-1",
        provider: "elevenlabs",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "source.webm remux",
        request_id: "voice-changer-remux:audio-1",
        status: "success",
        completed_at: "2026-07-10T12:00:00.000Z",
        metadata: {
          mime_type: "video/webm",
          transcript_text: "hello",
          project_id: "project-1",
          generation_replay: { aspect: "9:16" },
          workflow_reload: { source: "voice-changer" },
        },
      },
      error: null,
    });
    const publicationQuery = createQuery({
      data: {
        owned_media_file_id: null,
        preview_storage_path: "user-1/generations/video/video-1/preview.webm",
        full_storage_path: "user-1/generations/video/video-1/video.webm",
        publication_state: "published",
        metadata: { autosave_enabled: false },
      },
      error: null,
    });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/video.webm" },
      error: null,
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "ai_generations") return generationQuery;
        if (table === "generation_publications") return publicationQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    };
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await readAndRepairPublishedVoiceChangerGeneration({
      userId: "user-1",
      generationId: "video-1",
    });

    expect(result).toMatchObject({
      generationId: "video-1",
      mimeType: "video/webm",
      fullStoragePath: "user-1/generations/video/video-1/video.webm",
      signedUrl: "https://signed.example/video.webm",
      saveState: "idle",
    });
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: admin,
        generationId: "video-1",
        userId: "user-1",
        taskState: "success",
        status: "success",
        publicationState: "published",
        fullStoragePath: "user-1/generations/video/video-1/video.webm",
        resultUrls: ["https://signed.example/video.webm"],
        generationReplay: { aspect: "9:16" },
      })
    );
  });

  it("rejects a publication path outside the owning user before signing", async () => {
    const generationQuery = createQuery({
      data: {
        id: "video-1",
        provider: "elevenlabs",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "source.mp4 remux",
        request_id: "voice-changer-remux:audio-1",
        status: "success",
        completed_at: "2026-07-10T12:00:00.000Z",
        metadata: { mime_type: "video/mp4" },
      },
      error: null,
    });
    const publicationQuery = createQuery({
      data: {
        owned_media_file_id: null,
        preview_storage_path: "other-user/generations/video/video-1/video.mp4",
        full_storage_path: "other-user/generations/video/video-1/video.mp4",
        publication_state: "published",
        metadata: { autosave_enabled: false },
      },
      error: null,
    });
    const createSignedUrl = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "ai_generations") return generationQuery;
        if (table === "generation_publications") return publicationQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    });

    await expect(
      readAndRepairPublishedVoiceChangerGeneration({
        userId: "user-1",
        generationId: "video-1",
      })
    ).rejects.toThrow("must start with 'user-1/'");
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
  });

  it("inspects an existing published derivative without repairing state", async () => {
    const existingQuery = createQuery({
      data: {
        id: "video-1",
        status: "running",
        created_at: "2026-07-10T12:00:00.000Z",
      },
      error: null,
    });
    const generationQuery = createQuery({
      data: {
        id: "video-1",
        provider: "elevenlabs",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "source.mp4 remux",
        request_id: "voice-changer-remux:audio-1",
        status: "running",
        completed_at: null,
        metadata: { mime_type: "video/mp4" },
      },
      error: null,
    });
    const publicationQuery = createQuery({
      data: {
        owned_media_file_id: null,
        preview_storage_path: "user-1/generations/video/video-1/video.mp4",
        full_storage_path: "user-1/generations/video/video-1/video.mp4",
        publication_state: "published",
        metadata: { autosave_enabled: false },
      },
      error: null,
    });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/video.mp4" },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(generationQuery)
        .mockReturnValueOnce(publicationQuery),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    });

    await expect(
      resolveExistingVoiceChangerRemuxGeneration({
        userId: "user-1",
        remuxRequestId: "voice-changer-remux:audio-1",
        allowMutations: false,
      })
    ).resolves.toMatchObject({ state: "published" });

    expect(generationQuery.update).not.toHaveBeenCalled();
    expect(reconcileOwnedGenerationOutputSlotMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
    expect(existingQuery.delete).not.toHaveBeenCalled();
  });

  it("upserts remux recovery even when durable publication repair is unavailable", async () => {
    const metadataQuery = createQuery({ data: { metadata: {} }, error: null });
    const updateQuery = createQuery({ error: null });
    const missingGenerationQuery = createQuery({ data: null, error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(metadataQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(missingGenerationQuery),
    });

    await patchVoiceChangerRemuxMetadata({
      userId: "user-1",
      audioGenerationId: "audio-1",
      patch: {
        remux_status: "failed",
        remux_request_id: "voice-changer-remux:audio-1",
        remux_failure_code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
        remux_failure_stage: "assembly",
      },
    });

    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "audio-1",
        userId: "user-1",
        remuxRecovery: {
          sourceAudioGenerationId: "audio-1",
          remuxRequestId: "voice-changer-remux:audio-1",
          status: "failed",
          code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
          stage: "assembly",
          retryable: true,
        },
      })
    );
  });

  it("reclaims a stale unpublished deterministic row with no owned media", async () => {
    const nowMs = Date.parse("2026-07-10T20:00:00.000Z");
    const existingQuery = createQuery({
      data: {
        id: "video-stale",
        status: "running",
        created_at: new Date(nowMs - VOICE_CHANGER_REMUX_STALE_GENERATION_MS - 1).toISOString(),
      },
      error: null,
    });
    const generationQuery = createQuery({
      data: {
        id: "video-stale",
        provider: "elevenlabs",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "source.mp4 remux",
        request_id: "voice-changer-remux:audio-1",
        status: "running",
        completed_at: null,
        metadata: {},
      },
      error: null,
    });
    const noPublicationQuery = createQuery({ data: null, error: null });
    const deleteQuery = createQuery({ data: { id: "video-stale" }, error: null });
    const list = vi.fn().mockResolvedValue({
      data: [{ name: "source.mp4" }],
      error: null,
    });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(generationQuery)
        .mockReturnValueOnce(noPublicationQuery)
        .mockReturnValueOnce(deleteQuery),
      storage: { from: vi.fn(() => ({ list, remove })) },
    });

    const result = await resolveExistingVoiceChangerRemuxGeneration({
      userId: "user-1",
      remuxRequestId: "voice-changer-remux:audio-1",
      nowMs,
    });

    expect(result).toEqual({ state: "reclaimed", generationId: "video-stale" });
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(["user-1/generations/video/video-stale/source.mp4"]);
  });

  it("leaves a fresh unpublished deterministic row in progress", async () => {
    const nowMs = Date.parse("2026-07-10T20:00:00.000Z");
    const existingQuery = createQuery({
      data: {
        id: "video-fresh",
        status: "running",
        created_at: new Date(nowMs - 1_000).toISOString(),
      },
      error: null,
    });
    const generationQuery = createQuery({
      data: {
        id: "video-fresh",
        provider: "elevenlabs",
        model_id: "eleven_multilingual_sts_v2",
        prompt_text: "source.mp4 remux",
        request_id: "voice-changer-remux:audio-1",
        status: "running",
        completed_at: null,
        metadata: {},
      },
      error: null,
    });
    const noPublicationQuery = createQuery({ data: null, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(generationQuery)
      .mockReturnValueOnce(noPublicationQuery);
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      resolveExistingVoiceChangerRemuxGeneration({
        userId: "user-1",
        remuxRequestId: "voice-changer-remux:audio-1",
        nowMs,
      })
    ).resolves.toEqual({ state: "in_progress", generationId: "video-fresh" });
    expect(from).toHaveBeenCalledTimes(3);
  });
});
