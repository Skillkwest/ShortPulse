import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { listProjectMediaFoldersForUser } from "../projectMediaFoldersService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

describe("projectMediaFoldersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the aggregate RPC for project folder item counts", async () => {
    const folderRows = [
      {
        id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
        project_id: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        user_id: "user-1",
        name: "Folder A",
        parent_folder_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "6f1ff0ab-c9e7-4b20-9b27-53da4ac44b0b",
        project_id: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
        user_id: "user-1",
        name: "Folder B",
        parent_folder_id: null,
        created_at: "2026-03-02T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
    ];
    const listSelectMock = vi.fn().mockResolvedValue({
      data: folderRows,
      error: null,
    });
    const supabaseMock = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: listSelectMock,
              })),
            })),
          })),
        })),
      })),
      rpc: vi.fn(async () => ({
        data: [
          { folder_id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f", item_count: 4 },
          { folder_id: "6f1ff0ab-c9e7-4b20-9b27-53da4ac44b0b", item_count: "7" },
        ],
        error: null,
      })),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(
      listProjectMediaFoldersForUser({
        userId: "user-1",
        projectId: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: folderRows[0].id, item_count: 4 }),
      expect.objectContaining({ id: folderRows[1].id, item_count: 7 }),
    ]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_project_media_folder_item_counts", {
      p_user_id: "user-1",
      p_project_id: "8a39c0ea-d096-4f81-8f95-d84331f3069d",
      p_folder_ids: folderRows.map((row) => row.id),
    });
  });
});
