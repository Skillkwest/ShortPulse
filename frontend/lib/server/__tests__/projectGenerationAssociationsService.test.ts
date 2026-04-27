import { beforeEach, describe, expect, it, vi } from "vitest";
import { associateGenerationWithProjectForUser } from "../projectGenerationAssociationsService";

const projectMaybeSingleMock = vi.fn();
const associationUpsertMock = vi.fn();

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
          upsert: associationUpsertMock,
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
});
