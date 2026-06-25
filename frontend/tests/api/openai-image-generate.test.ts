import { describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/openai/image-generate";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("retired /api/openai/image-generate", () => {
  it.each(["GET", "POST"])("returns 404 for %s requests", async (method) => {
    const req = {
      method,
      body: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });
});
