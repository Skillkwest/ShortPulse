import { beforeEach, describe, expect, it, vi } from "vitest";
import createTaskHandler from "../../pages/api/kei/create-task";
import gpt4oGenerateHandler from "../../pages/api/kei/gpt4o-generate";

const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("KEI submit routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 410 for create-task", async () => {
    const req = {
      method: "POST",
      body: {
        model: "kei/gpt4o-image",
        input: { prompt: "hello" },
      },
    };
    const res = createMockResponse();

    await createTaskHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "KEI_DISABLED_FOR_MVP",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledTimes(1);
  });

  it("returns 410 for gpt4o-generate", async () => {
    const req = {
      method: "POST",
      body: { prompt: "hello" },
    };
    const res = createMockResponse();

    await gpt4oGenerateHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "KEI_DISABLED_FOR_MVP",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledTimes(1);
  });
});
