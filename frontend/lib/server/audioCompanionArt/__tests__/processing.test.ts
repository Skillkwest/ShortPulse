import { beforeEach, describe, expect, it, vi } from "vitest";
import { markAudioCompanionArtPending, processPendingAudioCompanionArtBatch } from "../processing";

const getSupabaseAdminMock = vi.fn();
const generateOpenAiImageMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const resolveRuntimeAgentPromptMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../openaiImageGeneration", () => ({
  generateOpenAiImage: (...args: unknown[]) => generateOpenAiImageMock(...args),
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

const createSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
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
  });

  it("processes pending audio companion art rows to ready state", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [{ generation_id: "gen-1", user_id: "user-1", companion_art_attempt_count: 0 }],
      error: null,
    }));

    const claimMaybeSingle = vi.fn(async () => ({
      data: { generation_id: "gen-1" },
      error: null,
    }));
    const generationProjectionTable = {
      select: vi.fn(() => projectionSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => ({
              or: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: claimMaybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
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
    generateOpenAiImageMock.mockResolvedValue({
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
    expect(generateOpenAiImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "1024x1024",
        quality: "low",
        prompt: expect.stringContaining("Control-plane branded style line."),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        companionArtStatus: "ready",
        companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.png",
      })
    );
  });

  it("marks companion art rows failed when source-mode metadata is unavailable", async () => {
    const projectionSelectBuilder: Record<string, unknown> = {};
    projectionSelectBuilder.eq = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.lt = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.or = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.order = vi.fn(() => projectionSelectBuilder);
    projectionSelectBuilder.limit = vi.fn(async () => ({
      data: [{ generation_id: "gen-2", user_id: "user-2", companion_art_attempt_count: 1 }],
      error: null,
    }));

    const generationProjectionTable = {
      select: vi.fn(() => projectionSelectBuilder),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => ({
              or: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { generation_id: "gen-2" },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
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
