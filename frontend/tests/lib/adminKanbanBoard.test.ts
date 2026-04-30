import { describe, expect, it, vi } from "vitest";
import {
  archiveAdminKanbanItem,
  createAdminKanbanItem,
  moveAdminKanbanItem,
  updateAdminKanbanItem,
} from "../../lib/server/api/adminKanbanBoard";

const makeRawItem = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Draft launch checklist",
  details: "Owner: ops",
  status: "backlog",
  sort_order: 1,
  created_at: "2026-04-30T00:00:00.000Z",
  updated_at: "2026-04-30T00:00:00.000Z",
  created_by: "admin-1",
  updated_by: "admin-1",
  ...overrides,
});

describe("admin kanban persistence helpers", () => {
  it("creates tasks through the atomic mutation RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: makeRawItem(), error: null });

    const item = await createAdminKanbanItem({ rpc } as never, {
      title: "Draft launch checklist",
      details: "Owner: ops",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(rpc).toHaveBeenCalledWith("create_admin_kanban_item", {
      p_title: "Draft launch checklist",
      p_details: "Owner: ops",
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
    });
    expect(item).toMatchObject({
      id: "task-1",
      title: "Draft launch checklist",
      status: "backlog",
      sortOrder: 1,
    });
  });

  it("updates and moves tasks through atomic mutation RPCs", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: makeRawItem({ title: "Updated task" }), error: null })
      .mockResolvedValueOnce({ data: makeRawItem({ status: "complete" }), error: null });
    const supabaseAdmin = { rpc } as never;

    await updateAdminKanbanItem(supabaseAdmin, {
      itemId: "task-1",
      title: "Updated task",
      details: "Updated notes",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    const movedItem = await moveAdminKanbanItem(supabaseAdmin, {
      itemId: "task-1",
      status: "complete",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "update_admin_kanban_item", {
      p_item_id: "task-1",
      p_title: "Updated task",
      p_details: "Updated notes",
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "move_admin_kanban_item", {
      p_item_id: "task-1",
      p_status: "complete",
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
    });
    expect(movedItem?.status).toBe("complete");
  });

  it("archives through the atomic mutation RPC and reports missing rows", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: makeRawItem(), error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const supabaseAdmin = { rpc } as never;

    await expect(
      archiveAdminKanbanItem(supabaseAdmin, {
        itemId: "task-1",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      })
    ).resolves.toBe(true);
    await expect(
      archiveAdminKanbanItem(supabaseAdmin, {
        itemId: "missing-task",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      })
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenNthCalledWith(1, "archive_admin_kanban_item", {
      p_item_id: "task-1",
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "archive_admin_kanban_item", {
      p_item_id: "missing-task",
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
    });
  });
});
