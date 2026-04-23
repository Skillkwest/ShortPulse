import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/users/[userId]";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("DELETE /api/admin/users/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: ADMIN_ID, email: "admin@example.com" });
  });

  it("rejects non-DELETE methods", async () => {
    const req = { method: "POST", query: { userId: USER_ID } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects attempts to delete the current admin", async () => {
    const req = {
      method: "DELETE",
      query: { userId: ADMIN_ID },
      body: { confirmationText: ADMIN_ID },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "You cannot delete the currently signed-in admin.",
    });
  });

  it("rejects mismatched confirmation text", async () => {
    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: USER_ID, email: "target@example.com" } },
            error: null,
          }),
        },
      },
    });

    const req = {
      method: "DELETE",
      query: { userId: USER_ID },
      body: { confirmationText: "wrong@example.com" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Type target@example.com exactly to confirm deletion.",
    });
  });

  it("deletes the user when the confirmation text matches", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "target@example.com" } },
      error: null,
    });
    const deleteUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });

    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById,
          deleteUser,
        },
      },
    });

    const req = {
      method: "DELETE",
      query: { userId: USER_ID },
      body: { confirmationText: "target@example.com" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(getUserById).toHaveBeenCalledWith(USER_ID);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID, false);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      userId: USER_ID,
      email: "target@example.com",
    });
  });
});
