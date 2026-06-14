import { describe, expect, it, vi } from "vitest";
import {
  repairStaleTerminalGenerationProjections,
  upsertGenerationProjection,
} from "../generationProjection";
import {
  associateGenerationWithProjectForUser,
  associateMediaFilesWithProjectForUser,
} from "../../projectGenerationAssociationsService";

vi.mock("../../projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUser: vi.fn(async () => true),
  associateMediaFilesWithProjectForUser: vi.fn(async () => true),
}));

const createSupabaseAdmin = ({
  projectionRows,
  generationRows,
  outputRows = [],
  mediaRows = [],
  upsertImpl,
  projectionSelectImpl,
}: {
  projectionRows: Record<string, unknown>[];
  generationRows: Record<string, unknown>[];
  outputRows?: Record<string, unknown>[];
  mediaRows?: Record<string, unknown>[];
  upsertImpl?: (
    payload: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<{ data?: unknown; error: unknown }>;
  projectionSelectImpl?: (columns: string) => unknown;
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
        select:
          projectionSelectImpl ??
          (() => ({
            in: (column: string, values: string[]) => {
              const rows =
                column === "generation_id"
                  ? projectionRows.filter((row) => values.includes(String(row.generation_id)))
                  : column === "task_state"
                    ? projectionRows.filter((row) =>
                        values.includes(String(row.task_state ?? "running"))
                      )
                    : projectionRows;
              if (column === "generation_id") {
                return Promise.resolve({
                  data: rows,
                  error: null,
                });
              }
              return {
                lte: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: rows,
                      error: null,
                    }),
                  }),
                }),
              };
            },
          })),
        upsert,
      };
    }

    if (table === "ai_generations") {
      return {
        select: () => ({
          in: (column: string, values: string[]) => {
            const byGenerationIds = column === "id";
            const rows = byGenerationIds
              ? generationRows.filter((row) => values.includes(String(row.id)))
              : generationRows.filter((row) => values.includes(String(row.status)));
            return {
              limit: async () => ({
                data: rows,
                error: null,
              }),
              lte: () => ({
                order: () => ({
                  limit: async () => ({
                    data: rows,
                    error: null,
                  }),
                  range: async (from: number, to: number) => ({
                    data: rows.slice(from, to + 1),
                    error: null,
                  }),
                }),
              }),
            };
          },
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

  it("preserves provider error messages when repairing failed projections", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-provider-fail-1",
          user_id: "user-1",
          source_ref: "source-provider-fail-1",
          request_id: "req-provider-fail-1",
          provider: "kie",
          provider_request_id: "req-provider-fail-1",
          latest_attempt_id: "attempt-provider-fail-1",
          display_prompt: "prompt-1",
          model_id: "kie-ai/veo-3.1-fast-i2v",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          started_at: "2026-04-10T23:00:00.000Z",
        },
      ],
      generationRows: [
        {
          id: "gen-provider-fail-1",
          user_id: "user-1",
          request_id: "req-provider-fail-1",
          provider: "kie",
          model_id: "kie-ai/veo-3.1-fast-i2v",
          prompt_text: "prompt-1",
          status: "fail",
          failure_reason_code: "provider_error",
          error_message: "File type not supported",
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
        generation_id: "gen-provider-fail-1",
        user_id: "user-1",
        status: "ready",
        task_state: "fail",
        error_message: "File type not supported",
        error_message_short: "File type not supported",
        error_detail: "File type not supported",
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

  it("reconstructs missing terminal success projections from generation metadata", async () => {
    vi.mocked(associateGenerationWithProjectForUser).mockClear();
    vi.mocked(associateMediaFilesWithProjectForUser).mockClear();
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [
        {
          id: "gen-missing-projection",
          user_id: "user-project",
          request_id: "req-project",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "project prompt",
          status: "success",
          failure_reason_code: null,
          completed_at: "2026-04-10T23:20:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {
            source_ref: "source-project",
            shortpulse_context: {
              project_id: "project-1",
            },
            generation_replay: { prompt: "project prompt" },
            workflow_reload: { version: 1, originTool: "create" },
          },
        },
      ],
      outputRows: [
        {
          id: "output-project",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/project.png",
          media_file_id: "media-project",
        },
      ],
      mediaRows: [
        {
          id: "media-project",
          user_id: "user-project",
          storage_path: "user-project/generations/images/project.png",
          preview_storage_path: "user-project/generations/images/project-preview.png",
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
        generation_id: "gen-missing-projection",
        user_id: "user-project",
        project_id: "project-1",
        source_ref: "source-project",
        status: "ready",
        task_state: "success",
        publication_state: "published",
        result_urls: ["https://cdn.shortpulse.test/project.png"],
        saved_media_ids: ["media-project"],
        generation_replay: { prompt: "project prompt" },
        workflow_reload: { version: 1, originTool: "create" },
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
    expect(associateGenerationWithProjectForUser).toHaveBeenCalledWith({
      userId: "user-project",
      projectId: "project-1",
      generationId: "gen-missing-projection",
    });
    expect(associateMediaFilesWithProjectForUser).toHaveBeenCalledWith({
      userId: "user-project",
      projectId: "project-1",
      mediaFileIds: ["media-project"],
    });
  });

  it("pages past healthy terminal projections to repair older missing projections", async () => {
    vi.mocked(associateGenerationWithProjectForUser).mockClear();
    vi.mocked(associateMediaFilesWithProjectForUser).mockClear();
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [
        {
          generation_id: "gen-healthy-1",
          user_id: "user-project",
          task_state: "success",
        },
        {
          generation_id: "gen-healthy-2",
          user_id: "user-project",
          task_state: "success",
        },
      ],
      generationRows: [
        {
          id: "gen-healthy-1",
          user_id: "user-project",
          request_id: "req-healthy-1",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "healthy prompt 1",
          status: "success",
          completed_at: "2026-04-10T23:29:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {},
        },
        {
          id: "gen-healthy-2",
          user_id: "user-project",
          request_id: "req-healthy-2",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "healthy prompt 2",
          status: "success",
          completed_at: "2026-04-10T23:28:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {},
        },
        {
          id: "gen-missing-older",
          user_id: "user-project",
          request_id: "req-missing-older",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "older missing prompt",
          status: "success",
          completed_at: "2026-04-10T23:20:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {
            shortpulse_context: {
              project_id: "project-older",
            },
          },
        },
      ],
      outputRows: [
        {
          id: "output-older",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/older.png",
          media_file_id: "media-older",
        },
      ],
      mediaRows: [
        {
          id: "media-older",
          user_id: "user-project",
          storage_path: "user-project/generations/images/older.png",
          preview_storage_path: "user-project/generations/images/older-preview.png",
          file_type: "image/png",
        },
      ],
    });

    const result = await repairStaleTerminalGenerationProjections({
      supabaseAdmin: supabaseAdmin as never,
      limit: 1,
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
        generation_id: "gen-missing-older",
        user_id: "user-project",
        project_id: "project-older",
        task_state: "success",
        publication_state: "published",
        result_urls: ["https://cdn.shortpulse.test/older.png"],
        saved_media_ids: ["media-older"],
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("reports project association failures without failing projection repair", async () => {
    vi.mocked(associateGenerationWithProjectForUser).mockRejectedValueOnce(
      new Error("association unavailable")
    );
    vi.mocked(associateMediaFilesWithProjectForUser).mockClear();
    const onAssociationFailure = vi.fn();
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [
        {
          id: "gen-association-failure",
          user_id: "user-project",
          request_id: "req-association-failure",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "association failure prompt",
          status: "success",
          completed_at: "2026-04-10T23:20:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {
            shortpulse_context: {
              project_id: "project-association-failure",
            },
          },
        },
      ],
      outputRows: [
        {
          id: "output-association-failure",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/association-failure.png",
          media_file_id: "media-association-failure",
        },
      ],
      mediaRows: [
        {
          id: "media-association-failure",
          user_id: "user-project",
          storage_path: "user-project/generations/images/association-failure.png",
          preview_storage_path: "user-project/generations/images/association-failure-preview.png",
          file_type: "image/png",
        },
      ],
    });

    const result = await repairStaleTerminalGenerationProjections({
      supabaseAdmin: supabaseAdmin as never,
      limit: 10,
      minAgeSeconds: 60,
      now: new Date("2026-04-10T23:30:00.000Z"),
      onAssociationFailure,
    });

    expect(result).toEqual({
      scanned: 1,
      repaired: 1,
      skipped: 0,
    });
    expect(onAssociationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "generation",
        userId: "user-project",
        projectId: "project-association-failure",
        generationId: "gen-association-failure",
        error: expect.any(Error),
      })
    );
  });

  it("keeps autosave-skipped missing projections suppressed without creating media associations", async () => {
    vi.mocked(associateGenerationWithProjectForUser).mockClear();
    vi.mocked(associateMediaFilesWithProjectForUser).mockClear();
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [
        {
          id: "gen-autosave-off",
          user_id: "user-autosave-off",
          request_id: "req-autosave-off",
          provider: "fal",
          model_id: "fal-ai/flux",
          prompt_text: "autosave off prompt",
          status: "success",
          failure_reason_code: null,
          completed_at: "2026-04-10T23:20:00.000Z",
          created_at: "2026-04-10T23:00:00.000Z",
          metadata: {
            source_ref: "source-autosave-off",
            shortpulse_context: {
              project_id: "project-2",
            },
            autosave_decision: "autosave_skipped",
            autosave_decision_reason: "autosave_disabled",
          },
        },
      ],
      outputRows: [
        {
          id: "output-autosave-off",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/autosave-off.png",
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
        generation_id: "gen-autosave-off",
        user_id: "user-autosave-off",
        project_id: "project-2",
        task_state: "success",
        publication_state: "suppressed",
        save_state: "idle",
        result_urls: ["https://cdn.shortpulse.test/autosave-off.png"],
        saved_media_ids: [],
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
    expect(associateGenerationWithProjectForUser).toHaveBeenCalledWith({
      userId: "user-autosave-off",
      projectId: "project-2",
      generationId: "gen-autosave-off",
    });
    expect(associateMediaFilesWithProjectForUser).not.toHaveBeenCalled();
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
      error_payload: null,
      save_error: null,
    });
    expect(options).toMatchObject({
      onConflict: "generation_id",
    });
  });

  it("writes raw error payloads onto failed projection rows", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
    });
    const errorPayload = {
      error: {
        message: "Provider rejected image_urls[0].",
        request_id: "req-provider",
      },
    };

    await upsertGenerationProjection({
      generationId: "gen-error-payload",
      userId: "user-error-payload",
      status: "ready",
      taskState: "fail",
      errorMessage: "Generation failed",
      errorMessageShort: "Generation failed",
      errorDetail: "Provider rejected image_urls[0].",
      errorPayload,
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-error-payload",
        user_id: "user-error-payload",
        error_payload: errorPayload,
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
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

  it("writes bounded workspace runtime scope onto projection rows", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
    });

    await upsertGenerationProjection({
      generationId: "gen-workspace-scope",
      userId: "user-workspace-scope",
      workspaceRuntimeKey: "session:session-scope-1",
      status: "ready",
      taskState: "running",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-workspace-scope",
        user_id: "user-workspace-scope",
        workspace_runtime_key: "session:session-scope-1",
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

  it("retries without display_title when hosted schema is missing that column", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
      upsertImpl: async (payload) => {
        if ("display_title" in payload) {
          return {
            data: null,
            error: {
              code: "PGRST204",
              message:
                "Could not find the 'display_title' column of 'generation_projection' in the schema cache",
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
      generationId: "gen-display-title-compat",
      userId: "user-display-title-compat",
      taskState: "success",
      displayTitle: "Song Title",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledTimes(2);
    expect(supabaseAdmin.upsert.mock.calls[0]?.[0]).toMatchObject({
      generation_id: "gen-display-title-compat",
      user_id: "user-display-title-compat",
      display_title: "Song Title",
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).toMatchObject({
      generation_id: "gen-display-title-compat",
      user_id: "user-display-title-compat",
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).not.toHaveProperty("display_title");
  });

  it("retries without error_payload when hosted schema is missing that column", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
      upsertImpl: async (payload) => {
        if ("error_payload" in payload) {
          return {
            data: null,
            error: {
              code: "PGRST204",
              message:
                "Could not find the 'error_payload' column of 'generation_projection' in the schema cache",
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
      generationId: "gen-error-payload-compat",
      userId: "user-error-payload-compat",
      taskState: "fail",
      errorPayload: { error: "provider failed" },
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(supabaseAdmin.upsert).toHaveBeenCalledTimes(2);
    expect(supabaseAdmin.upsert.mock.calls[0]?.[0]).toMatchObject({
      generation_id: "gen-error-payload-compat",
      user_id: "user-error-payload-compat",
      error_payload: { error: "provider failed" },
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).toMatchObject({
      generation_id: "gen-error-payload-compat",
      user_id: "user-error-payload-compat",
    });
    expect(supabaseAdmin.upsert.mock.calls[1]?.[0]).not.toHaveProperty("error_payload");
  });

  it("retries stale terminal repair scan without display_title when hosted schema is stale", async () => {
    const selectCalls: string[] = [];
    const projectionSelectImpl = vi.fn((columns: string) => {
      selectCalls.push(columns);
      return {
        in: () => ({
          lte: () => ({
            order: () => ({
              limit: async () =>
                columns.includes("display_title")
                  ? {
                      data: null,
                      error: {
                        code: "PGRST204",
                        message:
                          "Could not find the 'display_title' column of 'generation_projection' in the schema cache",
                      },
                    }
                  : {
                      data: [],
                      error: null,
                    },
            }),
          }),
        }),
      };
    });
    const supabaseAdmin = createSupabaseAdmin({
      projectionRows: [],
      generationRows: [],
      projectionSelectImpl,
    });

    await expect(
      repairStaleTerminalGenerationProjections({
        supabaseAdmin: supabaseAdmin as never,
        now: new Date("2026-06-10T20:00:00.000Z"),
      })
    ).resolves.toEqual({
      scanned: 0,
      repaired: 0,
      skipped: 0,
    });
    expect(selectCalls[0]).toContain("display_title");
    expect(selectCalls[1]).not.toContain("display_title");
  });
});
