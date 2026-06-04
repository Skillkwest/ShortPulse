import { beforeEach, describe, expect, it, vi } from "vitest";
import extractStyleHandler from "../../pages/api/ai/extract-style";
import standardStudioAgentHandler from "../../pages/api/ai/studio-agent-standard";

const requireApiUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  getOptionalApiUser: vi.fn(async () => null),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("API auth guards: AI routes", () => {
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

  it("rejects unauthenticated extract-style requests", async () => {
    const req = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,abc123" },
    };
    const res = createMockResponse();

    await extractStyleHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated Standard studio-agent requests", async () => {
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "refine this prompt" }] },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });
});
