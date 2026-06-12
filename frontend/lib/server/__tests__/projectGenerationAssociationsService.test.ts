import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  associateGenerationAndMediaWithProjectForUserBestEffort,
  associateGenerationWithProjectForUserBestEffort,
  associateGenerationWithProjectForUser,
  associateMediaFilesWithProjectForUser,
  hydrateProjectSnapshotGeneratedOutputs,
} from "../projectGenerationAssociationsService";

const projectMaybeSingleMock = vi.fn();
let ownedMediaQueryResult: { data: unknown; error: unknown } = { data: [], error: null };
let ownedGenerationQueryResult: { data: unknown; error: unknown } = { data: [], error: null };
let ownedGenerationProjectionQueryResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
const ownedMediaSelectBuilder = {
  eq: vi.fn(),
  in: vi.fn(),
  then: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["then"]>) =>
    Promise.resolve(ownedMediaQueryResult).then(...args),
  catch: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["catch"]>) =>
    Promise.resolve(ownedMediaQueryResult).catch(...args),
  finally: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["finally"]>) =>
    Promise.resolve(ownedMediaQueryResult).finally(...args),
};
ownedMediaSelectBuilder.eq.mockReturnValue(ownedMediaSelectBuilder);
ownedMediaSelectBuilder.in.mockReturnValue(ownedMediaSelectBuilder);
const ownedGenerationSelectBuilder = {
  eq: vi.fn(),
  in: vi.fn(),
  then: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["then"]>) =>
    Promise.resolve(ownedGenerationQueryResult).then(...args),
  catch: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["catch"]>) =>
    Promise.resolve(ownedGenerationQueryResult).catch(...args),
  finally: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["finally"]>) =>
    Promise.resolve(ownedGenerationQueryResult).finally(...args),
};
ownedGenerationSelectBuilder.eq.mockReturnValue(ownedGenerationSelectBuilder);
ownedGenerationSelectBuilder.in.mockReturnValue(ownedGenerationSelectBuilder);
const ownedGenerationProjectionSelectBuilder = {
  eq: vi.fn(),
  in: vi.fn(),
  then: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["then"]>) =>
    Promise.resolve(ownedGenerationProjectionQueryResult).then(...args),
  catch: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["catch"]>) =>
    Promise.resolve(ownedGenerationProjectionQueryResult).catch(...args),
  finally: (...args: Parameters<Promise<{ data: unknown; error: unknown }>["finally"]>) =>
    Promise.resolve(ownedGenerationProjectionQueryResult).finally(...args),
};
ownedGenerationProjectionSelectBuilder.eq.mockReturnValue(ownedGenerationProjectionSelectBuilder);
ownedGenerationProjectionSelectBuilder.in.mockReturnValue(ownedGenerationProjectionSelectBuilder);
const mediaOwnershipSelectMock = vi.fn<(columns: string) => typeof ownedMediaSelectBuilder>(
  () => ownedMediaSelectBuilder
);
const generationOwnershipSelectMock = vi.fn<
  (columns: string) => typeof ownedGenerationSelectBuilder
>(() => ownedGenerationSelectBuilder);
const associationUpsertMock = vi.fn();
const mediaAssociationUpsertMock = vi.fn();
const projectGenerationItemsSelectMock = vi.fn<(columns: string) => unknown>();
const generationProjectionSelectMock = vi.fn<(columns: string) => unknown>();
const generationPublicationsSelectMock = vi.fn();

const createAwaitableSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown; error: unknown }>["then"];
    catch: Promise<{ data: unknown; error: unknown }>["catch"];
    finally: Promise<{ data: unknown; error: unknown }>["finally"];
  } = {
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
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

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: projectMaybeSingleMock,
              })),
            })),
          })),
        };
      }
      if (table === "project_generation_items") {
        return {
          select: projectGenerationItemsSelectMock,
          upsert: associationUpsertMock,
        };
      }
      if (table === "project_media_items") {
        return {
          upsert: mediaAssociationUpsertMock,
        };
      }
      if (table === "media_files") {
        return {
          select: mediaOwnershipSelectMock,
        };
      }
      if (table === "ai_generations") {
        return {
          select: generationOwnershipSelectMock,
        };
      }
      if (table === "generation_projection") {
        return {
          select: generationProjectionSelectMock,
        };
      }
      if (table === "generation_publications") {
        return {
          select: generationPublicationsSelectMock,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

describe("associateGenerationWithProjectForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownedMediaQueryResult = { data: [], error: null };
    ownedGenerationQueryResult = { data: [], error: null };
    ownedGenerationProjectionQueryResult = { data: [], error: null };
    ownedMediaSelectBuilder.eq.mockReturnValue(ownedMediaSelectBuilder);
    ownedMediaSelectBuilder.in.mockReturnValue(ownedMediaSelectBuilder);
    ownedGenerationSelectBuilder.eq.mockReturnValue(ownedGenerationSelectBuilder);
    ownedGenerationSelectBuilder.in.mockReturnValue(ownedGenerationSelectBuilder);
    generationOwnershipSelectMock.mockImplementation(() => ownedGenerationSelectBuilder);
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id") {
        return ownedGenerationProjectionSelectBuilder;
      }
      return createAwaitableSelectBuilder({ data: [], error: null });
    });
    generationPublicationsSelectMock.mockReturnValue(
      createAwaitableSelectBuilder({
        data: [],
        error: null,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("upserts a project association when the project belongs to the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedGenerationQueryResult = {
      data: [{ id: "gen-1" }],
      error: null,
    };
    associationUpsertMock.mockResolvedValue({ error: null });

    const associated = await associateGenerationWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      generationId: "gen-1",
    });

    expect(associated).toBe(true);
    expect(associationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        generation_id: "gen-1",
        user_id: "user-1",
      }),
      {
        onConflict: "project_id,generation_id",
      }
    );
  });

  it("accepts projection-backed ownership when associating a generation to a project", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedGenerationQueryResult = {
      data: [],
      error: null,
    };
    ownedGenerationProjectionQueryResult = {
      data: [{ generation_id: "gen-projection-1" }],
      error: null,
    };
    associationUpsertMock.mockResolvedValue({ error: null });

    const associated = await associateGenerationWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      generationId: "gen-projection-1",
    });

    expect(associated).toBe(true);
    expect(associationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        generation_id: "gen-projection-1",
        user_id: "user-1",
      }),
      {
        onConflict: "project_id,generation_id",
      }
    );
  });

  it("upserts project media membership when the project belongs to the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedMediaQueryResult = {
      data: [{ id: "media-1" }, { id: "media-2" }],
      error: null,
    };
    mediaAssociationUpsertMock.mockResolvedValue({ error: null });

    const associated = await associateMediaFilesWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: ["media-1", "media-2", "media-1"],
    });

    expect(associated).toBe(true);
    expect(mediaAssociationUpsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-1",
          user_id: "user-1",
        }),
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-2",
          user_id: "user-1",
        }),
      ],
      {
        onConflict: "project_id,media_file_id",
      }
    );
  });

  it("batches owned media validation when associating many media files to a project", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    const largeMediaIds = Array.from({ length: 205 }, (_, index) => `media-${index + 1}`);
    ownedMediaSelectBuilder.in.mockImplementation((_column: string, ids: string[]) => {
      ownedMediaQueryResult = {
        data: ids.map((id) => ({ id })),
        error: null,
      };
      return ownedMediaSelectBuilder;
    });
    mediaAssociationUpsertMock.mockResolvedValue({ error: null });

    const associated = await associateMediaFilesWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: largeMediaIds,
    });

    expect(associated).toBe(true);
    expect(ownedMediaSelectBuilder.in).toHaveBeenCalledTimes(3);
    expect(ownedMediaSelectBuilder.in.mock.calls.map(([, ids]) => ids.length)).toEqual([
      100, 100, 5,
    ]);
    expect(mediaAssociationUpsertMock).toHaveBeenCalledWith(
      largeMediaIds.map((mediaFileId) =>
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: mediaFileId,
          user_id: "user-1",
        })
      ),
      {
        onConflict: "project_id,media_file_id",
      }
    );
  });

  it("skips media association for ids not owned by the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedMediaQueryResult = {
      data: [],
      error: null,
    };

    const associated = await associateMediaFilesWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: ["foreign-media-1"],
    });

    expect(associated).toBe(false);
    expect(mediaAssociationUpsertMock).not.toHaveBeenCalled();
  });

  it("skips generation association for ids not owned by the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedGenerationQueryResult = {
      data: [],
      error: null,
    };

    const associated = await associateGenerationWithProjectForUser({
      userId: "user-1",
      projectId: "project-1",
      generationId: "foreign-generation-1",
    });

    expect(associated).toBe(false);
    expect(associationUpsertMock).not.toHaveBeenCalled();
  });

  it("skips the association when the project is not owned by the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const associated = await associateGenerationWithProjectForUser({
      userId: "user-1",
      projectId: "project-missing",
      generationId: "gen-1",
    });

    expect(associated).toBe(false);
    expect(associationUpsertMock).not.toHaveBeenCalled();
  });

  it("swallows eager generation association failures through the best-effort helper", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedGenerationQueryResult = {
      data: [{ id: "gen-1" }],
      error: null,
    };
    associationUpsertMock.mockRejectedValue(new Error("association failed"));
    const onError = vi.fn();

    const associated = await associateGenerationWithProjectForUserBestEffort({
      userId: "user-1",
      projectId: "project-1",
      generationId: "gen-1",
      onError,
    });

    expect(associated).toBe(false);
    expect(onError).toHaveBeenCalledWith({
      projectId: "project-1",
      error: expect.any(Error),
    });
  });

  it("swallows eager generation+media association failures through the best-effort helper", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    ownedGenerationQueryResult = {
      data: [{ id: "gen-1" }],
      error: null,
    };
    ownedMediaQueryResult = {
      data: [{ id: "media-1" }],
      error: null,
    };
    associationUpsertMock.mockResolvedValue({ error: null });
    mediaAssociationUpsertMock.mockRejectedValue(new Error("media association failed"));
    const onError = vi.fn();

    const associated = await associateGenerationAndMediaWithProjectForUserBestEffort({
      userId: "user-1",
      projectId: "project-1",
      generationId: "gen-1",
      mediaFileIds: ["media-1"],
      onError,
    });

    expect(associated).toBe(false);
    expect(onError).toHaveBeenCalledWith({
      projectId: "project-1",
      error: expect.any(Error),
    });
  });

  it("hydrates snapshot outputs from project-scoped projections when association rows are missing", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-projection-1",
          updated_at: "2026-04-18T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
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
          saved_media_ids: ["media-1"],
          save_state: "saved",
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message: null,
          error_message_short: null,
          error_detail: null,
          generation_replay: {},
          character_context: {},
          style_context: {},
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockReturnValue(associationBuilder);
    generationProjectionSelectMock
      .mockImplementationOnce(() => recentProjectionBuilder)
      .mockImplementationOnce(() => projectionDetailsBuilder);

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated:gen-project-projection-1",
              generationId: "gen-project-projection-1",
              taskId: "req-project-projection-1",
              previewUrl: "https://fal.test/project-projection-preview.png",
              resultUrls: ["https://fal.test/project-projection-full.png"],
              savedMediaIds: ["media-1"],
              saveState: "saved",
              status: "saved",
            }),
          ],
        }),
      })
    );
    expect(recentProjectionBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
  });

  it("patches restored rows without generation ids from project-scoped request and source identities", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-projection-restore-1",
          updated_at: "2026-04-18T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-project-projection-restore-1",
          project_id: "project-1",
          request_id: "req-project-projection-restore-1",
          source_ref: "source-project-projection-restore-1",
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          display_prompt: "A restored project output",
          preview_url: "https://fal.test/project-restore-preview.png",
          result_urls: ["https://fal.test/project-restore-full.png"],
          saved_media_ids: [],
          save_state: "idle",
          preview_storage_path:
            "user-1/generations/images/gen-project-projection-restore-1/preview.png",
          full_storage_path: "user-1/generations/images/gen-project-projection-restore-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          error_message: null,
          error_message_short: null,
          error_detail: null,
          generation_replay: {},
          character_context: {},
          style_context: {},
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockReturnValue(associationBuilder);
    generationProjectionSelectMock
      .mockImplementationOnce(() => recentProjectionBuilder)
      .mockImplementationOnce(() => projectionDetailsBuilder);

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "out-restored-pending",
              mediaSource: "generated",
              taskId: "req-project-projection-restore-1",
              sourceRef: "source-project-projection-restore-1",
              taskState: "running",
              status: "ready",
              timestamp: "Processing...",
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "out-restored-pending",
              generationId: "gen-project-projection-restore-1",
              taskId: "req-project-projection-restore-1",
              sourceRef: "source-project-projection-restore-1",
              previewUrl: "https://fal.test/project-restore-preview.png",
              resultUrls: ["https://fal.test/project-restore-full.png"],
              taskState: "success",
            }),
          ],
        }),
      })
    );
  });

  it("does not restore provider-url-only success projections without durable media authority", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-provider-only-restore-1",
          updated_at: "2026-04-18T16:13:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-provider-only-restore-1",
          project_id: "project-1",
          request_id: "req-provider-only-restore-1",
          source_ref: "source-provider-only-restore-1",
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          display_prompt: "A provider-only restored project output",
          preview_url: "https://fal.test/provider-only-restore-preview.png",
          result_urls: ["https://fal.test/provider-only-restore-full.png"],
          saved_media_ids: [],
          save_state: "idle",
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          error_message: null,
          error_message_short: null,
          error_detail: null,
          generation_replay: {},
          character_context: {},
          style_context: {},
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockReturnValue(associationBuilder);
    generationProjectionSelectMock
      .mockImplementationOnce(() => recentProjectionBuilder)
      .mockImplementationOnce(() => projectionDetailsBuilder);

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [],
          archived: [],
        },
      },
    });

    expect(snapshot.outputs).toMatchObject({
      active: [],
    });
  });

  it("orders restored project generated outputs by newest project generation recency", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [
        { generation_id: "gen-oldest" },
        { generation_id: "gen-newest" },
        { generation_id: "gen-middle" },
      ],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        { generation_id: "gen-newest", updated_at: "2026-04-18T16:13:00.000Z" },
        { generation_id: "gen-middle", updated_at: "2026-04-18T16:12:00.000Z" },
        { generation_id: "gen-oldest", updated_at: "2026-04-18T16:11:00.000Z" },
      ],
      error: null,
    });
    const associationProjectionBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-newest",
          started_at: "2026-04-18T16:13:00.000Z",
          created_at: "2026-04-18T16:13:00.000Z",
          updated_at: "2026-04-18T16:13:05.000Z",
        },
        {
          generation_id: "gen-middle",
          started_at: "2026-04-18T16:12:00.000Z",
          created_at: "2026-04-18T16:12:00.000Z",
          updated_at: "2026-04-18T16:12:05.000Z",
        },
        {
          generation_id: "gen-oldest",
          started_at: "2026-04-18T16:11:00.000Z",
          created_at: "2026-04-18T16:11:00.000Z",
          updated_at: "2026-04-18T16:11:05.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-newest",
          updated_at: "2026-04-18T16:13:00.000Z",
          request_id: "req-newest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Newest",
          preview_url: "https://fal.test/newest.png",
          result_urls: ["https://fal.test/newest.png"],
          preview_storage_path: "user-1/generations/images/gen-newest/preview.png",
          full_storage_path: "user-1/generations/images/gen-newest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-middle",
          updated_at: "2026-04-18T16:12:00.000Z",
          request_id: "req-middle",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Middle",
          preview_url: "https://fal.test/middle.png",
          result_urls: ["https://fal.test/middle.png"],
          preview_storage_path: "user-1/generations/images/gen-middle/preview.png",
          full_storage_path: "user-1/generations/images/gen-middle/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-oldest",
          updated_at: "2026-04-18T16:11:00.000Z",
          request_id: "req-oldest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Oldest",
          preview_url: "https://fal.test/oldest.png",
          result_urls: ["https://fal.test/oldest.png"],
          preview_storage_path: "user-1/generations/images/gen-oldest/preview.png",
          full_storage_path: "user-1/generations/images/gen-oldest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id") return associationProjectionBuilder;
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "local-oldest",
              generationId: "gen-oldest",
              prompt: "Oldest local",
              createdAt: "2026-04-18T16:11:00.000Z",
              resultUrls: ["https://fal.test/oldest-stale.png"],
            },
            {
              id: "local-newest",
              generationId: "gen-newest",
              prompt: "Newest local",
              createdAt: "2026-04-18T16:13:00.000Z",
              resultUrls: ["https://fal.test/newest-stale.png"],
            },
            {
              id: "local-middle",
              generationId: "gen-middle",
              prompt: "Middle local",
              createdAt: "2026-04-18T16:12:00.000Z",
              resultUrls: ["https://fal.test/middle-stale.png"],
            },
            {
              id: "local-upload",
              prompt: "Upload",
              createdAt: "2026-04-18T16:10:00.000Z",
            },
          ],
          archived: [],
        },
      },
    });

    const outputs = snapshot.outputs as { active: Array<{ id: string }> };
    expect(outputs.active.map((row) => row.id)).toEqual([
      "local-newest",
      "local-middle",
      "local-oldest",
      "local-upload",
    ]);
  });

  it("preserves settled non-generated refs while refreshing generated outputs", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          updated_at: "2026-04-18T16:13:00.000Z",
          request_id: "req-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated",
          transcript_text: "The skyline glows through a morning haze.",
          preview_url: "https://fal.test/generated.png",
          result_urls: ["https://fal.test/generated.png"],
          preview_storage_path: "user-1/generations/images/generation-1/preview.png",
          full_storage_path: "user-1/generations/images/generation-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              previewUrl: "https://expired.example/generated.png",
              resultUrls: ["https://expired.example/generated.png"],
            },
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example/library.png",
              resultUrls: ["https://cdn.example/library.png"],
              savedMediaIds: ["media-1"],
              saveState: "saved",
              status: "saved",
            },
            {
              id: "upload-1",
              mediaSource: "upload",
              previewUrl: "https://cdn.example/upload.png",
              resultUrls: ["https://cdn.example/upload.png"],
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated-1",
              previewUrl: "https://fal.test/generated.png",
              transcriptText: "The skyline glows through a morning haze.",
            }),
            expect.objectContaining({
              id: "library-1",
              mediaSource: "library",
              savedMediaIds: ["media-1"],
              saveState: "saved",
            }),
            expect.objectContaining({
              id: "upload-1",
              mediaSource: "upload",
              previewUrl: "https://cdn.example/upload.png",
            }),
          ],
        }),
      })
    );
  });

  it("preserves snapshot generated outputs when project association repair has not completed yet", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-repair-pending",
              generationId: "generation-repair-pending",
              savedMediaIds: ["media-1"],
              previewStoragePath: "user-1/generated/repair-pending.png",
              fullStoragePath: "user-1/generated/repair-pending.png",
              saveState: "saved",
              status: "saved",
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: "generated-repair-pending",
          generationId: "generation-repair-pending",
          savedMediaIds: ["media-1"],
          previewStoragePath: "user-1/generated/repair-pending.png",
          fullStoragePath: "user-1/generated/repair-pending.png",
          saveState: "saved",
          status: "saved",
        }),
      ],
    });
  });

  it("preserves existing mixed legacy ordering until every restored row has a durable createdAt", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "gen-newer" }, { generation_id: "gen-older" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        { generation_id: "gen-newer", updated_at: "2026-04-18T16:30:00.000Z" },
        { generation_id: "gen-older", updated_at: "2026-04-18T16:20:00.000Z" },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-newer",
          started_at: "2026-04-18T16:30:00.000Z",
          created_at: "2026-04-18T16:30:00.000Z",
          updated_at: "2026-04-18T16:30:05.000Z",
        },
        {
          generation_id: "gen-older",
          started_at: "2026-04-18T16:20:00.000Z",
          created_at: "2026-04-18T16:20:00.000Z",
          updated_at: "2026-04-18T16:20:05.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-newer",
          updated_at: "2026-04-18T16:30:00.000Z",
          request_id: "req-newer",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Newer generated",
          preview_url: "https://fal.test/newer.png",
          result_urls: ["https://fal.test/newer.png"],
          preview_storage_path: "user-1/generations/images/gen-newer/preview.png",
          full_storage_path: "user-1/generations/images/gen-newer/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-older",
          updated_at: "2026-04-18T16:20:00.000Z",
          request_id: "req-older",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Older generated",
          preview_url: "https://fal.test/older.png",
          result_urls: ["https://fal.test/older.png"],
          preview_storage_path: "user-1/generations/images/gen-older/preview.png",
          full_storage_path: "user-1/generations/images/gen-older/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "legacy-upload",
              prompt: "Upload",
            },
            {
              id: "local-older",
              generationId: "gen-older",
              prompt: "Older local",
            },
            {
              id: "local-newer",
              generationId: "gen-newer",
              prompt: "Newer local",
            },
          ],
          archived: [],
        },
      },
    });

    const outputs = snapshot.outputs as {
      active: Array<{ id: string; createdAt?: string | null }>;
    };
    expect(outputs.active.map((row) => row.id)).toEqual([
      "legacy-upload",
      "local-older",
      "local-newer",
    ]);
    expect(outputs.active[1]?.createdAt).toBe("2026-04-18T16:20:00.000Z");
    expect(outputs.active[2]?.createdAt).toBe("2026-04-18T16:30:00.000Z");
  });

  it("preserves the last recoverable snapshot payload when a project generation projection row is missing", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          started_at: "2026-04-18T16:30:00.000Z",
          created_at: "2026-04-18T16:30:00.000Z",
          updated_at: "2026-04-18T16:30:05.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              previewUrl: "https://cdn.example.com/generated.png",
              resultUrls: ["https://cdn.example.com/generated.png"],
              savedMediaIds: ["media-1"],
              previewStoragePath: "user-1/generated/generated.png",
              fullStoragePath: "user-1/generated/generated.png",
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: "generated-1",
          generationId: "generation-1",
          previewUrl: "https://cdn.example.com/generated.png",
          resultUrls: ["https://cdn.example.com/generated.png"],
          savedMediaIds: ["media-1"],
          previewStoragePath: "user-1/generated/generated.png",
          fullStoragePath: "user-1/generated/generated.png",
        }),
      ],
    });
  });

  it("appends newly associated generated rows after legacy rows when mixed restore cannot sort yet", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "gen-appended" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "gen-appended", updated_at: "2026-04-18T16:35:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-appended",
          started_at: "2026-04-18T16:35:00.000Z",
          created_at: "2026-04-18T16:35:00.000Z",
          updated_at: "2026-04-18T16:35:05.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-appended",
          updated_at: "2026-04-18T16:35:00.000Z",
          request_id: "req-appended",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Appended generated",
          preview_url: "https://fal.test/appended.png",
          result_urls: ["https://fal.test/appended.png"],
          preview_storage_path: "user-1/generations/images/gen-appended/preview.png",
          full_storage_path: "user-1/generations/images/gen-appended/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "legacy-upload",
              prompt: "Upload",
            },
            {
              id: "legacy-library",
              prompt: "Library",
              timestamp: "Library",
            },
          ],
          archived: [],
        },
      },
    });

    const outputs = snapshot.outputs as {
      active: Array<{ id: string; createdAt?: string | null }>;
    };
    expect(outputs.active.map((row) => row.id)).toEqual([
      "legacy-upload",
      "legacy-library",
      "generated:gen-appended",
    ]);
    expect(outputs.active[2]?.createdAt).toBe("2026-04-18T16:35:00.000Z");
  });

  it("replaces fallback generated createdAt with projection time during restore", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          started_at: "2026-04-18T16:30:00.000Z",
          created_at: "2026-04-18T16:30:00.000Z",
          updated_at: "2026-04-18T16:30:05.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          updated_at: "2026-04-18T16:30:00.000Z",
          request_id: "req-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated",
          preview_url: "https://fal.test/generated.png",
          result_urls: ["https://fal.test/generated.png"],
          preview_storage_path: "user-1/generations/images/generation-1/preview.png",
          full_storage_path: "user-1/generations/images/generation-1/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              prompt: "Generated",
              createdAt: "2026-04-18T15:00:00.000Z",
              previewUrl: "https://expired.example/generated.png",
              resultUrls: ["https://expired.example/generated.png"],
            },
          ],
          archived: [],
        },
      },
    });

    const outputs = snapshot.outputs as {
      active: Array<{ id: string; createdAt?: string | null }>;
    };
    expect(outputs.active[0]).toEqual(
      expect.objectContaining({
        id: "generated-1",
        createdAt: "2026-04-18T16:30:00.000Z",
      })
    );
  });

  it("restores generated outputs with saved media semantics from projection rows", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          updated_at: "2026-04-18T16:13:00.000Z",
          request_id: "req-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated",
          preview_url: "https://fal.test/generated.png",
          result_urls: ["https://fal.test/generated.png"],
          saved_media_ids: ["media-1"],
          save_state: "saved",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              saveState: "idle",
              status: "ready",
              savedMediaIds: [],
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated-1",
              generationId: "generation-1",
              savedMediaIds: ["media-1"],
              saveState: "saved",
              status: "saved",
            }),
          ],
        }),
      })
    );
  });

  it("hydrates metadata for durable generated rows without overwriting media delivery", async () => {
    const generationReplay = {
      version: 2,
      mode: "image",
      submitTool: "create",
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      displayPrompt: "Projection prompt restored for detail modal",
      submissionPrompt: "Projection prompt restored for detail modal",
      aspect: "16:9",
      imageResolution: "2K",
      referenceInputs: [],
      internalMediaRefs: [],
      capturedAt: "2026-04-18T16:13:00.000Z",
    };
    const workflowReload = {
      version: 1,
      source: "ai_studio_generation",
      restoreBehavior: "navigate_and_hydrate",
      originTool: "edit",
      panelKind: "edit",
      payload: {
        kind: "image",
        submitTool: "edit",
        referenceInputs: [
          "https://example.com/primary.png",
          "https://example.com/markup.png",
          "https://example.com/ref-10.png",
        ],
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [{ slotIndex: 9, referenceInputIndex: 2 }],
          restoreSecondarySlots: [
            { slotIndex: 0, sourceUrl: "https://example.com/ref-1.png" },
            { slotIndex: 9, sourceUrl: "https://example.com/ref-10.png" },
          ],
        },
      },
    };
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-1", updated_at: "2026-04-18T16:30:00.000Z" }],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-1",
          updated_at: "2026-04-18T16:13:00.000Z",
          request_id: "req-1",
          source_ref: "source-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: generationReplay.displayPrompt,
          preview_url: "https://fal.test/generated.png",
          result_urls: ["https://fal.test/generated.png"],
          saved_media_ids: ["projection-media-1"],
          save_state: "saved",
          preview_storage_path: "user-1/generations/images/generation-1/projection-preview.png",
          full_storage_path: "user-1/generations/images/generation-1/projection-full.png",
          task_state: "success",
          queue_state: "dispatched",
          generation_replay: generationReplay,
          workflow_reload: workflowReload,
          character_context: { applied: true, characterId: "character-1" },
          style_context: { applied: true, styleId: "style-1" },
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              prompt: "",
              saveState: "idle",
              status: "ready",
              savedMediaIds: ["existing-media-1"],
              previewUrl: "https://existing.example/generated-preview.png",
              resultUrls: ["https://existing.example/generated-full.png"],
              previewStoragePath: "user-1/generations/images/generation-1/existing-preview.png",
              fullStoragePath: "user-1/generations/images/generation-1/existing-full.png",
            },
          ],
          archived: [],
        },
      },
      options: {
        patchDurableSnapshotRows: false,
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated-1",
              generationId: "generation-1",
              taskId: "req-1",
              sourceRef: "source-1",
              provider: "fal",
              modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
              prompt: generationReplay.displayPrompt,
              aspect: "16:9",
              generationReplay,
              workflowReload,
              characterContext: { applied: true, characterId: "character-1" },
              styleContext: { applied: true, styleId: "style-1" },
              saveState: "idle",
              savedMediaIds: ["existing-media-1"],
              previewUrl: "https://existing.example/generated-preview.png",
              resultUrls: ["https://existing.example/generated-full.png"],
              previewStoragePath: "user-1/generations/images/generation-1/existing-preview.png",
              fullStoragePath: "user-1/generations/images/generation-1/existing-full.png",
            }),
          ],
        }),
      })
    );
  });

  it("hydrates project-route generated image delivery from published media rows", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-image-published-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-published-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-published-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-published-1",
          request_id: "req-image-published-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated image with durable media",
          preview_url: "https://fal.test/generated-image-published.png",
          result_urls: ["https://fal.test/generated-image-published.png"],
          saved_media_ids: [],
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          preview_storage_path: null,
          full_storage_path: null,
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-published-1",
          owned_media_file_id: "media-image-published-1",
          preview_storage_path: null,
          full_storage_path: null,
          created_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-image-published-1",
          storage_path: "user-1/generations/images/media-image-published-1.png",
          preview_storage_path: null,
          file_type: "image/png",
          poster_variant_path: null,
          thumb_variant_path: "user-1/variants/images/media-image-published-1/thumb_720.webp",
          preview_variant_path: null,
        },
      ],
      error: null,
    });

    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });
    generationPublicationsSelectMock.mockReturnValue(publicationBuilder);
    mediaOwnershipSelectMock.mockImplementation((columns: string) => {
      if (
        columns ===
        "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
      ) {
        return mediaBuilder as typeof ownedMediaSelectBuilder;
      }
      throw new Error(`Unexpected media_files fields: ${columns}`);
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-image-published-1",
              generationId: "generation-image-published-1",
              previewUrl: "https://expired.example/generated-image-published.png",
              resultUrls: ["https://expired.example/generated-image-published.png"],
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated-image-published-1",
              previewStoragePath: "user-1/variants/images/media-image-published-1/thumb_720.webp",
              fullStoragePath: "user-1/generations/images/media-image-published-1.png",
            }),
          ],
        }),
      })
    );
  });

  it("drops foreign-scoped media delivery paths during project snapshot hydration", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-image-foreign-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-foreign-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-foreign-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-foreign-1",
          request_id: "req-image-foreign-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated image with contaminated media path",
          preview_url: "https://fal.test/generated-image-foreign.png",
          result_urls: ["https://fal.test/generated-image-foreign.png"],
          saved_media_ids: [],
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          preview_storage_path: null,
          full_storage_path: null,
        },
      ],
      error: null,
    });
    const publicationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-foreign-1",
          owned_media_file_id: "media-image-foreign-1",
          preview_storage_path: null,
          full_storage_path: null,
          created_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-image-foreign-1",
          storage_path: "user-2/generations/images/media-image-foreign-1.png",
          file_type: "image/png",
          poster_variant_path: null,
          thumb_variant_path: "user-2/variants/images/media-image-foreign-1/thumb_720.webp",
          preview_variant_path: null,
        },
      ],
      error: null,
    });

    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });
    generationPublicationsSelectMock.mockReturnValue(publicationBuilder);
    mediaOwnershipSelectMock.mockImplementation((columns: string) => {
      if (
        columns ===
        "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
      ) {
        return mediaBuilder as typeof ownedMediaSelectBuilder;
      }
      throw new Error(`Unexpected media_files fields: ${columns}`);
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-image-foreign-1",
              generationId: "generation-image-foreign-1",
              previewUrl: "https://expired.example/generated-image-foreign.png",
              resultUrls: ["https://expired.example/generated-image-foreign.png"],
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [],
        }),
      })
    );
  });

  it("strips foreign trusted direct preview urls while retaining owned project media delivery", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-image-signed-foreign-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-signed-foreign-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-signed-foreign-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const foreignTrustedPreviewUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/private/images/foreign.png?token=test-token";
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-image-signed-foreign-1",
          request_id: "req-image-signed-foreign-1",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Generated image with contaminated signed preview url",
          preview_url: foreignTrustedPreviewUrl,
          result_urls: [foreignTrustedPreviewUrl],
          saved_media_ids: [],
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          preview_storage_path:
            "user-1/variants/images/media-image-signed-foreign-1/thumb_720.webp",
          full_storage_path: "user-1/generations/images/media-image-signed-foreign-1.png",
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            {
              id: "generated-image-signed-foreign-1",
              generationId: "generation-image-signed-foreign-1",
              previewUrl: foreignTrustedPreviewUrl,
              resultUrls: [foreignTrustedPreviewUrl],
            },
          ],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated-image-signed-foreign-1",
              generationId: "generation-image-signed-foreign-1",
              previewStoragePath:
                "user-1/variants/images/media-image-signed-foreign-1/thumb_720.webp",
              fullStoragePath: "user-1/generations/images/media-image-signed-foreign-1.png",
              previewUrl: null,
              resultUrls: [],
            }),
          ],
        }),
      })
    );
  });

  it("hydrates project snapshots from canonical media_files variant columns", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "generation-video-fallback-1" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-video-fallback-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-video-fallback-1",
          updated_at: "2026-04-18T16:30:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "generation-video-fallback-1",
          request_id: "req-video-fallback-1",
          provider: "kie",
          model_id: "kie-ai/seedance-2-fast",
          display_prompt: "Generated video fallback",
          preview_url: "https://fal.test/generated-video-fallback.mp4",
          result_urls: ["https://fal.test/generated-video-fallback.mp4"],
          saved_media_ids: ["media-video-fallback-1"],
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
          preview_storage_path: null,
          full_storage_path: null,
        },
      ],
      error: null,
    });
    const mediaBuilder = createAwaitableSelectBuilder({
      data: [
        {
          id: "media-video-fallback-1",
          storage_path: "user-1/generations/videos/media-video-fallback-1.mp4",
          file_type: "video",
          poster_variant_path: "user-1/variants/videos/media-video-fallback-1/poster_720.jpg",
          thumb_variant_path: null,
          preview_variant_path:
            "user-1/variants/videos/media-video-fallback-1/preview_loop_360p.mp4",
        },
      ],
      error: null,
    });
    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });
    mediaOwnershipSelectMock.mockImplementation((columns: string) => {
      if (
        columns ===
        "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
      ) {
        return mediaBuilder as typeof ownedMediaSelectBuilder;
      }
      throw new Error(`Unexpected media_files fields: ${columns}`);
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [],
          archived: [],
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [
            expect.objectContaining({
              id: "generated:generation-video-fallback-1",
              previewStoragePath:
                "user-1/variants/videos/media-video-fallback-1/preview_loop_360p.mp4",
              previewPosterStoragePath:
                "user-1/variants/videos/media-video-fallback-1/poster_720.jpg",
              fullStoragePath: "user-1/generations/videos/media-video-fallback-1.mp4",
            }),
          ],
        }),
      })
    );
  });

  it("keeps project snapshot generated outputs newest-first by addition or generation recency", async () => {
    const associationBuilder = createAwaitableSelectBuilder({
      data: [{ generation_id: "gen-added-latest" }, { generation_id: "gen-started-latest" }],
      error: null,
    });
    const recentAssociationBuilder = createAwaitableSelectBuilder({
      data: [
        { generation_id: "gen-added-latest", updated_at: "2026-04-18T16:20:00.000Z" },
        { generation_id: "gen-started-latest", updated_at: "2026-04-18T16:05:00.000Z" },
      ],
      error: null,
    });
    const recentProjectionBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-started-latest",
          started_at: "2026-04-18T16:15:00.000Z",
          created_at: "2026-04-18T16:15:00.000Z",
          updated_at: "2026-04-18T16:15:05.000Z",
        },
        {
          generation_id: "gen-added-latest",
          started_at: "2026-04-18T15:00:00.000Z",
          created_at: "2026-04-18T15:00:00.000Z",
          updated_at: "2026-04-18T15:10:00.000Z",
        },
      ],
      error: null,
    });
    const projectionDetailsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          generation_id: "gen-started-latest",
          started_at: "2026-04-18T16:15:00.000Z",
          created_at: "2026-04-18T16:15:00.000Z",
          updated_at: "2026-04-18T16:15:05.000Z",
          request_id: "req-started-latest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Started latest",
          preview_url: "https://fal.test/started-latest.png",
          result_urls: ["https://fal.test/started-latest.png"],
          preview_storage_path: "user-1/generations/images/gen-started-latest/preview.png",
          full_storage_path: "user-1/generations/images/gen-started-latest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
        {
          generation_id: "gen-added-latest",
          started_at: "2026-04-18T15:00:00.000Z",
          created_at: "2026-04-18T15:00:00.000Z",
          updated_at: "2026-04-18T15:10:00.000Z",
          request_id: "req-added-latest",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          display_prompt: "Added latest",
          preview_url: "https://fal.test/added-latest.png",
          result_urls: ["https://fal.test/added-latest.png"],
          preview_storage_path: "user-1/generations/images/gen-added-latest/preview.png",
          full_storage_path: "user-1/generations/images/gen-added-latest/full.png",
          task_state: "success",
          queue_state: "dispatched",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      error: null,
    });

    projectGenerationItemsSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, updated_at") return recentAssociationBuilder;
      return associationBuilder;
    });
    generationProjectionSelectMock.mockImplementation((columns: string) => {
      if (columns === "generation_id, started_at, created_at, updated_at") {
        return recentProjectionBuilder;
      }
      return projectionDetailsBuilder;
    });

    const snapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId: "user-1",
      projectId: "project-1",
      snapshot: {
        outputs: {
          active: [
            { id: "local-started-latest", generationId: "gen-started-latest" },
            { id: "local-added-latest", generationId: "gen-added-latest" },
          ],
          archived: [],
        },
      },
    });

    const outputs = snapshot.outputs as { active: Array<{ id: string }> };
    expect(outputs.active.map((row) => row.id)).toEqual([
      "local-started-latest",
      "local-added-latest",
    ]);
  });
});
