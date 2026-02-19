import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/generation-recovery/replay";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createGenerationLookupBuilder = (rows: unknown[]) => {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(async () => ({ data: rows, error: null }));
  return builder;
};

describe("POST /api/admin/generation-recovery/replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    process.env.FAL_KEY = "test-fal-key";
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("requires generationId or requestId", async () => {
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Provide generationId or requestId." });
  });

  it("returns 404 when generation is not found", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "ai_generations") {
          return createGenerationLookupBuilder([]);
        }
        return createGenerationLookupBuilder([]);
      },
    });

    const req = {
      method: "POST",
      body: { requestId: "req-missing-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Generation not found." });
  });
});
