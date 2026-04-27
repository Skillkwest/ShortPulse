import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/sessions/save";

const requireApiUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/ai/sessions/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("returns 405 for non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 410 for authenticated requests because the endpoint is retired", async () => {
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { schemaVersion: 1 },
        schemaVersion: 1,
        title: "Session title",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "AI Studio legacy session persistence has been retired",
    });
  });
});
