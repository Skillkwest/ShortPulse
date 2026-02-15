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

describe("POST /api/kei/task-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 410 and does not call upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { taskId: "any-task-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "KEI_DISABLED_FOR_MVP",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledTimes(1);
  });
});
