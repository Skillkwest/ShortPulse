import { describe, expect, it, vi } from "vitest";
import {
  repairStaleTerminalGenerationProjections,
  upsertGenerationProjection,
} from "../generationProjection";

const createSupabaseAdmin = ({
  projectionRows,
  generationRows,
  outputRows = [],
}: {
  projectionRows: Record<string, unknown>[];
  generationRows: Record<string, unknown>[];
  outputRows?: Record<string, unknown>[];
}) => {
  const upsert = vi.fn(async (payload: Record<string, unknown>) => ({
    data: payload,
    error: null,
  }));

  const from = vi.fn((table: string) => {
    if (table === "generation_projection") {
      return {
        select: () => ({
          in: () => ({
            lte: () => ({
              order: () => ({
                limit: async () => ({
                  data: projectionRows,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        upsert,
      };
    }

    if (table === "ai_generations") {
      return {
        select: () => ({
          in: () => ({
            limit: async () => ({
              data: generationRows,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "ai_generation_outputs") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: outputRows,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "generation_publications") {
      return {
        upsert,
      };
    }

    throw new Error(`unexpected table: ${table}`);
  });

  return {
    from,
    upsert,
  };
};

describe("repairStaleTerminalGenerationProjections", () => {
  it("repairs stale running projections when the canonical generation is terminal no-media fail", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-1",
          user_id: "user-1",
          source_ref: "source-1",
          request_id: "req-1",
          provider: "fal",
          provider_request_id: "req-1",
          latest_attempt_id: "attempt-1",
          display_prompt: "prompt-1",
          model_id: "seedream",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: { foo: "bar" },
          character_context: { characterId: "char-1" },
          style_context: { styleId: "style-1" },
          started_at: "2026-04-10T23:00:00.000Z",
        },
      ],
      generationRows: [
        {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          provider: "fal",
          model_id: "seedream",
          prompt_text: "prompt-1",
          status: "fail",
          failure_reason_code: "terminal_success_no_media",
          completed_at: "2026-04-10T23:20:00.000Z",
        },
      ],
    });

    const result = await repairStaleTerminalGenerationProjections({
      supabaseAdmin: supabaseAdmin as never,
      limit: 10,
      minAgeSeconds: 60,
      now: new Date("2026-04-10T23:30:00.000Z"),
    });

    expect(result).toEqual({
      scanned: 1,
      repaired: 1,
      skipped: 0,
    });
    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        status: "ready",
        task_state: "fail",
        publication_state: "suppressed",
        error_message_short: "No media returned.",
        error_detail: "Provider terminal success without media payload.",
        completed_at: "2026-04-10T23:20:00.000Z",
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("skips stale running projections when the canonical generation is not terminal fail", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-2",
          user_id: "user-2",
          request_id: "req-2",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      generationRows: [
        {
          id: "gen-2",
          user_id: "user-2",
          request_id: "req-2",
          status: "running",
          failure_reason_code: null,
          completed_at: null,
        },
      ],
    });

    const result = await repairStaleTerminalGenerationProjections({
      supabaseAdmin: supabaseAdmin as never,
      limit: 10,
      minAgeSeconds: 60,
      now: new Date("2026-04-10T23:30:00.000Z"),
    });

    expect(result).toEqual({
      scanned: 1,
      repaired: 0,
      skipped: 1,
    });
    expect(supabaseAdmin.upsert).not.toHaveBeenCalled();
  });

  it("repairs stale running projections when terminal success outputs already exist", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-3",
          user_id: "user-3",
          source_ref: "source-3",
          request_id: "req-3",
          provider: "fal",
          provider_request_id: "req-3",
          latest_attempt_id: "attempt-3",
          display_prompt: "prompt-3",
          model_id: "nano-banana",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: { input: "value" },
          character_context: { characterId: "char-3" },
          style_context: { styleId: "style-3" },
          started_at: "2026-04-10T23:00:00.000Z",
        },
      ],
      generationRows: [
        {
          id: "gen-3",
          user_id: "user-3",
          request_id: "req-3",
          provider: "fal",
          model_id: "nano-banana",
          prompt_text: "prompt-3",
          status: "success",
          failure_reason_code: null,
          completed_at: "2026-04-10T23:20:00.000Z",
        },
      ],
      outputRows: [
        {
          id: "output-1",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/generated.png",
          media_file_id: "media-1",
        },
      ],
    });

    const result = await repairStaleTerminalGenerationProjections({
      supabaseAdmin: supabaseAdmin as never,
      limit: 10,
      minAgeSeconds: 60,
      now: new Date("2026-04-10T23:30:00.000Z"),
    });

    expect(result).toEqual({
      scanned: 1,
      repaired: 1,
      skipped: 0,
    });
    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-3",
        user_id: "user-3",
        status: "ready",
        task_state: "success",
        publication_state: "published",
        preview_url: "https://cdn.shortpulse.test/generated.png",
        result_urls: ["https://cdn.shortpulse.test/generated.png"],
        saved_media_ids: ["media-1"],
        completed_at: "2026-04-10T23:20:00.000Z",
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });
});

describe("upsertGenerationProjection", () => {
  it("writes explicit null string fields so later success clears stale errors", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
    });

    await upsertGenerationProjection({
      generationId: "gen-clear",
      userId: "user-clear",
      status: "ready",
      taskState: "success",
      publicationState: "published",
      errorMessage: null,
      errorMessageShort: null,
      errorDetail: null,
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-clear",
        user_id: "user-clear",
        status: "ready",
        task_state: "success",
        publication_state: "published",
        error_message: null,
        error_message_short: null,
        error_detail: null,
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });
});
