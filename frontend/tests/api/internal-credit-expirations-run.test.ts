import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/credit-expirations/run";

const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/credit-expirations/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_CREDIT_EXPIRATIONS_ENABLED = "true";
    process.env.SHORTPULSE_CREDIT_EXPIRATIONS_CRON_SECRET = "secret";
    delete process.env.SHORTPULSE_CREDIT_EXPIRATIONS_BATCH_SIZE;
  });

  afterEach(() => {
    delete process.env.SHORTPULSE_CREDIT_EXPIRATIONS_ENABLED;
    delete process.env.SHORTPULSE_CREDIT_EXPIRATIONS_CRON_SECRET;
    delete process.env.SHORTPULSE_CREDIT_EXPIRATIONS_BATCH_SIZE;
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "GET", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns not found when disabled", async () => {
    process.env.SHORTPULSE_CREDIT_EXPIRATIONS_ENABLED = "false";
    const req = { method: "POST", headers: { "x-shortpulse-cron-secret": "secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("requires cron-secret auth", async () => {
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("runs the expiration RPC with a bounded batch size", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ expired_grants: 2, expired_cents: 750 }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });
    process.env.SHORTPULSE_CREDIT_EXPIRATIONS_BATCH_SIZE = "25";
    const req = { method: "POST", headers: { authorization: "Bearer secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("expire_credit_grants", { p_batch_size: 25 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      expiredGrants: 2,
      expiredCents: 750,
      batchSize: 25,
    });
  });
});
