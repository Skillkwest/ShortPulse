/**
 * Verifies KEI status polling ownership checks when auth context comes from middleware headers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kei/task-status";

const resolveProviderRequestOwnershipMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/generationBilling", () => ({
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/kei/task-status middleware auth-context ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEI_API_KEY = "test-key";
  });

  it("keeps ownership enforcement with middleware-authenticated user context", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("forbidden");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/kei/task-status",
      headers: {
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-ctx",
        "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
        "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
      },
      body: { taskId: "foreign-task-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveProviderRequestOwnershipMock).toHaveBeenCalledWith({
      userId: "user-ctx",
      providerRequestId: "foreign-task-id",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still proxies upstream status when middleware-authenticated owner is confirmed", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    const fetchMock = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ data: { state: "success" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/kei/task-status",
      headers: {
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-ctx",
        "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
        "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
      },
      body: { taskId: "owned-task-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveProviderRequestOwnershipMock).toHaveBeenCalledWith({
      userId: "user-ctx",
      providerRequestId: "owned-task-id",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { state: "success" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
