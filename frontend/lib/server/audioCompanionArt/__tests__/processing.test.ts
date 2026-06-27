import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAudioCompanionArtForGeneration,
  markAudioCompanionArtPending,
  processPendingAudioCompanionArtBatch,
} from "../processing";

const getSupabaseAdminMock = vi.fn();
const buildFalFluxKleinAudioCompanionArtPayloadMock = vi.fn();
const generateFalFluxKleinImageMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const resolveRuntimeAgentPromptMock = vi.fn();
const cleanupAudioCompanionArtMock = vi.fn();
const mirrorGeneratedAudioPresentationToMediaFilesMock = vi.fn();
const sharpMock = vi.fn();
const sharpStatsMock = vi.fn();
const sharpRotateMock = vi.fn();
const sharpResizeMock = vi.fn();
const sharpWebpMock = vi.fn();
const sharpToBufferMock = vi.fn();

vi.mock("sharp", () => ({
  default: (...args: unknown[]) => sharpMock(...args),
}));

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../falStylePreviewGeneration", () => ({
  buildFalFluxKleinAudioCompanionArtPayload: (...args: unknown[]) =>
    buildFalFluxKleinAudioCompanionArtPayloadMock(...args),
  generateFalFluxKleinImage: (...args: unknown[]) => generateFalFluxKleinImageMock(...args),
}));

vi.mock("../../api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../api/runtimeAgentPromptControlPlane", () => ({
  resolveRuntimeAgentPrompt: (...args: unknown[]) => resolveRuntimeAgentPromptMock(...args),
}));

vi.mock("../../generatedAudioPresentation", () => ({
  mirrorGeneratedAudioPresentationToMediaFiles: (...args: unknown[]) =>
    mirrorGeneratedAudioPresentationToMediaFilesMock(...args),
}));

vi.mock("../cleanup", () => ({
  cleanupAudioCompanionArt: (...args: unknown[]) => cleanupAudioCompanionArtMock(...args),
}));

const createSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.like = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
};

