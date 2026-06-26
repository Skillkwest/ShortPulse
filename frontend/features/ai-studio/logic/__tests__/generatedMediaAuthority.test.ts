import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listVisibleGeneratedOutputs,
  resolveGenerationProjectionLifecycle,
  resolveGenerationIdForRequestId,
  resolveVisibleGenerationDelivery,
  resolveVisibleGenerationReconcile,
} from "../generatedMediaAuthority";
import { getAiStudioErrorScenario } from "../../testing/errorScenarioFixtures";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());
const getSignedMediaUrlsBatchMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: getSignedMediaUrlsBatchMock,
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
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("uses successful generation projection delivery when published media is suppressed", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/preview.png",
        result_urls: ["https://fal.test/full.png"],
        preview_storage_path: "user-1/generations/images/gen-project-1/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-1/full.png",
        task_state: "success",
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
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationDelivery({
        generationId: "gen-suppressed-1",
      })
    ).resolves.toEqual({
      previewUrl: "https://fal.test/preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      fullUrl: "https://fal.test/full.png",
      previewStoragePath: "user-1/generations/images/gen-project-1/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-1/full.png",
    });
  });

  it("does not use published delivery when projection is not renderable", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: null,
        result_urls: [],
        preview_storage_path:
          "user-1/generations/images/gen-project-projection-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-projection-reconcile/full.png",
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
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationDelivery({
        generationId: "gen-published-1",
      })
    ).resolves.toBeNull();
  });

  it("reads hidden terminal projection lifecycle without requiring visible media", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-hidden-fail",
        task_state: "fail",
        queue_state: "failed",
        error_message_short: "Generation abandoned by user.",
        error_detail: "Generation abandoned by user.",
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
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
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveGenerationProjectionLifecycle({
        generationId: "gen-hidden-fail",
      })
    ).resolves.toEqual({
      generationId: "gen-hidden-fail",
      taskState: "fail",
      queueState: undefined,
      hiddenInReferenceGrid: true,
      referenceGridVisible: false,
      errorMessageShort: "Generation abandoned by user.",
      errorDetail: "Generation abandoned by user.",
      errorPayload: null,
    });
  });

  it("resolves visible generation reconcile by request id through projection identity", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-request-1",
          request_id: "req-visible-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/request-preview.png",
        result_urls: ["https://fal.test/request-full.png"],
        preview_storage_path:
          "user-1/generations/images/gen-project-projection-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-projection-reconcile/full.png",
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
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-project-projection-reconcile/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-projection-reconcile/full.png",
      resultUrls: ["https://fal.test/request-full.png"],
    });
  });

  it("promotes published storage authority when projection delivery is remote-only", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/videos/gen-request-durable-1/full.mp4",
          "https://signed.test/request-durable-full.mp4",
        ],
        [
          "user-1/variants/videos/media-request-durable-1/poster_720.jpg",
          "https://signed.test/request-durable-poster.jpg",
        ],
      ])
    );
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-request-durable-1",
          request_id: "req-visible-durable-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/request-durable-preview.mp4",
        result_urls: ["https://fal.test/request-durable-full.mp4"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          owned_media_file_id: "media-request-durable-1",
          preview_url: null,
          full_url: null,
          preview_storage_path: "user-1/generations/videos/gen-request-durable-1/full.mp4",
          full_storage_path: "user-1/generations/videos/gen-request-durable-1/full.mp4",
          created_at: "2026-05-13T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const mediaFileBuilder = createAwaitableSelectBuilder({
      data: {
        id: "media-request-durable-1",
        storage_path: "user-1/generations/videos/gen-request-durable-1/full.mp4",
        file_type: "video",
        filename: "request-durable.mp4",
        poster_variant_path: "user-1/variants/videos/media-request-durable-1/poster_720.jpg",
        preview_variant_path: null,
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaFileBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        requestId: "req-visible-durable-1",
      })
    ).resolves.toEqual({
      generationId: "gen-request-durable-1",
      previewUrl: "https://signed.test/request-durable-full.mp4",
      previewPosterUrl: "https://signed.test/request-durable-poster.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-request-durable-1/poster_720.jpg",
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/videos/gen-request-durable-1/full.mp4",
      fullStoragePath: "user-1/generations/videos/gen-request-durable-1/full.mp4",
      resultUrls: ["https://signed.test/request-durable-full.mp4"],
    });
  });

  it("promotes canonical output media authority during reconcile when publication is missing", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/media-request-canonical-1/preview_loop_360p.mp4",
          "https://signed.test/request-canonical-preview.mp4",
        ],
        [
          "user-1/generations/videos/gen-request-canonical-1/full.mp4",
          "https://signed.test/request-canonical-full.mp4",
        ],
        [
          "user-1/variants/videos/media-request-canonical-1/poster_720.jpg",
          "https://signed.test/request-canonical-poster.jpg",
        ],
      ])
    );
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-request-canonical-1",
          request_id: "req-visible-canonical-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/request-canonical-preview.mp4",
        result_urls: ["https://fal.test/request-canonical-full.mp4"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-request-canonical-1",
          media_file_id: "media-request-canonical-1",
          output_index: 0,
          created_at: "2026-05-13T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-request-canonical-1",
          storage_path: "user-1/generations/videos/gen-request-canonical-1/full.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-request-canonical-1/poster_720.jpg",
          preview_variant_path:
            "user-1/variants/videos/media-request-canonical-1/preview_loop_360p.mp4",
          filename: "request-canonical.mp4",
        },
      ],
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        requestId: "req-visible-canonical-1",
      })
    ).resolves.toEqual({
      generationId: "gen-request-canonical-1",
      previewUrl: "https://signed.test/request-canonical-full.mp4",
      previewPosterUrl: "https://signed.test/request-canonical-poster.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-request-canonical-1/poster_720.jpg",
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/variants/videos/media-request-canonical-1/preview_loop_360p.mp4",
      fullStoragePath: "user-1/generations/videos/gen-request-canonical-1/full.mp4",
      resultUrls: ["https://signed.test/request-canonical-full.mp4"],
    });
  });

  it("uses published preview-loop storage authority separately from poster authority", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/media-published-video-1/preview_loop_360p.mp4",
          "https://signed.test/published-video-preview.mp4",
        ],
        [
          "user-1/generations/videos/gen-published-video-1/full.mp4",
          "https://signed.test/published-video-full.mp4",
        ],
        [
          "user-1/variants/videos/media-published-video-1/poster_720.jpg",
          "https://signed.test/published-video-poster.jpg",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/published-video-preview.mp4",
        result_urls: ["https://fal.test/published-video-full.mp4"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          owned_media_file_id: "media-published-video-1",
          preview_url: "https://fal.test/published-video-preview.mp4",
          full_url: "https://fal.test/published-video-full.mp4",
          preview_storage_path: "user-1/generations/videos/gen-published-video-1/full.mp4",
          full_storage_path: "user-1/generations/videos/gen-published-video-1/full.mp4",
          created_at: "2026-05-13T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: {
        id: "media-published-video-1",
        storage_path: "user-1/generations/videos/gen-published-video-1/full.mp4",
        file_type: "video/mp4",
        poster_variant_path: "user-1/variants/videos/media-published-video-1/poster_720.jpg",
        preview_variant_path:
          "user-1/variants/videos/media-published-video-1/preview_loop_360p.mp4",
        filename: "published-video.mp4",
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
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        generationId: "gen-published-video-1",
      })
    ).resolves.toEqual({
      generationId: "gen-published-video-1",
      previewUrl: "https://signed.test/published-video-full.mp4",
      previewPosterUrl: "https://signed.test/published-video-poster.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-published-video-1/poster_720.jpg",
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/variants/videos/media-published-video-1/preview_loop_360p.mp4",
      fullStoragePath: "user-1/generations/videos/gen-published-video-1/full.mp4",
      resultUrls: ["https://signed.test/published-video-full.mp4"],
    });
  });

  it("re-signs storage-backed projection delivery before returning single-generation reconcile", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/images/gen-storage-1/preview.png",
          "https://signed.test/fresh-preview.png",
        ],
        ["user-1/generations/images/gen-storage-1/full.png", "https://signed.test/fresh-full.png"],
      ])
    );
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://signed.test/expired-preview.png",
        result_urls: ["https://signed.test/expired-full.png"],
        preview_storage_path: "user-1/generations/images/gen-storage-1/preview.png",
        full_storage_path: "user-1/generations/images/gen-storage-1/full.png",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
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
        generationId: "gen-storage-1",
      })
    ).resolves.toEqual({
      generationId: "gen-storage-1",
      previewUrl: "https://signed.test/fresh-preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-storage-1/preview.png",
      fullStoragePath: "user-1/generations/images/gen-storage-1/full.png",
      resultUrls: ["https://signed.test/fresh-full.png"],
    });
  });

  it("returns companion art from projection delivery during reconcile", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
          "https://signed.test/audio-cover.webp",
        ],
      ])
    );
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://signed.test/audio-preview.wav",
        result_urls: ["https://signed.test/audio-preview.wav"],
        display_title: "Midnight Signal",
        preview_storage_path: "user-1/generations/audio/gen-audio-1/audio.wav",
        full_storage_path: "user-1/generations/audio/gen-audio-1/audio.wav",
        companion_art_status: "ready",
        companion_art_storage_path: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const projectionSelect = vi.fn(() => projectionDeliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: projectionSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveVisibleGenerationReconcile({
        generationId: "gen-audio-1",
      })
    ).resolves.toEqual({
      generationId: "gen-audio-1",
      title: "Midnight Signal",
      previewUrl: "https://signed.test/audio-preview.wav",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: "https://signed.test/audio-cover.webp",
      companionArtStoragePath: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
      companionArtStatus: "ready",
      previewStoragePath: "user-1/generations/audio/gen-audio-1/audio.wav",
      fullStoragePath: "user-1/generations/audio/gen-audio-1/audio.wav",
      resultUrls: ["https://signed.test/audio-preview.wav"],
    });
    expect(projectionSelect).toHaveBeenCalledWith(expect.stringContaining("companion_art_status"));
    expect(projectionSelect).toHaveBeenCalledWith(
      expect.stringContaining("companion_art_storage_path")
    );
    const projectionSelectCalls = projectionSelect.mock.calls as unknown as Array<[string]>;
    const projectionSelectColumns = projectionSelectCalls[0]?.[0] ?? "";
    expect(projectionSelectColumns).not.toContain("generation_replay");
    expect(projectionSelectColumns).not.toContain("workflow_reload");
    expect(projectionSelectColumns).not.toContain("character_context");
    expect(projectionSelectColumns).not.toContain("style_context");
  });

  it("signs projection poster storage for completed generated video reconcile", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/videos/gen-video-1/poster_720.jpg", "https://signed.test/poster_720.jpg"],
      ])
    );
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        model_id: "fal-ai/veo3.1",
        preview_url: "https://fal.test/video-preview.mp4",
        result_urls: ["https://fal.test/video-full.mp4"],
        preview_storage_path: "user-1/variants/videos/gen-video-1/poster_720.jpg",
        full_storage_path: "user-1/generations/videos/gen-video-1.mp4",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
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
        generationId: "gen-video-1",
      })
    ).resolves.toEqual({
      generationId: "gen-video-1",
      previewUrl: "https://fal.test/video-preview.mp4",
      previewPosterUrl: "https://signed.test/poster_720.jpg",
      previewPosterStoragePath: "user-1/variants/videos/gen-video-1/poster_720.jpg",
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/videos/gen-video-1.mp4",
      fullStoragePath: "user-1/generations/videos/gen-video-1.mp4",
      resultUrls: ["https://fal.test/video-full.mp4"],
    });
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: expect.arrayContaining(["user-1/variants/videos/gen-video-1/poster_720.jpg"]),
        surface: "reference-grid",
      })
    );
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

  it("resolves request-backed generation ids only from generation_projection", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
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
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(
      resolveGenerationIdForRequestId({
        supabase: supabase as never,
        requestId: "req-missing-projection-1",
        userId: "user-1",
      })
    ).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalledWith("ai_generations");
  });

  it("returns null when a request-backed generation is not associated to the active project", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-missing",
      },
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

  it("resolves request-backed project generations from projection project scope when association is missing", async () => {
    const projectionIdentityBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-project-projection",
      },
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: null,
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
      data: {
        generation_id: "gen-request-project-projection",
        project_id: "project-1",
      },
      error: null,
    });
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => projectionIdentityBuilder)
      .mockImplementationOnce(() => projectProjectionBuilder);

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
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
        requestId: "req-project-projection",
        userId: "user-1",
        projectId: "project-1",
      })
    ).resolves.toBe("gen-request-project-projection");
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
          transcript_text: "A camera circles a sneaker on a floating pedestal.",
          preview_url: "https://fal.test/visible-preview.mp4",
          result_urls: ["https://fal.test/visible-full.mp4"],
          preview_storage_path: "user-1/generations/videos/gen-visible-1/preview.mp4",
          full_storage_path: "user-1/generations/videos/gen-visible-1/full.mp4",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "9:16",
          },
          workflow_reload: {
            version: 1,
            originTool: "video",
            panelKind: "video",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionSelect = vi.fn(() => projectionBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: projectionSelect,
          };
        }
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-visible-1",
        generationId: "gen-visible-1",
        taskId: "req-visible-1",
        sourceRef: "source-visible-1",
        mode: "video",
        mediaSource: "generated",
        prompt: "Orbiting camera around a sneaker",
        transcriptText: "A camera circles a sneaker on a floating pedestal.",
        modelId: "fal-ai/veo3.1",
        resultUrls: ["https://fal.test/visible-full.mp4"],
        previewUrl: "https://fal.test/visible-preview.mp4",
        taskState: "success",
        queueState: "dispatched",
        timestamp: "Just now",
        aspect: "9:16",
        workflowReload: {
          version: 1,
          originTool: "video",
          panelKind: "video",
        },
      }),
    ]);
    const projectionSelectCalls = projectionSelect.mock.calls as unknown as Array<[string]>;
    const projectionSelectColumns = projectionSelectCalls[0]?.[0] ?? "";
    expect(projectionSelectColumns).toContain("generation_replay");
    expect(projectionSelectColumns).toContain("workflow_reload");
    expect(projectionSelectColumns).toContain("character_context");
    expect(projectionSelectColumns).toContain("style_context");
  });

  it("keeps provider-url-only success rows visible during restore", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-provider-only-1",
          request_id: "req-provider-only-1",
          source_ref: "source-provider-only-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A provider-only generated output",
          preview_url: "https://fal.test/provider-only-preview.png",
          result_urls: ["https://fal.test/provider-only-full.png"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
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
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-provider-only-1",
        generationId: "gen-provider-only-1",
        taskId: "req-provider-only-1",
        sourceRef: "source-provider-only-1",
        prompt: "A provider-only generated output",
        previewUrl: "https://fal.test/provider-only-preview.png",
        resultUrls: ["https://fal.test/provider-only-full.png"],
        taskState: "success",
        queueState: "dispatched",
      }),
    ]);
  });

  it("hydrates published media dimensions onto generated outputs", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-visible-image-1",
          request_id: "req-visible-image-1",
          source_ref: "source-visible-image-1",
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          display_prompt: "Editorial product still",
          transcript_text: null,
          preview_url: "https://fal.test/preview.png",
          result_urls: ["https://fal.test/full.png"],
          preview_storage_path: "user-1/generations/images/gen-older-touched-late/preview.png",
          full_storage_path: "user-1/generations/images/gen-older-touched-late/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "16:9",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-05-30T19:40:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-visible-image-1",
          owned_media_file_id: "media-image-1",
          created_at: "2026-05-30T19:40:05.000Z",
        },
      ],
      error: null,
    });
    const mediaFileBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-image-1",
          preview_storage_path: "user-1/generated/preview.png",
          storage_path: "user-1/generated/full.png",
          filename: "preview.png",
          file_type: "image/png",
          thumb_variant_path: "user-1/generated/thumb.png",
          poster_variant_path: null,
          preview_variant_path: null,
          width: 1792,
          height: 1008,
          metadata: {
            width: 1792,
            height: 1008,
          },
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
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
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaFileBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-visible-image-1",
        generationId: "gen-visible-image-1",
        mode: "image",
        width: 1792,
        height: 1008,
        previewStoragePath: "user-1/generated/thumb.png",
        fullStoragePath: "user-1/generated/full.png",
      }),
    ]);
  });

  it("orders generated outputs newest-first by generation recency instead of projection updated_at", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-older-touched-late",
          request_id: "req-older-touched-late",
          source_ref: "source-older-touched-late",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Older generation touched later",
          preview_url: "https://fal.test/older.png",
          result_urls: ["https://fal.test/older.png"],
          preview_storage_path: "user-1/generations/images/gen-newest-started/preview.png",
          full_storage_path: "user-1/generations/images/gen-newest-started/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          started_at: "2026-04-18T16:00:00.000Z",
          created_at: "2026-04-18T16:00:00.000Z",
          updated_at: "2026-04-18T16:20:00.000Z",
        },
        {
          generation_id: "gen-newest-started",
          request_id: "req-newest-started",
          source_ref: "source-newest-started",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Newest generation",
          preview_url: "https://fal.test/newest.png",
          result_urls: ["https://fal.test/newest.png"],
          preview_storage_path: "user-1/generations/images/gen-project-visible-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-visible-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          started_at: "2026-04-18T16:10:00.000Z",
          created_at: "2026-04-18T16:10:00.000Z",
          updated_at: "2026-04-18T16:10:05.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
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
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({ generationId: "gen-newest-started" }),
      expect.objectContaining({ generationId: "gen-older-touched-late" }),
    ]);
  });

  it("hydrates completed generated videos with published poster storage paths", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/gen-video-poster-1/poster_720.jpg",
          "https://signed.test/gen-video-poster-1/poster_720.jpg",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-poster-1",
          request_id: "req-video-poster-1",
          source_ref: "source-video-poster-1",
          provider: "fal",
          model_id: "fal-ai/veo3.1",
          display_prompt: "A cinematic video",
          preview_url: "https://fal.test/video-preview.mp4",
          result_urls: ["https://fal.test/video-full.mp4"],
          preview_storage_path: "user-1/generations/videos/gen-video-poster-1.mp4",
          full_storage_path: "user-1/generations/videos/gen-video-poster-1.mp4",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "16:9",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-poster-1",
          owned_media_file_id: "media-video-poster-1",
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-video-poster-1",
          storage_path: "user-1/generations/videos/gen-video-poster-1.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/gen-video-poster-1/poster_720.jpg",
          preview_variant_path: "user-1/variants/videos/gen-video-poster-1/preview_loop_360p.mp4",
          filename: "video.mp4",
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-video-poster-1",
        mode: "video",
        resultUrls: ["https://fal.test/video-full.mp4"],
        previewUrl: "https://fal.test/video-preview.mp4",
        previewPosterUrl: "https://signed.test/gen-video-poster-1/poster_720.jpg",
        previewPosterStoragePath: "user-1/variants/videos/gen-video-poster-1/poster_720.jpg",
        previewStoragePath: "user-1/generations/videos/gen-video-poster-1.mp4",
        fullStoragePath: "user-1/generations/videos/gen-video-poster-1.mp4",
      }),
    ]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/variants/videos/gen-video-poster-1/poster_720.jpg"],
        surface: "reference-grid",
      })
    );
  });

  it("promotes published media storage authority during list hydration for remote-only videos", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/media-video-remote-only-1/preview_loop_360p.mp4",
          "https://signed.test/media-video-remote-only-1/preview_loop_360p.mp4",
        ],
        [
          "user-1/generations/videos/gen-video-remote-only-1/full.mp4",
          "https://signed.test/media-video-remote-only-1/full.mp4",
        ],
        [
          "user-1/variants/videos/media-video-remote-only-1/poster_720.jpg",
          "https://signed.test/media-video-remote-only-1/poster_720.jpg",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-remote-only-1",
          request_id: "req-video-remote-only-1",
          source_ref: "source-video-remote-only-1",
          provider: "fal",
          model_id: "fal-ai/veo3.1",
          display_prompt: "A remote-only generated video",
          preview_url: "https://fal.test/video-remote-only-preview.mp4",
          result_urls: ["https://fal.test/video-remote-only-full.mp4"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-remote-only-1",
          owned_media_file_id: "media-video-remote-only-1",
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-video-remote-only-1",
          storage_path: "user-1/generations/videos/gen-video-remote-only-1/full.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-video-remote-only-1/poster_720.jpg",
          preview_variant_path:
            "user-1/variants/videos/media-video-remote-only-1/preview_loop_360p.mp4",
          filename: "video-remote-only.mp4",
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-video-remote-only-1",
        mode: "video",
        previewUrl: "https://signed.test/media-video-remote-only-1/full.mp4",
        previewPosterUrl: "https://signed.test/media-video-remote-only-1/poster_720.jpg",
        previewPosterStoragePath: "user-1/variants/videos/media-video-remote-only-1/poster_720.jpg",
        previewStoragePath:
          "user-1/variants/videos/media-video-remote-only-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/gen-video-remote-only-1/full.mp4",
        resultUrls: ["https://signed.test/media-video-remote-only-1/full.mp4"],
      }),
    ]);
  });

  it("keeps remote-only published videos on full storage when only a poster variant exists", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/videos/gen-video-poster-only-1/full.mp4",
          "https://signed.test/media-video-poster-only-1/full.mp4",
        ],
        [
          "user-1/variants/videos/media-video-poster-only-1/poster_720.jpg",
          "https://signed.test/media-video-poster-only-1/poster_720.jpg",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-poster-only-1",
          request_id: "req-video-poster-only-1",
          source_ref: "source-video-poster-only-1",
          provider: "fal",
          model_id: "fal-ai/veo3.1",
          display_prompt: "A remote-only generated video with poster-only canonical media",
          preview_url: "https://fal.test/video-poster-only-preview.mp4",
          result_urls: ["https://fal.test/video-poster-only-full.mp4"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-poster-only-1",
          owned_media_file_id: "media-video-poster-only-1",
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-video-poster-only-1",
          storage_path: "user-1/generations/videos/gen-video-poster-only-1/full.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-video-poster-only-1/poster_720.jpg",
          preview_variant_path: null,
          filename: "video-poster-only.mp4",
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-video-poster-only-1",
        mode: "video",
        previewUrl: "https://signed.test/media-video-poster-only-1/full.mp4",
        previewPosterUrl: "https://signed.test/media-video-poster-only-1/poster_720.jpg",
        previewPosterStoragePath: "user-1/variants/videos/media-video-poster-only-1/poster_720.jpg",
        previewStoragePath: "user-1/generations/videos/gen-video-poster-only-1/full.mp4",
        fullStoragePath: "user-1/generations/videos/gen-video-poster-only-1/full.mp4",
        resultUrls: ["https://signed.test/media-video-poster-only-1/full.mp4"],
      }),
    ]);
  });

  it("hydrates completed generated audio from projection result urls", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-audio-1",
          request_id: "req-audio-1",
          source_ref: "source-audio-1",
          provider: "elevenlabs",
          model_id: "music_v1",
          display_prompt: "Sparse synth pulse",
          display_title: "Midnight Sparse",
          preview_url: "https://signed.example/music.mp3",
          result_urls: ["https://signed.example/music.mp3"],
          preview_storage_path: "user-1/generations/audio/gen-audio-1/music.mp3",
          full_storage_path: "user-1/generations/audio/gen-audio-1/music.mp3",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          workflow_reload: {
            payload: {
              kind: "music",
              lyrics: "Sparse synth over midnight streets",
            },
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

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-audio-1",
        mode: "audio",
        provider: "elevenlabs",
        modelId: "music_v1",
        title: "Midnight Sparse",
        audioSourceMode: "music",
        lyricsText: "Sparse synth over midnight streets",
        resultUrls: ["https://signed.example/music.mp3"],
        previewUrl: "https://signed.example/music.mp3",
        previewStoragePath: "user-1/generations/audio/gen-audio-1/music.mp3",
        fullStoragePath: "user-1/generations/audio/gen-audio-1/music.mp3",
        taskState: "success",
      }),
    ]);
  });

  it("re-signs storage-backed generated image rows during list hydration", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/images/gen-image-storage-1/preview.png",
          "https://signed.test/image-fresh-preview.png",
        ],
        [
          "user-1/generations/images/gen-image-storage-1/full.png",
          "https://signed.test/image-fresh-full.png",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-image-storage-1",
          request_id: "req-image-storage-1",
          source_ref: "source-image-storage-1",
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          display_prompt: "Green product portrait",
          preview_url: "https://signed.test/image-expired-preview.png",
          result_urls: ["https://signed.test/image-expired-full.png"],
          preview_storage_path: "user-1/generations/images/gen-image-storage-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-image-storage-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
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

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-image-storage-1",
        mode: "image",
        previewUrl: "https://signed.test/image-fresh-preview.png",
        resultUrls: ["https://signed.test/image-fresh-full.png"],
      }),
    ]);
  });

  it("re-signs storage-backed generated audio rows during list hydration", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/audio/gen-audio-storage-1/music.mp3",
          "https://signed.test/audio-fresh.mp3",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-audio-storage-1",
          request_id: "req-audio-storage-1",
          source_ref: "source-audio-storage-1",
          provider: "elevenlabs",
          model_id: "elevenlabs/music",
          display_prompt: "Sparse synth pulse",
          preview_url: "https://signed.test/audio-expired.mp3",
          result_urls: ["https://signed.test/audio-expired.mp3"],
          preview_storage_path: "user-1/generations/audio/gen-audio-storage-1/music.mp3",
          full_storage_path: "user-1/generations/audio/gen-audio-storage-1/music.mp3",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
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

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-audio-storage-1",
        mode: "audio",
        previewUrl: "https://signed.test/audio-fresh.mp3",
        resultUrls: ["https://signed.test/audio-fresh.mp3"],
      }),
    ]);
  });

  it("hydrates completed generated videos from canonical output media when publication is missing", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/videos/gen-video-canonical-1/poster_720.jpg",
          "https://signed.test/gen-video-canonical-1/poster_720.jpg",
        ],
      ])
    );
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-canonical-1",
          request_id: "req-video-canonical-1",
          source_ref: "source-video-canonical-1",
          provider: "fal",
          model_id: "fal-ai/veo3.1",
          display_prompt: "A canonical media video",
          preview_url: "https://fal.test/video-preview.mp4",
          result_urls: ["https://fal.test/video-full.mp4"],
          preview_storage_path:
            "user-1/variants/videos/gen-video-canonical-1/preview_loop_360p.mp4",
          full_storage_path: "user-1/generations/videos/gen-video-canonical-1.mp4",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {
            aspect: "16:9",
          },
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-video-canonical-1",
          media_file_id: "media-video-canonical-1",
          output_index: 0,
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-video-canonical-1",
          storage_path: "user-1/generations/videos/gen-video-canonical-1.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/gen-video-canonical-1/poster_720.jpg",
          preview_variant_path:
            "user-1/variants/videos/gen-video-canonical-1/preview_loop_360p.mp4",
          filename: "video.mp4",
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
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({ workspaceRuntimeKey: "session:test" })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-video-canonical-1",
        mode: "video",
        previewPosterUrl: "https://signed.test/gen-video-canonical-1/poster_720.jpg",
        previewPosterStoragePath: "user-1/variants/videos/gen-video-canonical-1/poster_720.jpg",
        previewStoragePath: "user-1/variants/videos/gen-video-canonical-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/gen-video-canonical-1.mp4",
      }),
    ]);
    expect(canonicalOutputBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-video-canonical-1",
    ]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/variants/videos/gen-video-canonical-1/poster_720.jpg"],
        surface: "reference-grid",
      })
    );
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
          preview_storage_path: "user-1/generations/images/gen-project-projection-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-projection-1/full.png",
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

  it("hydrates project-scoped generated images from canonical media when projection storage is missing", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/images/gen-project-image-canonical-1/output.png",
          "https://signed.test/gen-project-image-canonical-1/output.png",
        ],
      ])
    );
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-canonical-1",
          updated_at: "2026-04-18T16:20:00.000Z",
        },
      ],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-canonical-1",
          request_id: "req-project-image-canonical-1",
          source_ref: "source-project-image-canonical-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A project image with expired provider preview",
          preview_url: "https://fal.test/project-image-canonical-preview.png",
          result_urls: ["https://fal.test/project-image-canonical-full.png"],
          preview_storage_path: "user-1/generations/images/gen-started-latest/preview.png",
          full_storage_path: "user-1/generations/images/gen-started-latest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-canonical-1",
          media_file_id: "media-project-image-canonical-1",
          output_index: 0,
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-project-image-canonical-1",
          storage_path: "user-1/generations/images/gen-project-image-canonical-1/output.png",
          file_type: "image/png",
          poster_variant_path: null,
          preview_variant_path: null,
          filename: "output.png",
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
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(listVisibleGeneratedOutputs({ projectId: "project-1" })).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-project-image-canonical-1",
        generationId: "gen-project-image-canonical-1",
        previewUrl: "https://signed.test/gen-project-image-canonical-1/output.png",
        resultUrls: ["https://signed.test/gen-project-image-canonical-1/output.png"],
        previewStoragePath: "user-1/generations/images/gen-project-image-canonical-1/output.png",
        fullStoragePath: "user-1/generations/images/gen-project-image-canonical-1/output.png",
      }),
    ]);
    expect(canonicalOutputBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-image-canonical-1",
    ]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/generations/images/gen-project-image-canonical-1/output.png"],
        surface: "reference-grid",
      })
    );
  });

  it("scopes project generated-output hydration to runtime identities when provided", async () => {
    const requestLookupBuilder = createAwaitableSelectBuilder({
      data: [
        {
          request_id: "req-project-runtime-1",
          generation_id: "gen-project-runtime-1",
        },
      ],
      error: null,
    });
    const associationLookupBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-runtime-1",
        },
      ],
      error: null,
    });
    const associationProjectionLookupBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-runtime-1",
          project_id: "project-1",
        },
      ],
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-runtime-1",
          updated_at: "2026-04-18T16:20:00.000Z",
        },
      ],
      error: null,
    });
    const directProjectProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-runtime-1",
          project_id: "project-1",
          request_id: "req-project-runtime-1",
          source_ref: "source-project-runtime-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A runtime-scoped project output",
          preview_url: "https://fal.test/project-runtime-preview.png",
          result_urls: ["https://fal.test/project-runtime-full.png"],
          preview_storage_path: "user-1/generations/images/gen-project-runtime-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-runtime-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const associatedProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-runtime-1",
          project_id: "project-1",
          request_id: "req-project-runtime-1",
          source_ref: "source-project-runtime-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A runtime-scoped project output",
          preview_url: "https://fal.test/project-runtime-preview.png",
          result_urls: ["https://fal.test/project-runtime-full.png"],
          preview_storage_path: "user-1/generations/images/gen-project-runtime-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-runtime-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:13:00.000Z",
        },
      ],
      error: null,
    });

    const projectGenerationSelect = vi
      .fn()
      .mockImplementationOnce(() => associationLookupBuilder)
      .mockImplementationOnce(() => projectGenerationBuilder);
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => requestLookupBuilder)
      .mockImplementationOnce(() => associationProjectionLookupBuilder)
      .mockImplementationOnce(() => directProjectProjectionBuilder)
      .mockImplementationOnce(() => associatedProjectionBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: projectGenerationSelect,
          };
        }
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({
        projectId: "project-1",
        runtimeIdentities: [
          {
            requestId: "req-project-runtime-1",
            sourceRef: "source-project-runtime-1",
          },
        ],
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-project-runtime-1",
        generationId: "gen-project-runtime-1",
        taskId: "req-project-runtime-1",
        sourceRef: "source-project-runtime-1",
        previewUrl: "https://fal.test/project-runtime-preview.png",
        resultUrls: ["https://fal.test/project-runtime-full.png"],
      }),
    ]);

    expect(requestLookupBuilder.in).toHaveBeenCalledWith("request_id", ["req-project-runtime-1"]);
    expect(associationLookupBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-runtime-1",
    ]);
    expect(associationProjectionLookupBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-runtime-1",
    ]);
    expect(projectGenerationBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-runtime-1",
    ]);
    expect(directProjectProjectionBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-runtime-1",
    ]);
  });

  it("does not run user-global plain-session generated-output hydration without a workspace key", async () => {
    const from = vi.fn();
    ensureSupabaseQueryClientMock.mockReturnValue({ from });

    await expect(listVisibleGeneratedOutputs({ projectId: null })).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("hydrates plain-session generated outputs by workspace runtime key", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-session-1",
          workspace_runtime_key: "session:session-1",
          request_id: "req-session-1",
          source_ref: "source-session-1",
          provider: "kie",
          model_id: "kie-ai/gpt-image-2-text-to-image",
          display_prompt: "A session-scoped Kie output",
          preview_url: "https://kie.test/session-preview.png",
          result_urls: ["https://kie.test/session-full.png"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          workflow_reload: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-06-08T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({
        projectId: null,
        workspaceRuntimeKey: "session:session-1",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-session-1",
        generationId: "gen-session-1",
        taskId: "req-session-1",
        sourceRef: "source-session-1",
        previewUrl: "https://kie.test/session-preview.png",
        resultUrls: ["https://kie.test/session-full.png"],
      }),
    ]);
    expect(projectionBuilder.eq).toHaveBeenCalledWith("workspace_runtime_key", "session:session-1");
  });

  it("omits heavy workflow context columns for lightweight visible-output hydration", async () => {
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-session-lightweight-1",
          workspace_runtime_key: "session:session-1",
          request_id: "req-session-lightweight-1",
          source_ref: "source-session-lightweight-1",
          provider: "kie",
          model_id: "kie-ai/gpt-image-2-text-to-image",
          display_prompt: "A lightweight session output",
          preview_url: "https://kie.test/session-lightweight-preview.png",
          result_urls: ["https://kie.test/session-lightweight-full.png"],
          task_state: "running",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          updated_at: "2026-06-08T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionSelect = vi.fn(() => projectionBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: projectionSelect,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({
        projectId: null,
        workspaceRuntimeKey: "session:session-1",
        includeWorkflowContext: false,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-session-lightweight-1",
        generationId: "gen-session-lightweight-1",
        taskId: "req-session-lightweight-1",
        previewUrl: "https://kie.test/session-lightweight-preview.png",
        resultUrls: ["https://kie.test/session-lightweight-full.png"],
      }),
    ]);
    const projectionSelectCalls = projectionSelect.mock.calls as unknown as Array<[string]>;
    const projectionSelectColumns = projectionSelectCalls[0]?.[0] ?? "";
    expect(projectionSelectColumns).toContain("preview_url");
    expect(projectionSelectColumns).toContain("task_state");
    expect(projectionSelectColumns).not.toContain("generation_replay");
    expect(projectionSelectColumns).not.toContain("workflow_reload");
    expect(projectionSelectColumns).not.toContain("character_context");
    expect(projectionSelectColumns).not.toContain("style_context");
  });

  it("retries plain-session projection hydration without display_title when hosted schema is stale", async () => {
    const staleProjectionBuilder = createAwaitableSelectBuilder({
      data: null,
      error: {
        code: "42703",
        message: "column generation_projection.display_title does not exist",
      },
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-session-fallback-1",
          workspace_runtime_key: "session:session-1",
          request_id: "req-session-fallback-1",
          source_ref: "source-session-fallback-1",
          provider: "kie",
          model_id: "kie-ai/gpt-image-2-text-to-image",
          display_prompt: "A session-scoped fallback output",
          preview_url: "https://kie.test/session-fallback-preview.png",
          result_urls: ["https://kie.test/session-fallback-full.png"],
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          updated_at: "2026-06-08T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionSelect = vi.fn(() => staleProjectionBuilder);
    projectionSelect.mockImplementationOnce(() => staleProjectionBuilder);
    projectionSelect.mockImplementationOnce(() => projectionBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: projectionSelect,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      listVisibleGeneratedOutputs({
        projectId: null,
        workspaceRuntimeKey: "session:session-1",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-session-fallback-1",
        generationId: "gen-session-fallback-1",
        title: null,
      }),
    ]);
    const projectionSelectCalls = projectionSelect.mock.calls as unknown as Array<[string]>;
    expect(projectionSelectCalls[0]?.[0]).toContain("display_title");
    expect(projectionSelectCalls[1]?.[0]).not.toContain("display_title");
  });

  it("retries project projection hydration without display_title when hosted schema is stale", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const staleDirectProjectionBuilder = createAwaitableSelectBuilder({
      data: null,
      error: {
        code: "PGRST204",
        message:
          "Could not find the 'display_title' column of 'generation_projection' in the schema cache",
      },
    });
    const directProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-fallback-1",
          project_id: "project-1",
          request_id: "req-project-fallback-1",
          provider: "kie",
          model_id: "kie-ai/gpt-image-2-text-to-image",
          display_prompt: "A project fallback output",
          preview_url: "https://kie.test/project-fallback-preview.png",
          result_urls: ["https://kie.test/project-fallback-full.png"],
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          updated_at: "2026-06-08T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const generationProjectionSelect = vi.fn(() => staleDirectProjectionBuilder);
    generationProjectionSelect.mockImplementationOnce(() => staleDirectProjectionBuilder);
    generationProjectionSelect.mockImplementationOnce(() => directProjectionBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
          };
        }
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(listVisibleGeneratedOutputs({ projectId: "project-1" })).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-project-fallback-1",
        generationId: "gen-project-fallback-1",
        title: null,
      }),
    ]);
    const generationProjectionSelectCalls = generationProjectionSelect.mock
      .calls as unknown as Array<[string]>;
    expect(generationProjectionSelectCalls[0]?.[0]).toContain("display_title");
    expect(generationProjectionSelectCalls[1]?.[0]).not.toContain("display_title");
  });

  it("prefers canonical media authority for project-scoped generated images with stale projection storage", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/images/media-project-image-stale-1/thumb_512.jpg",
          "https://signed.test/media-project-image-stale-1/thumb_512.jpg",
        ],
        [
          "user-1/generations/images/gen-project-image-stale-1/output.png",
          "https://signed.test/gen-project-image-stale-1/output.png",
        ],
      ])
    );
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-stale-1",
          updated_at: "2026-04-18T16:20:00.000Z",
        },
      ],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-stale-1",
          request_id: "req-project-image-stale-1",
          source_ref: "source-project-image-stale-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A project image with stale projection media",
          preview_url: "https://fal.test/project-image-stale-preview.png",
          result_urls: ["https://fal.test/project-image-stale-full.png"],
          preview_storage_path: "user-1/stale/deleted-preview.png",
          full_storage_path: "user-1/stale/deleted-full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:10:00.000Z",
        },
      ],
      error: null,
    });
    const canonicalOutputBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-image-stale-1",
          media_file_id: "media-project-image-stale-1",
          output_index: 0,
          created_at: "2026-04-18T16:11:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-project-image-stale-1",
          preview_storage_path: "user-1/stale/deleted-preview.png",
          storage_path: "user-1/generations/images/gen-project-image-stale-1/output.png",
          thumb_variant_path: "user-1/variants/images/media-project-image-stale-1/thumb_512.jpg",
          file_type: "image/png",
          poster_variant_path: null,
          preview_variant_path: null,
          filename: "output.png",
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
        if (table === "ai_generation_outputs") {
          return {
            select: vi.fn(() => canonicalOutputBuilder),
          };
        }
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(listVisibleGeneratedOutputs({ projectId: "project-1" })).resolves.toEqual([
      expect.objectContaining({
        id: "generated:gen-project-image-stale-1",
        generationId: "gen-project-image-stale-1",
        previewUrl: "https://signed.test/media-project-image-stale-1/thumb_512.jpg",
        resultUrls: ["https://signed.test/gen-project-image-stale-1/output.png"],
        previewStoragePath: "user-1/variants/images/media-project-image-stale-1/thumb_512.jpg",
        fullStoragePath: "user-1/generations/images/gen-project-image-stale-1/output.png",
      }),
    ]);
  });

  it("orders project generated outputs by newest addition or generation start", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-added-latest",
          updated_at: "2026-04-18T16:20:00.000Z",
        },
        {
          generation_id: "gen-started-latest",
          updated_at: "2026-04-18T16:05:00.000Z",
        },
      ],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-started-latest",
          request_id: "req-started-latest",
          source_ref: "source-started-latest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Started latest",
          preview_url: "https://fal.test/started-latest.png",
          result_urls: ["https://fal.test/started-latest.png"],
          preview_storage_path: "user-1/generations/images/gen-added-latest/preview.png",
          full_storage_path: "user-1/generations/images/gen-added-latest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          started_at: "2026-04-18T16:15:00.000Z",
          created_at: "2026-04-18T16:15:00.000Z",
          updated_at: "2026-04-18T16:15:05.000Z",
        },
        {
          generation_id: "gen-added-latest",
          request_id: "req-added-latest",
          source_ref: "source-added-latest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Added latest",
          preview_url: "https://fal.test/added-latest.png",
          result_urls: ["https://fal.test/added-latest.png"],
          preview_storage_path: "user-1/generations/images/gen-project-projection-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-projection-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          started_at: "2026-04-18T15:00:00.000Z",
          created_at: "2026-04-18T15:00:00.000Z",
          updated_at: "2026-04-18T15:10:00.000Z",
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
      expect.objectContaining({ generationId: "gen-added-latest" }),
      expect.objectContaining({ generationId: "gen-started-latest" }),
    ]);
  });

  it("lists project-scoped projection outputs when association rows are missing", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-projection-1",
          project_id: "project-1",
          request_id: "req-project-projection-1",
          source_ref: "source-project-projection-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "A project output without association",
          preview_url: "https://fal.test/project-projection-preview.png",
          result_urls: ["https://fal.test/project-projection-full.png"],
          preview_storage_path: "user-1/generations/images/gen-project-projection-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-projection-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message_short: null,
          error_detail: null,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:13:00.000Z",
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
        id: "generated:gen-project-projection-1",
        generationId: "gen-project-projection-1",
        taskId: "req-project-projection-1",
        previewUrl: "https://fal.test/project-projection-preview.png",
        resultUrls: ["https://fal.test/project-projection-full.png"],
      }),
    ]);
    expect(projectionBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(projectionBuilder.in).not.toHaveBeenCalled();
  });

  it("restores failed project-scoped projection outputs as error references during active hydration", async () => {
    const scenario = getAiStudioErrorScenario("provider_upstream");
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-failed-1",
          project_id: "project-1",
          request_id: "req-project-failed-1",
          source_ref: "source-project-failed-1",
          provider: "elevenlabs",
          model_id: "eleven_v3",
          display_prompt: "A failed voiceover",
          preview_url: null,
          result_urls: [],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "fail",
          queue_state: "failed",
          error_message_short: scenario.output.errorMessageShort,
          error_detail: scenario.output.errorDetail,
          error_payload: scenario.output.errorPayload,
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          generation_replay: {},
          character_context: {},
          style_context: {},
          updated_at: "2026-04-18T16:14:00.000Z",
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
        id: "generated:gen-project-failed-1",
        generationId: "gen-project-failed-1",
        taskId: "req-project-failed-1",
        sourceRef: "source-project-failed-1",
        prompt: "A failed voiceover",
        taskState: "fail",
        timestamp: "Failed",
        errorMessage: scenario.output.errorMessageShort,
        errorMessageShort: scenario.output.errorMessageShort,
        errorDetail: scenario.output.errorDetail,
        errorPayload: scenario.output.errorPayload,
        resultUrls: [],
        previewUrl: undefined,
        hiddenInReferenceGrid: false,
      }),
    ]);
  });

  it("reconciles provider-url-only success rows during restore", async () => {
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/provider-only-reconcile-preview.png",
        result_urls: ["https://fal.test/provider-only-reconcile-full.png"],
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
        generationId: "gen-provider-only-reconcile",
      })
    ).resolves.toEqual({
      generationId: "gen-provider-only-reconcile",
      previewUrl: "https://fal.test/provider-only-reconcile-preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://fal.test/provider-only-reconcile-full.png"],
    });
  });

  it("requires project generation association before reconciling project-route outputs", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/project-preview.png",
        result_urls: ["https://fal.test/project-full.png"],
        preview_storage_path: "user-1/generations/images/gen-project-request-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-request-reconcile/full.png",
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
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-project-request-reconcile/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-request-reconcile/full.png",
      resultUrls: ["https://fal.test/project-full.png"],
    });
  });

  it("returns null for project-route reconcile when the generation is not associated to the project", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: null,
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
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
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectProjectionBuilder),
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

  it("reconciles project-route outputs from projection project scope when association is missing", async () => {
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-projection-reconcile",
          project_id: "project-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/project-projection-preview.png",
        result_urls: ["https://fal.test/project-projection-full.png"],
        preview_storage_path: "user-1/generations/images/gen-project-source-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-source-reconcile/full.png",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => projectProjectionBuilder)
      .mockImplementationOnce(() => projectionDeliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
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
        generationId: "gen-project-projection-reconcile",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      generationId: "gen-project-projection-reconcile",
      previewUrl: "https://fal.test/project-projection-preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-project-source-reconcile/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-source-reconcile/full.png",
      resultUrls: ["https://fal.test/project-projection-full.png"],
    });
  });

  it("reconciles project-route outputs from request identity when the explicit generation id is stale", async () => {
    const requestIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-request-reconcile",
          request_id: "req-project-request-reconcile",
        },
      ],
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-request-reconcile",
          project_id: "project-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/project-request-preview.png",
        result_urls: ["https://fal.test/project-request-full.png"],
        preview_storage_path: "user-1/generations/images/gen-project-request-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-request-reconcile/full.png",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => requestIdentityBuilder)
      .mockImplementationOnce(() => projectProjectionBuilder)
      .mockImplementationOnce(() => projectionDeliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
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
        generationId: "gen-stale-project",
        requestId: "req-project-request-reconcile",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      generationId: "gen-project-request-reconcile",
      previewUrl: "https://fal.test/project-request-preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-project-request-reconcile/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-request-reconcile/full.png",
      resultUrls: ["https://fal.test/project-request-full.png"],
    });
  });

  it("reconciles project-route outputs from source refs when request ids are unavailable", async () => {
    const sourceRefIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-source-reconcile",
          source_ref: "source-project-source-reconcile",
        },
      ],
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-source-reconcile",
          project_id: "project-1",
        },
      ],
      error: null,
    });
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/project-source-preview.png",
        result_urls: ["https://fal.test/project-source-full.png"],
        preview_storage_path: "user-1/generations/images/gen-project-source-reconcile/preview.png",
        full_storage_path: "user-1/generations/images/gen-project-source-reconcile/full.png",
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => sourceRefIdentityBuilder)
      .mockImplementationOnce(() => projectProjectionBuilder)
      .mockImplementationOnce(() => projectionDeliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
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
        generationId: "gen-stale-project",
        sourceRef: "source-project-source-reconcile",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      generationId: "gen-project-source-reconcile",
      previewUrl: "https://fal.test/project-source-preview.png",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
      companionArtUrl: null,
      companionArtStoragePath: null,
      companionArtStatus: null,
      previewStoragePath: "user-1/generations/images/gen-project-source-reconcile/preview.png",
      fullStoragePath: "user-1/generations/images/gen-project-source-reconcile/full.png",
      resultUrls: ["https://fal.test/project-source-full.png"],
    });
  });

  it("batches concurrent project-route reconcile identity lookups", async () => {
    const requestIdentityBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-batch-a",
          request_id: "req-project-batch-a",
        },
        {
          generation_id: "gen-project-batch-b",
          request_id: "req-project-batch-b",
        },
      ],
      error: null,
    });
    const projectGenerationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "gen-project-batch-a" }, { generation_id: "gen-project-batch-b" }],
      error: null,
    });
    const projectProjectionBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const deliveryBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-batch-a",
          preview_url: "https://fal.test/project-batch-a-preview.png",
          result_urls: ["https://fal.test/project-batch-a-full.png"],
          preview_storage_path: "user-1/generations/images/gen-project-batch-a/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-batch-a/full.png",
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-project-batch-b",
          preview_url: "https://fal.test/project-batch-b-preview.png",
          result_urls: ["https://fal.test/project-batch-b-full.png"],
          preview_storage_path: "user-1/generations/images/gen-project-batch-b/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-batch-b/full.png",
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    const generationProjectionSelect = vi
      .fn()
      .mockImplementationOnce(() => requestIdentityBuilder)
      .mockImplementationOnce(() => projectProjectionBuilder)
      .mockImplementationOnce(() => deliveryBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "project_generation_items") {
          return {
            select: vi.fn(() => projectGenerationBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      Promise.all([
        resolveVisibleGenerationReconcile({
          generationId: "gen-stale-project-a",
          requestId: "req-project-batch-a",
          projectId: "project-1",
        }),
        resolveVisibleGenerationReconcile({
          generationId: "gen-stale-project-b",
          requestId: "req-project-batch-b",
          projectId: "project-1",
        }),
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        generationId: "gen-project-batch-a",
        previewUrl: "https://fal.test/project-batch-a-preview.png",
      }),
      expect.objectContaining({
        generationId: "gen-project-batch-b",
        previewUrl: "https://fal.test/project-batch-b-preview.png",
      }),
    ]);
    expect(requestIdentityBuilder.in).toHaveBeenCalledWith("request_id", [
      "req-project-batch-a",
      "req-project-batch-b",
    ]);
    expect(projectGenerationBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-batch-a",
      "gen-stale-project-a",
      "gen-project-batch-b",
      "gen-stale-project-b",
    ]);
    expect(deliveryBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-project-batch-a",
      "gen-project-batch-b",
    ]);
    expect(generationProjectionSelect).toHaveBeenCalledTimes(3);
  });

  it("batches concurrent published delivery hydration for remote-only videos", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/generations/videos/gen-published-batch-a/full.mp4",
          "https://signed.test/published-batch-a-full.mp4",
        ],
        [
          "user-1/variants/videos/media-published-batch-a/poster_720.jpg",
          "https://signed.test/published-batch-a-poster.jpg",
        ],
        [
          "user-1/generations/videos/gen-published-batch-b/full.mp4",
          "https://signed.test/published-batch-b-full.mp4",
        ],
        [
          "user-1/variants/videos/media-published-batch-b/poster_720.jpg",
          "https://signed.test/published-batch-b-poster.jpg",
        ],
      ])
    );
    const projectionDeliveryBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-published-batch-a",
          preview_url: "https://fal.test/published-batch-a-preview.mp4",
          result_urls: ["https://fal.test/published-batch-a-full.mp4"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-published-batch-b",
          preview_url: "https://fal.test/published-batch-b-preview.mp4",
          result_urls: ["https://fal.test/published-batch-b-full.mp4"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-published-batch-a",
          owned_media_file_id: "media-published-batch-a",
          preview_url: null,
          full_url: null,
          preview_storage_path: "user-1/generations/videos/gen-published-batch-a/full.mp4",
          full_storage_path: "user-1/generations/videos/gen-published-batch-a/full.mp4",
          created_at: "2026-05-13T00:00:02.000Z",
        },
        {
          generation_id: "gen-published-batch-b",
          owned_media_file_id: "media-published-batch-b",
          preview_url: null,
          full_url: null,
          preview_storage_path: "user-1/generations/videos/gen-published-batch-b/full.mp4",
          full_storage_path: "user-1/generations/videos/gen-published-batch-b/full.mp4",
          created_at: "2026-05-13T00:00:01.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-published-batch-a",
          storage_path: "user-1/generations/videos/gen-published-batch-a/full.mp4",
          file_type: "video",
          filename: "published-batch-a.mp4",
          poster_variant_path: "user-1/variants/videos/media-published-batch-a/poster_720.jpg",
          preview_variant_path: null,
        },
        {
          id: "media-published-batch-b",
          storage_path: "user-1/generations/videos/gen-published-batch-b/full.mp4",
          file_type: "video",
          filename: "published-batch-b.mp4",
          poster_variant_path: "user-1/variants/videos/media-published-batch-b/poster_720.jpg",
          preview_variant_path: null,
        },
      ],
      error: null,
    });
    const generationProjectionSelect = vi.fn(() => projectionDeliveryBuilder);
    const generationPublicationsSelect = vi.fn(() => publicationBuilder);
    const mediaFilesSelect = vi.fn(() => mediaBuilder);

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: generationProjectionSelect,
          };
        }
        if (table === "generation_publications") {
          return {
            select: generationPublicationsSelect,
          };
        }
        if (table === "media_files") {
          return {
            select: mediaFilesSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      Promise.all([
        resolveVisibleGenerationDelivery({
          generationId: "gen-published-batch-a",
        }),
        resolveVisibleGenerationDelivery({
          generationId: "gen-published-batch-b",
        }),
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        previewUrl: "https://signed.test/published-batch-a-full.mp4",
        previewPosterUrl: "https://signed.test/published-batch-a-poster.jpg",
        previewStoragePath: "user-1/generations/videos/gen-published-batch-a/full.mp4",
        fullStoragePath: "user-1/generations/videos/gen-published-batch-a/full.mp4",
      }),
      expect.objectContaining({
        previewUrl: "https://signed.test/published-batch-b-full.mp4",
        previewPosterUrl: "https://signed.test/published-batch-b-poster.jpg",
        previewStoragePath: "user-1/generations/videos/gen-published-batch-b/full.mp4",
        fullStoragePath: "user-1/generations/videos/gen-published-batch-b/full.mp4",
      }),
    ]);
    expect(projectionDeliveryBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-published-batch-a",
      "gen-published-batch-b",
    ]);
    expect(publicationBuilder.in).toHaveBeenCalledWith("generation_id", [
      "gen-published-batch-a",
      "gen-published-batch-b",
    ]);
    expect(mediaBuilder.in).toHaveBeenCalledWith("id", [
      "media-published-batch-a",
      "media-published-batch-b",
    ]);
    expect(publicationBuilder.eq).not.toHaveBeenCalledWith("generation_id", expect.anything());
    expect(mediaBuilder.eq).not.toHaveBeenCalledWith("id", expect.anything());
    expect(generationPublicationsSelect).toHaveBeenCalledTimes(1);
    expect(mediaFilesSelect).toHaveBeenCalledTimes(1);
  });
});
