import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listVisibleGeneratedOutputs,
  resolveGenerationIdForRequestId,
  resolveVisibleGenerationDelivery,
  resolveVisibleGenerationReconcile,
} from "../generatedMediaAuthority";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

const createAwaitableSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown; error: unknown }>["then"];
    catch: Promise<{ data: unknown; error: unknown }>["catch"];
    finally: Promise<{ data: unknown; error: unknown }>["finally"];
  } = {
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: (...args) => Promise.resolve(result).then(...args),
    catch: (...args) => Promise.resolve(result).catch(...args),
    finally: (...args) => Promise.resolve(result).finally(...args),
  };
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

describe("generatedMediaAuthority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("falls back to successful generation projection delivery when published media is suppressed", async () => {
    const publicationsBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/preview.png",
        result_urls: ["https://fal.test/full.png"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationsBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationDelivery({
        generationId: "gen-suppressed-1",
      })
    ).resolves.toEqual({
      previewUrl: "https://fal.test/preview.png",
      fullUrl: "https://fal.test/full.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });
  });

  it("falls back to published generation delivery when projection is not renderable", async () => {
    const publicationsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          preview_url: "https://cdn.test/published-preview.png",
          full_url: "https://cdn.test/published-full.png",
          preview_storage_path: null,
          full_storage_path: null,
          created_at: "2026-04-11T19:45:41.000Z",
        },
      ],
      error: null,
    });

    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: null,
        result_urls: [],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "running",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationsBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationDelivery({
        generationId: "gen-published-1",
      })
    ).resolves.toEqual({
      previewUrl: "https://cdn.test/published-preview.png",
      fullUrl: "https://cdn.test/published-full.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });
  });

  it("resolves visible generation reconcile by request id through projection identity", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-1",
      },
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/request-preview.png",
        result_urls: ["https://fal.test/request-full.png"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => projectionIdentityBuilder)
      .mockImplementationOnce(() => projectionDeliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        requestId: "req-visible-1",
      })
    ).resolves.toEqual({
      generationId: "gen-request-1",
      previewUrl: "https://fal.test/request-preview.png",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://fal.test/request-full.png"],
    });
  });

  it("requires project association before resolving request-backed generation ids on project routes", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-project-1",
      },
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-project-1",
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionIdentityBuilder),
          };
        }
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(
      resolveGenerationIdForRequestId({
        supabase: supabase as never,
        requestId: "req-project-1",
        userId: "user-1",
        projectId: "project-1",
      })
    ).resolves.toBe("gen-request-project-1");
  });

  it("returns null when a request-backed generation is not associated to the active project", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-missing",
      },
      error: null,
    });
    const generationBuilder = createAwaitableSelectBuilder({
      data: null,
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: null,
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionIdentityBuilder),
          };
        }
        if (table === "ai_generations") {
          return {
            select: vi.fn(() => generationBuilder),
          };
        }
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(
      resolveGenerationIdForRequestId({
        supabase: supabase as never,
        requestId: "req-project-missing",
        userId: "user-1",
        projectId: "project-1",
      })
    ).resolves.toBeNull();
  });

  it("lists visible generated outputs from canonical projection rows", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-visible-1",
          request_id: "req-visible-1",
          source_ref: "source-visible-1",
          provider: "fal",
          model_id: "fal-ai/veo3.1",
          display_prompt: "Orbiting camera around a sneaker",
          preview_url: "https://fal.test/visible-preview.mp4",
          result_urls: ["https://fal.test/visible-full.mp4"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "9:16",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(listVisibleGeneratedOutputs()).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-visible-1",
        generationId: "gen-visible-1",
        taskId: "req-visible-1",
        sourceRef: "source-visible-1",
        mode: "video",
        mediaSource: "generated",
        prompt: "Orbiting camera around a sneaker",
        modelId: "fal-ai/veo3.1",
        resultUrls: ["https://fal.test/visible-full.mp4"],
        previewUrl: "https://fal.test/visible-preview.mp4",
        taskState: "success",
        queueState: "dispatched",
        timestamp: "Just now",
        aspect: "9:16",
      }),
    ]);
  });

  it("lists only project-associated visible generated outputs when project scoped", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-visible-1",
          updated_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-visible-1",
          request_id: "req-project-visible-1",
          source_ref: "source-project-visible-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A recovered project output",
          preview_url: "https://fal.test/project-visible-preview.png",
          result_urls: ["https://fal.test/project-visible-full.png"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "1:1",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:12:00.000Z",
        },
      ],
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(listVisibleGeneratedOutputs({ projectId: "project-1" })).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-project-visible-1",
        generationId: "gen-project-visible-1",
        taskId: "req-project-visible-1",
        sourceRef: "source-project-visible-1",
        mode: "image",
        mediaSource: "generated",
        resultUrls: ["https://fal.test/project-visible-full.png"],
        previewUrl: "https://fal.test/project-visible-preview.png",
        taskState: "success",
        queueState: "dispatched",
      }),
    ]);
    expect(projectGenerationBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(projectionBuilder.in).toHaveBeenCalledWith("generation_id", ["gen-project-visible-1"]);
  });

  it("requires project generation association before reconciling project-route outputs", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-project-1",
      },
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/project-preview.png",
        result_urls: ["https://fal.test/project-full.png"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionDeliveryBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        generationId: "gen-project-1",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      generationId: "gen-project-1",
      previewUrl: "https://fal.test/project-preview.png",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://fal.test/project-full.png"],
    });
  });

  it("returns null for project-route reconcile when the generation is not associated to the project", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: null,
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        generationId: "gen-project-missing",
        projectId: "project-1",
      })
    ).resolves.toBeNull();
  });
});