describe("audioCompanionArt processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeAppErrorLogMock.mockResolvedValue({ ok: true });
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    mirrorGeneratedAudioPresentationToMediaFilesMock.mockResolvedValue({ updatedCount: 0 });
    resolveRuntimeAgentPromptMock.mockResolvedValue({
      promptId: "AUDIO_COMPANION_ART_STYLE_SYSTEM",
      promptBody: "Control-plane branded style line.",
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    });
    cleanupAudioCompanionArtMock.mockResolvedValue({
      clearedProjection: true,
      deletedStoragePath: null,
      storageDeleted: false,
    });
    sharpStatsMock.mockResolvedValue({
      channels: [
        { mean: 80, stdev: 28, min: 10, max: 180 },
        { mean: 110, stdev: 34, min: 12, max: 220 },
        { mean: 150, stdev: 41, min: 20, max: 245 },
      ],
    });
    buildFalFluxKleinAudioCompanionArtPayloadMock.mockImplementation((prompt: string) => ({
      prompt,
      image_size: { width: 512, height: 512 },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      enable_safety_checker: false,
    }));
    sharpToBufferMock.mockResolvedValue(Buffer.from("cover-webp"));
    sharpWebpMock.mockReturnValue({
      toBuffer: sharpToBufferMock,
    });
    sharpResizeMock.mockReturnValue({
      webp: sharpWebpMock,
    });
    sharpRotateMock.mockReturnValue({
      resize: sharpResizeMock,
    });
    sharpMock.mockReturnValue({
      stats: sharpStatsMock,
      rotate: sharpRotateMock,
    });
  });

  it("processes pending audio companion art rows to ready state", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.like = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [
        {
          generation_id: "gen-1",
          user_id: "user-1",
          companion_art_attempt_count: 0,
          publication_state: "published",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    }));

    const projectionEligibilityBuilder = createSelectBuilder({
      data: {
        publication_state: "published",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const claimMaybeSingle = vi.fn(async () => ({
      data: { generation_id: "gen-1" },
      error: null,
    }));
    const claimBuilder: Record<string, unknown> = {};
    claimBuilder.eq = vi.fn(() => claimBuilder);
    claimBuilder.lt = vi.fn(() => claimBuilder);
    claimBuilder.not = vi.fn(() => claimBuilder);
    claimBuilder.like = vi.fn(() => claimBuilder);
    claimBuilder.or = vi.fn(() => claimBuilder);
    claimBuilder.select = vi.fn(() => ({
      maybeSingle: claimMaybeSingle,
    }));
    const generationProjectionTable = {
      select: vi.fn((columns: string) =>
        columns.includes("companion_art_attempt_count")
          ? projectionSelectBuilder
          : projectionEligibilityBuilder
      ),
      update: vi.fn(() => claimBuilder),
    };

    const aiGenerationsTable = {
      select: vi.fn(() =>
        createSelectBuilder({
          data: {
            id: "gen-1",
            user_id: "user-1",
            prompt_text: "Moonlit radio confession",
            metadata: {
              source_mode: "voiceover",
              voice_name: "Alice",
            },
          },
          error: null,
        })
      ),
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") return generationProjectionTable;
        if (table === "ai_generations") return aiGenerationsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
        })),
      },
    });
    generateFalFluxKleinImageMock.mockResolvedValue({
      buffer: Buffer.from("cover"),
      contentType: "image/png",
    });

    const result = await processPendingAudioCompanionArtBatch({ limit: 5 });

    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(projectionSelectBuilder.or).toHaveBeenCalledWith(
      "companion_art_status.is.null,companion_art_status.eq.pending,companion_art_status.eq.failed"
    );
    expect(claimBuilder.or).toHaveBeenCalledWith(
      "companion_art_status.is.null,companion_art_status.eq.pending,companion_art_status.eq.failed"
    );
    expect(mirrorGeneratedAudioPresentationToMediaFilesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        companionArtStatus: "processing",
        companionArtStoragePath: null,
      })
    );
    expect(projectionSelectBuilder.not).toHaveBeenCalledWith(
      "publication_state",
      "eq",
      "suppressed"
    );
    expect(projectionSelectBuilder.like).toHaveBeenCalledWith(
      "preview_storage_path",
      "%/generations/audio/%"
    );
    expect(claimBuilder.like).toHaveBeenCalledWith("preview_storage_path", "%/generations/audio/%");
    expect(buildFalFluxKleinAudioCompanionArtPayloadMock).toHaveBeenCalledWith(
      expect.stringContaining("Control-plane branded style line.")
    );
    expect(generateFalFluxKleinImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          prompt: expect.stringContaining("Control-plane branded style line."),
          image_size: { width: 512, height: 512 },
          num_inference_steps: 4,
        }),
        pollIntervalMs: 500,
        initialPollDelayMs: 0,
      })
    );
    expect(sharpMock).toHaveBeenCalledWith(Buffer.from("cover"), { failOn: "error" });
    expect(sharpResizeMock).toHaveBeenCalledWith({
      width: 480,
      fit: "inside",
      withoutEnlargement: true,
    });
    expect(sharpWebpMock).toHaveBeenCalledWith({ quality: 68 });
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        companionArtStatus: "ready",
        companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      })
    );
  });

  it("marks companion art rows failed when source-mode metadata is unavailable", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.like = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [
        {
          generation_id: "gen-2",
          user_id: "user-2",
          companion_art_attempt_count: 1,
          publication_state: "published",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    }));

    const projectionEligibilityBuilder = createSelectBuilder({
      data: {
        publication_state: "published",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const claimBuilder: Record<string, unknown> = {};
    claimBuilder.eq = vi.fn(() => claimBuilder);
    claimBuilder.lt = vi.fn(() => claimBuilder);
    claimBuilder.not = vi.fn(() => claimBuilder);
    claimBuilder.like = vi.fn(() => claimBuilder);
    claimBuilder.or = vi.fn(() => claimBuilder);
    claimBuilder.select = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { generation_id: "gen-2" },
        error: null,
      })),
    }));
    const generationProjectionTable = {
      select: vi.fn((columns: string) =>
        columns.includes("companion_art_attempt_count")
          ? projectionSelectBuilder
          : projectionEligibilityBuilder
      ),
      update: vi.fn(() => claimBuilder),
    };

    const aiGenerationsTable = {
      select: vi.fn(() =>
        createSelectBuilder({
          data: {
            id: "gen-2",
            user_id: "user-2",
            prompt_text: "Storm warning siren",
            metadata: {},
          },
          error: null,
        })
      ),
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") return generationProjectionTable;
        if (table === "ai_generations") return aiGenerationsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
        })),
      },
    });

    const result = await processPendingAudioCompanionArtBatch({ limit: 5 });

    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      ready: 0,
      failed: 1,
      skipped: 0,
      errors: 0,
    });
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-2",
        userId: "user-2",
        companionArtStatus: "failed",
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.audio_companion_art.generation_failed",
        scope: "generation",
      })
    );
  });

  it("persists near-white provider images and records telemetry", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.like = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [
        {
          generation_id: "gen-white",
          user_id: "user-white",
          companion_art_attempt_count: 0,
          publication_state: "published",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    }));

    const projectionEligibilityBuilder = createSelectBuilder({
      data: {
        publication_state: "published",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const claimBuilder: Record<string, unknown> = {};
    claimBuilder.eq = vi.fn(() => claimBuilder);
    claimBuilder.lt = vi.fn(() => claimBuilder);
    claimBuilder.not = vi.fn(() => claimBuilder);
    claimBuilder.like = vi.fn(() => claimBuilder);
    claimBuilder.or = vi.fn(() => claimBuilder);
    claimBuilder.select = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { generation_id: "gen-white" },
        error: null,
      })),
    }));
    const generationProjectionTable = {
      select: vi.fn((columns: string) =>
        columns.includes("companion_art_attempt_count")
          ? projectionSelectBuilder
          : projectionEligibilityBuilder
      ),
      update: vi.fn(() => claimBuilder),
    };
    const uploadMock = vi.fn(async () => ({ error: null }));

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") return generationProjectionTable;
        if (table === "ai_generations") {
          return {
            select: vi.fn(() =>
              createSelectBuilder({
                data: {
                  id: "gen-white",
                  user_id: "user-white",
                  prompt_text: "Soft tone for a reference audio card",
                  metadata: {
                    source_mode: "voiceover",
                  },
                },
                error: null,
              })
            ),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
        })),
      },
    });
    generateFalFluxKleinImageMock.mockResolvedValue({
      buffer: Buffer.from("near-white-cover"),
      contentType: "image/png",
    });
    sharpStatsMock.mockResolvedValueOnce({
      channels: [
        { mean: 252, stdev: 1, min: 250, max: 255 },
        { mean: 252, stdev: 1, min: 250, max: 255 },
        { mean: 252, stdev: 1, min: 250, max: 255 },
      ],
    });

    const result = await processPendingAudioCompanionArtBatch({ limit: 5 });

    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(uploadMock).toHaveBeenCalledWith(
      "user-white/generations/audio/gen-white/companion-art/cover.webp",
      Buffer.from("cover-webp"),
      expect.objectContaining({
        contentType: "image/webp",
        upsert: true,
      })
    );
    expect(sharpToBufferMock).toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-white",
        userId: "user-white",
        companionArtStatus: "ready",
        companionArtStoragePath: "user-white/generations/audio/gen-white/companion-art/cover.webp",
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.audio_companion_art.near_white_image",
        scope: "generation",
      })
    );
  });

  it("clears claimed companion art work when the generation is suppressed before processing", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.like = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [
        {
          generation_id: "gen-suppressed",
          user_id: "user-suppressed",
          companion_art_attempt_count: 0,
          publication_state: "published",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    }));

    const projectionEligibilityBuilder = createSelectBuilder({
      data: {
        publication_state: "suppressed",
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
      },
      error: null,
    });
    const claimBuilder: Record<string, unknown> = {};
    claimBuilder.eq = vi.fn(() => claimBuilder);
    claimBuilder.lt = vi.fn(() => claimBuilder);
    claimBuilder.not = vi.fn(() => claimBuilder);
    claimBuilder.like = vi.fn(() => claimBuilder);
    claimBuilder.or = vi.fn(() => claimBuilder);
    claimBuilder.select = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { generation_id: "gen-suppressed" },
        error: null,
      })),
    }));
    const generationProjectionTable = {
      select: vi.fn((columns: string) =>
        columns.includes("companion_art_attempt_count")
          ? projectionSelectBuilder
          : projectionEligibilityBuilder
      ),
      update: vi.fn(() => claimBuilder),
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") return generationProjectionTable;
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
        })),
      },
    });

    const result = await processPendingAudioCompanionArtBatch({ limit: 5 });

    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      ready: 0,
      failed: 0,
      skipped: 1,
      errors: 0,
    });
    expect(generateFalFluxKleinImageMock).not.toHaveBeenCalled();
    expect(cleanupAudioCompanionArtMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-suppressed",
        userId: "user-suppressed",
        supabaseAdmin: expect.any(Object),
      })
    );
  });

  it("generates, persists, and signs immediate companion art for a voice generation", async () => {
    const projectionEligibilityBuilder = createSelectBuilder({
      data: {
        publication_state: "published",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const generationProjectionTable = {
      select: vi.fn(() => projectionEligibilityBuilder),
    };
    const aiGenerationsTable = {
      select: vi.fn(() =>
        createSelectBuilder({
          data: {
            id: "gen-now",
            user_id: "user-now",
            prompt_text: "A lighthouse keeper narrates an ocean storm.",
            metadata: {
              source_mode: "voiceover",
              voice_name: "Marin",
            },
          },
          error: null,
        })
      ),
    };
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/cover.webp" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") return generationProjectionTable;
        if (table === "ai_generations") return aiGenerationsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });
    generateFalFluxKleinImageMock.mockResolvedValue({
      buffer: Buffer.from("cover"),
      contentType: "image/png",
    });

    await expect(
      generateAudioCompanionArtForGeneration({
        generationId: "gen-now",
        userId: "user-now",
      })
    ).resolves.toEqual({
      companionArtStatus: "ready",
      companionArtStoragePath: "user-now/generations/audio/gen-now/companion-art/cover.webp",
      companionArtUrl: "https://signed.example/cover.webp",
    });

    expect(generateFalFluxKleinImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          prompt: expect.stringContaining("lighthouse keeper"),
          image_size: { width: 512, height: 512 },
        }),
        pollIntervalMs: 500,
        initialPollDelayMs: 0,
      })
    );
    expect(uploadMock).toHaveBeenCalledWith(
      "user-now/generations/audio/gen-now/companion-art/cover.webp",
      Buffer.from("cover-webp"),
      expect.objectContaining({
        contentType: "image/webp",
        upsert: true,
      })
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "user-now/generations/audio/gen-now/companion-art/cover.webp",
      60 * 60
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-now",
        userId: "user-now",
        companionArtStatus: "ready",
        companionArtStoragePath: "user-now/generations/audio/gen-now/companion-art/cover.webp",
      })
    );
    expect(mirrorGeneratedAudioPresentationToMediaFilesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-now",
        userId: "user-now",
        companionArtStatus: "ready",
        companionArtStoragePath: "user-now/generations/audio/gen-now/companion-art/cover.webp",
      })
    );
  });

  it("resets new audio rows to attempt zero on enqueue", async () => {
    await expect(
      markAudioCompanionArtPending({
        generationId: "gen-queued",
        userId: "user-queued",
      })
    ).resolves.toBeUndefined();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-queued",
        userId: "user-queued",
        companionArtStatus: "pending",
        companionArtAttemptCount: 0,
      })
    );
    expect(mirrorGeneratedAudioPresentationToMediaFilesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-queued",
        userId: "user-queued",
        companionArtStatus: "pending",
        companionArtStoragePath: null,
      })
    );
  });

  it("degrades enqueue failures without surfacing route errors", async () => {
    upsertGenerationProjectionMock.mockRejectedValueOnce(new Error("projection write failed"));

    await expect(
      markAudioCompanionArtPending({
        generationId: "gen-3",
        userId: "user-3",
      })
    ).resolves.toBeUndefined();

    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.audio_companion_art.enqueue_failed",
        scope: "generation",
      })
    );
  });
});
