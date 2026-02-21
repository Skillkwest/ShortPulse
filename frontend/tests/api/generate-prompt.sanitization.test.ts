import { beforeEach, describe, expect, it, vi } from "vitest";
import generatePromptHandler from "../../pages/api/ai/generate-prompt";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("POST /api/ai/generate-prompt sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_PROMPT_SYSTEM = "You are a prompt refiner.";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("strips recap/meta tails from generated prompt output", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "An ancient Mayan temple rises from dense jungle. The prompt now includes a woman in traditional attire.",
            },
          },
        ],
        usage: { prompt_tokens: 22, completion_tokens: 15 },
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", "Sun, 26 Apr 2026 00:00:00 GMT");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "An ancient Mayan temple rises from dense jungle.",
      })
    );
  });

  it("treats summary-only outputs as invalid", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Summary: transformed the prompt with richer composition.",
            },
          },
        ],
      }),
    });

    const req = {
      method: "POST",
      body: { prompt: "ancient mayan temple in jungle" },
    };
    const res = createMockResponse();

    await generatePromptHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: "No prompt returned" });
  });
});
