import { describe, expect, it, vi } from "vitest";
import {
  repairStaleTerminalGenerationProjections,
  upsertGenerationProjection,
} from "../generationProjection";

const createSupabaseAdmin = ({
  projectionRows,
  generationRows,
  outputRows = [],
  mediaRows = [],
  upsertImpl,
}: {
  projectionRows: Record<string, unknown>[];
  generationRows: Record<string, unknown>[];
  outputRows?: Record<string, unknown>[];
  mediaRows?: Record<string, unknown>[];
  upsertImpl?: (
    payload: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<{ data?: unknown; error: unknown }>;
}) => {
  const upsert = vi.fn(
    upsertImpl ??
      (async (payload: Record<string, unknown>) => ({
        data: payload,
        error: null,
      }))
  );

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

    if (table === "media_files") {
      return {
        select: () => ({
          in: () => ({
            eq: () => ({
              limit: async () => ({
                data: mediaRows,
                error: null,
              }),
            }),
          }),
        }),
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
          workflow_reload: { version: 1, originTool: "create" },
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
        workflow_reload: { version: 1, originTool: "create" },
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
          workflow_reload: { version: 1, originTool: "video" },
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
      mediaRows: [
        {
          id: "media-1",
          user_id: "user-3",
          storage_path: "user-3/generations/images/gen-3/full.png",
          preview_storage_path: "user-3/generations/images/gen-3/preview.png",
          file_type: "image/png",
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
        workflow_reload: { version: 1, originTool: "video" },
        completed_at: "2026-04-10T23:20:00.000Z",
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("keeps successful transient outputs visible during projection repair", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-4",
          user_id: "user-4",
          source_ref: "source-4",
          request_id: "req-4",
          provider: "kie",
          provider_request_id: "req-4",
          latest_attempt_id: "attempt-4",
          display_prompt: "prompt-4",
          model_id: "kie-ai/kling-3.0-master",
          hidden_in_reference_grid: false,
          reference_grid_visible: false,
          generation_replay: { input: "value" },
          character_context: { characterId: "char-4" },
          style_context: { styleId: "style-4" },
          started_at: "2026-04-10T23:00:00.000Z",
        },
      ],
      generationRows: [
        {
          id: "gen-4",
          user_id: "user-4",
          request_id: "req-4",
          provider: "kie",
          model_id: "kie-ai/kling-3.0-master",
          prompt_text: "prompt-4",
          status: "success",
          failure_reason_code: null,
          completed_at: "2026-04-10T23:20:00.000Z",
        },
      ],
      outputRows: [
        {
          id: "output-4",
          output_index: 0,
          result_url: "https://cdn.kie.ai/generated.mp4",
          media_file_id: null,
        },
      ],
      mediaRows: [],
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
        generation_id: "gen-4",
        user_id: "user-4",
        task_state: "success",
        publication_state: "suppressed",
        reference_grid_visible: true,
        preview_url: "https://cdn.kie.ai/generated.mp4",
        result_urls: ["https://cdn.kie.ai/generated.mp4"],
        saved_media_ids: [],
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

    const [payload, options] = supabaseAdmin.upsert.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      generation_id: "gen-clear",
      user_id: "user-clear",
      status: "ready",
      task_state: "success",
      publication_state: "published",
      error_message: null,
      error_message_short: null,
      error_detail: null,
      save_error: null,
    });
    expect(options).toMatchObject({
      onConflict: "generation_id",
    });
  });

  it("writes storage-blocked save_error copy onto projection rows", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
    });

    await upsertGenerationProjection({
      generationId: "gen-storage",
      userId: "user-storage",
      status: "ready",
      taskState: "success",
      saveState: "blocked_storage",
      saveError:
        "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-storage",
        user_id: "user-storage",
        save_state: "blocked_storage",
        save_error:
          "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("writes project scope onto projection rows", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
    });

    await upsertGenerationProjection({
      generationId: "gen-project-scope",
      userId: "user-project-scope",
      projectId: "project-scope-1",
      status: "ready",
      taskState: "running",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-project-scope",
        user_id: "user-project-scope",
        project_id: "project-scope-1",
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("retries without save_error when hosted schema is missing that column", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
      upsertImpl: async (payload) => {
        if ("save_error" in payload) {
          return {
            data: null,
            error: {
              code: "PGRST204",
              message:
                "Could not find the 'save_error' column of 'generation_projection' in the schema cache",
            },
          };
        }
        return {
          data: payload,
          error: null,
        };
      },
    });

    await upsertGenerationProjection({
      generationId: "gen-compat",
      userId: "user-compat",
      taskState: "success",
      saveState: "idle",
      saveError: null,
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledTimes(2);
    expect(supabaseAdmin.upsert.mock.calls[0]?.[0]).toMatchObject({
      generation_id: "gen-compat",
      user_id: "user-compat",
      save_error: null,
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).toMatchObject({
      generation_id: "gen-compat",
      user_id: "user-compat",
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).not.toHaveProperty("save_error");
  });
});
