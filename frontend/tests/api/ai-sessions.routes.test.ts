import { beforeEach, describe, expect, it, vi } from "vitest";
import saveSessionHandler from "../../pages/api/ai/sessions/save";
import getSessionHandler from "../../pages/api/ai/sessions/[sid]";
import listSessionsHandler from "../../pages/api/ai/sessions";

const requireApiUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("AI session API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
  });

  it("rejects non-POST session save methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await saveSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns retired for authenticated save requests", async () => {
    const req = { method: "POST", body: { sid: 42, snapshot: null } };
    const res = createMockResponse();
    await saveSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("returns retired for authenticated save payloads", async () => {
    const req = {
      method: "POST",
      body: {
        sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: { workspace: { prompt: "p" } },
      },
    };
    const res = createMockResponse();
    await saveSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("returns retired for authenticated get requests", async () => {
    const req = { method: "GET", query: { sid: "bad" } };
    const res = createMockResponse();
    await getSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("returns retired for authenticated get by sid requests", async () => {
    const req = { method: "GET", query: { sid: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a" } };
    const res = createMockResponse();
    await getSessionHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("returns retired for authenticated list validation requests", async () => {
    const req = { method: "GET", query: { limit: "0" } };
    const res = createMockResponse();
    await listSessionsHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("returns retired for authenticated list requests", async () => {
    const req = { method: "GET", query: { limit: "2", cursor: "cursor-1" } };
    const res = createMockResponse();
    await listSessionsHandler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "AI Studio legacy session persistence has been retired",
    });
  });
});
