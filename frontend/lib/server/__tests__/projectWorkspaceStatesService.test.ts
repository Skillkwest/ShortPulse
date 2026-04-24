import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { upsertProjectWorkspaceStateForUser } from "../projectWorkspaceStatesService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

const createSupabaseMock = () => {
  const mediaSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.filter((id) => id === "media-1" || id === "media-2").map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  const promptSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.filter((id) => id === "prompt-1").map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  const mediaAssociationUpsert = vi.fn(async () => ({ error: null }));
  const promptAssociationUpsert = vi.fn(async () => ({ error: null }));
  const workspaceMaybeSingle = vi.fn(async () => ({
    data: {
      project_id: "project-1",
      user_id: "user-1",
      schema_version: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
      },
      created_at: "2026-04-23T00:00:00.000Z",
      updated_at: "2026-04-23T01:00:00.000Z",
    },
    error: null,
  }));
  const workspaceSelect = vi.fn(() => ({
    maybeSingle: workspaceMaybeSingle,
  }));
  const workspaceUpsert = vi.fn(() => ({
    select: workspaceSelect,
  }));

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "media_files") {
        return {
          select: mediaSelect,
        };
      }
      if (table === "media_prompts") {
        return {
          select: promptSelect,
        };
      }
      if (table === "project_media_items") {
        return {
          upsert: mediaAssociationUpsert,
        };
      }
      if (table === "project_prompt_items") {
        return {
          upsert: promptAssociationUpsert,
        };
      }
      if (table === "project_workspace_states") {
        return {
          upsert: workspaceUpsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  getSupabaseAdminMock.mockReturnValue(supabaseMock as never);

  return {
    mediaAssociationUpsert,
    promptAssociationUpsert,
    workspaceUpsert,
  };
};

describe("projectWorkspaceStatesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("backfills owned media and prompt ids from the workspace snapshot before saving", async () => {
    const { mediaAssociationUpsert, promptAssociationUpsert, workspaceUpsert } =
      createSupabaseMock();

    const snapshot = {
      schemaVersion: 2,
      sessionId: "session-1",
      outputs: {
        active: [
          {
            id: "out-1",
            promptId: "prompt-1",
            savedMediaIds: ["media-1", "media-1", "media-missing"],
          },
        ],
        archived: [
          {
            id: "out-2",
            promptId: "prompt-missing",
            savedMediaIds: ["media-2"],
          },
        ],
      },
    };

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot,
      })
    ).resolves.toEqual({
      projectId: "project-1",
      userId: "user-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });

    expect(mediaAssociationUpsert).toHaveBeenCalledWith(
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
      expect.objectContaining({
        onConflict: "project_id,media_file_id",
      })
    );
    expect(promptAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          prompt_id: "prompt-1",
          user_id: "user-1",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,prompt_id",
      })
    );
    expect(workspaceUpsert).toHaveBeenCalled();
  });
});
