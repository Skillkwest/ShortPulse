import { describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/error-events";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/admin/error-events", () => {
  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });
});
