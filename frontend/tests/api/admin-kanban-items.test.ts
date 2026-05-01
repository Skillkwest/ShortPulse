import { beforeEach, describe, expect, it, vi } from "vitest";
import itemsHandler from "../../pages/api/admin/kanban/items";
import itemHandler from "../../pages/api/admin/kanban/items/[itemId]";
import moveHandler from "../../pages/api/admin/kanban/items/[itemId]/move";
import archiveHandler from "../../pages/api/admin/kanban/items/[itemId]/archive";
import activityHandler from "../../pages/api/admin/kanban/items/[itemId]/activity";
import actionLogHandler from "../../pages/api/admin/kanban/activity";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listAdminKanbanItemsMock = vi.fn();
const createAdminKanbanItemMock = vi.fn();
const readAdminKanbanItemMock = vi.fn();
const updateAdminKanbanItemMock = vi.fn();
const moveAdminKanbanItemMock = vi.fn();
const archiveAdminKanbanItemMock = vi.fn();
const listAdminKanbanActivityMock = vi.fn();
const listAdminKanbanActionLogMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/adminKanbanBoard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/server/api/adminKanbanBoard")>();
  return {
    ...actual,
    listAdminKanbanItems: (...args: unknown[]) => listAdminKanbanItemsMock(...args),
    createAdminKanbanItem: (...args: unknown[]) => createAdminKanbanItemMock(...args),
    readAdminKanbanItem: (...args: unknown[]) => readAdminKanbanItemMock(...args),
    updateAdminKanbanItem: (...args: unknown[]) => updateAdminKanbanItemMock(...args),
    moveAdminKanbanItem: (...args: unknown[]) => moveAdminKanbanItemMock(...args),
    archiveAdminKanbanItem: (...args: unknown[]) => archiveAdminKanbanItemMock(...args),
    listAdminKanbanActivity: (...args: unknown[]) => listAdminKanbanActivityMock(...args),
    listAdminKanbanActionLog: (...args: unknown[]) => listAdminKanbanActionLogMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const makeItem = (overrides = {}) => ({
  id: "task-1",
  title: "Draft launch checklist",
  details: "Owner: ops",
  status: "backlog",
  sortOrder: 1,
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
  createdBy: "admin-1",
  updatedBy: "admin-1",
  ...overrides,
});

describe("admin kanban API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSupabaseAdminMock.mockReturnValue({ from: vi.fn() });
  });

  it("lists shared kanban items for admins", async () => {
    const item = makeItem();
    listAdminKanbanItemsMock.mockResolvedValue([item]);

    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await itemsHandler(req as never, res as never);

    expect(listAdminKanbanItemsMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [item] });
  });

  it("creates backlog items with normalized input", async () => {
    const item = makeItem({ title: "Ship board", details: "Review docs" });
    createAdminKanbanItemMock.mockResolvedValue(item);

    const req = {
      method: "POST",
      body: { title: " Ship board ", details: " Review docs " },
    };
    const res = createMockResponse();
    await itemsHandler(req as never, res as never);

    expect(createAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      {
        title: "Ship board",
        details: "Review docs",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, item });
  });

  it("rejects invalid create payloads before database access", async () => {
    const req = { method: "POST", body: { title: "   ", details: "" } };
    const res = createMockResponse();
    await itemsHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Task title is required." });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(createAdminKanbanItemMock).not.toHaveBeenCalled();
  });

  it("reads and updates one active kanban item", async () => {
    const originalItem = makeItem();
    const updatedItem = makeItem({ title: "Updated task", details: "Updated notes" });
    readAdminKanbanItemMock.mockResolvedValueOnce(originalItem);
    updateAdminKanbanItemMock.mockResolvedValueOnce(updatedItem);

    const readReq = { method: "GET", query: { itemId: "task-1" } };
    const readRes = createMockResponse();
    await itemHandler(readReq as never, readRes as never);

    expect(readAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      "task-1"
    );
    expect(readRes.status).toHaveBeenCalledWith(200);
    expect(readRes.json).toHaveBeenCalledWith({ item: originalItem });

    const updateReq = {
      method: "PATCH",
      query: { itemId: "task-1" },
      body: { title: " Updated task ", details: " Updated notes " },
    };
    const updateRes = createMockResponse();
    await itemHandler(updateReq as never, updateRes as never);

    expect(updateAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[1].value,
      {
        itemId: "task-1",
        title: "Updated task",
        details: "Updated notes",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      }
    );
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(updateRes.json).toHaveBeenCalledWith({ ok: true, item: updatedItem });
  });

  it("moves a task to a valid status", async () => {
    const item = makeItem({ status: "complete" });
    moveAdminKanbanItemMock.mockResolvedValue(item);

    const req = {
      method: "POST",
      query: { itemId: "task-1" },
      body: { status: "complete" },
    };
    const res = createMockResponse();
    await moveHandler(req as never, res as never);

    expect(moveAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      {
        itemId: "task-1",
        status: "complete",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, item });
  });

  it("rejects invalid move statuses", async () => {
    const req = {
      method: "POST",
      query: { itemId: "task-1" },
      body: { status: "ready" },
    };
    const res = createMockResponse();
    await moveHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Valid status is required." });
    expect(moveAdminKanbanItemMock).not.toHaveBeenCalled();
  });

  it("archives a task without deleting its audit trail", async () => {
    archiveAdminKanbanItemMock.mockResolvedValue(true);

    const req = { method: "POST", query: { itemId: "task-1" }, body: {} };
    const res = createMockResponse();
    await archiveHandler(req as never, res as never);

    expect(archiveAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      {
        itemId: "task-1",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns activity for archived kanban items", async () => {
    const item = makeItem({ status: "published" });
    const activity = [
      {
        id: "activity-1",
        itemId: "task-1",
        action: "archived",
        fromStatus: "published",
        toStatus: null,
        note: "Draft launch checklist",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
        createdAt: "2026-04-30T00:01:00.000Z",
      },
    ];
    readAdminKanbanItemMock.mockResolvedValue(item);
    listAdminKanbanActivityMock.mockResolvedValue(activity);

    const req = { method: "GET", query: { itemId: "task-1" }, body: {} };
    const res = createMockResponse();
    await activityHandler(req as never, res as never);

    expect(readAdminKanbanItemMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      "task-1",
      { includeArchived: true }
    );
    expect(listAdminKanbanActivityMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      "task-1"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ activity });
  });

  it("returns the shared board action log for admins", async () => {
    const activity = [
      {
        id: "activity-1",
        itemId: "task-1",
        itemTitle: "Draft launch checklist",
        action: "moved",
        fromStatus: "backlog",
        toStatus: "complete",
        note: "Draft launch checklist",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
        createdAt: "2026-04-30T00:01:00.000Z",
      },
    ];
    listAdminKanbanActionLogMock.mockResolvedValue(activity);

    const req = { method: "GET", query: { limit: "25" }, body: {} };
    const res = createMockResponse();
    await actionLogHandler(req as never, res as never);

    expect(listAdminKanbanActionLogMock).toHaveBeenCalledWith(
      getSupabaseAdminMock.mock.results[0].value,
      25
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ activity });
  });
});
