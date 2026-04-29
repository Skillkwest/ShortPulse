import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  associateGenerationWithProjectForUser,
  hydrateProjectSnapshotGeneratedOutputs,
} from "../projectGenerationAssociationsService";

const projectMaybeSingleMock = vi.fn();
const associationUpsertMock = vi.fn();
const projectGenerationItemsSelectMock = vi.fn();
const generationProjectionSelectMock = vi.fn();

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
      if (table === "generation_projection") {
        return {
          select: generationProjectionSelectMock,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

describe("associateGenerationWithProjectForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a project association when the project belongs to the user", async () => {
    projectMaybeSingleMock.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
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
            }),
          ],
        }),
      })
    );
    expect(recentProjectionBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
  });
});
