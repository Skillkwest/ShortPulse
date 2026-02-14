import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kei/task-status";

const requireApiUserMock = vi.fn();
const resolveProviderRequestOwnershipMock = vi.fn();

vi.mock("../../pages/api/_utils/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../pages/api/_utils/generationBilling", () => ({
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/kei/task-status ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEI_API_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("returns 403 when provider request ownership resolves to another user", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("forbidden");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { taskId: "foreign-task-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveProviderRequestOwnershipMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "foreign-task-id",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when provider request ownership cannot be proven", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("unknown");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { taskId: "unknown-task-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies status when ownership is confirmed for current user", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    const fetchMock = vi.fn(async () => ({
      status: 200,
      json: async () => ({ data: { state: "success" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { taskId: "task-owned-by-user" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { state: "success" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
