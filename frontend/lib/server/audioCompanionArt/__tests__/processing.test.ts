import { beforeEach, describe, expect, it, vi } from "vitest";
import { markAudioCompanionArtPending, processPendingAudioCompanionArtBatch } from "../processing";

const getSupabaseAdminMock = vi.fn();
const buildFalFluxKleinImagePayloadMock = vi.fn();
const generateFalFluxKleinImageMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const resolveRuntimeAgentPromptMock = vi.fn();
const cleanupAudioCompanionArtMock = vi.fn();
const sharpMock = vi.fn();
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
  buildFalFluxKleinImagePayload: (...args: unknown[]) => buildFalFluxKleinImagePayloadMock(...args),
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

vi.mock("../cleanup", () => ({
  cleanupAudioCompanionArt: (...args: unknown[]) => cleanupAudioCompanionArtMock(...args),
}));

const createSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
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
    buildFalFluxKleinImagePayloadMock.mockImplementation((prompt: string, aspect: string) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      aspect,
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
      rotate: sharpRotateMock,
    });
  });

  it("processes pending audio companion art rows to ready state", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
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
      "companion_art_status.eq.pending,companion_art_status.eq.failed"
    );
    expect(projectionSelectBuilder.not).toHaveBeenCalledWith(
      "publication_state",
      "eq",
      "suppressed"
    );
    expect(buildFalFluxKleinImagePayloadMock).toHaveBeenCalledWith(
      expect.stringContaining("Control-plane branded style line."),
      "1:1"
    );
    expect(generateFalFluxKleinImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          prompt: expect.stringContaining("Control-plane branded style line."),
          image_size: { width: 1024, height: 1024 },
          num_inference_steps: 4,
        }),
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
      })
    );
  });

  it("clears claimed companion art work when the generation is suppressed before processing", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.not = vi.fn(() => projectionSelectBuilder);
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

  it("resets new audio rows to attempt zero on enqueue without scanning null-status history", async () => {
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
      })
    );
  });
});
