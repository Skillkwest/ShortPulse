import { describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/openai/image-edit";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("retired /api/openai/image-edit", () => {
  it.each(["GET", "POST"])("returns 404 for %s requests", async (method) => {
    const req = {
      method,
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [{ image_url: "https://example.com/base.png" }],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });
});
