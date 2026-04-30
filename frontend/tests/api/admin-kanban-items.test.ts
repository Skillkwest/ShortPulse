import { beforeEach, describe, expect, it, vi } from "vitest";
import itemsHandler from "../../pages/api/admin/kanban/items";
import moveHandler from "../../pages/api/admin/kanban/items/[itemId]/move";
import archiveHandler from "../../pages/api/admin/kanban/items/[itemId]/archive";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listAdminKanbanItemsMock = vi.fn();
const createAdminKanbanItemMock = vi.fn();
const moveAdminKanbanItemMock = vi.fn();
const archiveAdminKanbanItemMock = vi.fn();

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
    moveAdminKanbanItem: (...args: unknown[]) => moveAdminKanbanItemMock(...args),
    archiveAdminKanbanItem: (...args: unknown[]) => archiveAdminKanbanItemMock(...args),
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
});
