import { beforeEach, describe, expect, it, vi } from "vitest";
import generatePromptHandler from "../../pages/api/ai/generate-prompt";
import describeImageHandler from "../../pages/api/ai/describe-image";
import studioAgentHandler from "../../pages/api/ai/studio-agent";
import keiTaskStatusHandler from "../../pages/api/kei/task-status";

const requireApiUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("API auth guards: AI and KEI routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockImplementation(
      async (
        _req: unknown,
        res: { status: (code: number) => { json: (payload: unknown) => unknown } }
      ) => {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
    );
  });

  it("rejects unauthenticated generate-prompt requests", async () => {
    const req = {
      method: "POST",
      body: { prompt: "improve this prompt" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated describe-image requests", async () => {
    const req = {
      method: "POST",
      body: { imageUrl: "https://example.com/image.png" },
    };
    const res = createMockResponse();

    await describeImageHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated studio-agent requests", async () => {
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "refine this prompt" }] },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated kei task-status requests", async () => {
    const req = {
      method: "POST",
      body: { taskId: "task_123" },
    };
    const res = createMockResponse();

    await keiTaskStatusHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });
});
