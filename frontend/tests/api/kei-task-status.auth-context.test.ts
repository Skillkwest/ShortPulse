import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kei/task-status";

const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/kei/task-status middleware auth context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still returns disabled response when middleware auth headers are present", async () => {
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

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "KEI_DISABLED_FOR_MVP",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledTimes(1);
  });
});
