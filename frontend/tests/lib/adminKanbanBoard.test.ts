import { describe, expect, it, vi } from "vitest";
import {
  archiveAdminKanbanItem,
  createAdminKanbanItem,
  moveAdminKanbanItem,
  syncAdminKanbanPlanningBacklogItems,
  updateAdminKanbanItem,
} from "../../lib/server/api/adminKanbanBoard";

const makeRawItem = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Draft launch checklist",
  details: "Owner: ops",
  status: "backlog",
  sort_order: 1,
  source_type: "manual",
  source_key: null,
  source_path: null,
  source_section: null,
  source_line: null,
  source_fingerprint: null,
  source_synced_at: null,
  source_missing_at: null,
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
      p_source_type: "manual",
      p_source_key: null,
      p_source_path: null,
      p_source_section: null,
      p_source_line: null,
      p_source_fingerprint: null,
    });
    expect(item).toMatchObject({
      id: "task-1",
      title: "Draft launch checklist",
      status: "backlog",
      sortOrder: 1,
      sourceType: "manual",
    });
  });

  it("passes optional source metadata when creating sourced tickets", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: makeRawItem({
        source_type: "admin_error",
        source_key: "incident-1",
      }),
      error: null,
    });

    const item = await createAdminKanbanItem({ rpc } as never, {
      title: "Ophestivus: API error",
      details: "Incident: incident-1",
      actorUserId: null,
      actorEmail: "ophestivus@local.agent",
      sourceType: "admin_error",
      sourceKey: "incident-1",
    });

    expect(rpc).toHaveBeenCalledWith("create_admin_kanban_item", {
      p_title: "Ophestivus: API error",
      p_details: "Incident: incident-1",
      p_actor_user_id: null,
      p_actor_email: "ophestivus@local.agent",
      p_source_type: "admin_error",
      p_source_key: "incident-1",
      p_source_path: null,
      p_source_section: null,
      p_source_line: null,
      p_source_fingerprint: null,
    });
    expect(item.sourceType).toBe("admin_error");
    expect(item.sourceKey).toBe("incident-1");
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

  it("syncs planning backlog items through the source sync RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        dryRun: true,
        received: 1,
        created: 1,
        updated: 0,
        unchanged: 0,
        skippedArchived: 0,
        markedMissing: 0,
      },
      error: null,
    });

    const summary = await syncAdminKanbanPlanningBacklogItems({ rpc } as never, {
      dryRun: true,
      actorUserId: null,
      actorEmail: "admin-kanban-backlog-sync@local.script",
      items: [
        {
          sourceKey: "spb-p1-001",
          title: "Make paid generation cost obvious",
          details: "Program: Program 1",
          sourcePath: "docs/planning/backlog.md",
          sourceSection: "Program 1: Runtime And Money",
          sourceLine: 30,
          sourceFingerprint: "a".repeat(64),
        },
      ],
    });

    expect(rpc).toHaveBeenCalledWith("sync_admin_kanban_planning_backlog_items", {
      p_items: [
        {
          sourceKey: "spb-p1-001",
          title: "Make paid generation cost obvious",
          details: "Program: Program 1",
          sourcePath: "docs/planning/backlog.md",
          sourceSection: "Program 1: Runtime And Money",
          sourceLine: 30,
          sourceFingerprint: "a".repeat(64),
        },
      ],
      p_actor_user_id: null,
      p_actor_email: "admin-kanban-backlog-sync@local.script",
      p_dry_run: true,
    });
    expect(summary).toMatchObject({ dryRun: true, received: 1, created: 1 });
  });
});
