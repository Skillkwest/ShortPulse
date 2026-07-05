import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/storage-usage-snapshots";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const buildValidBody = () => ({
  snapshotMonth: "2026-07",
  capturedAt: "2026-07-05T18:00:00.000Z",
  source: "supabase_usage_page",
  supabasePlan: "Pro",
  computePlan: "medium",
  computeMonthlyCostCents: "6000",
  storageUsedGb: "42.125",
  storageIncludedGb: "100",
  uncachedEgressGb: "120.5",
  cachedEgressGb: "60",
  uncachedEgressIncludedGb: "250",
  cachedEgressIncludedGb: "250",
  observedStorageOverageCostCents: "",
  observedUncachedEgressOverageCostCents: "450",
  observedCachedEgressOverageCostCents: null,
  notes: "Usage page filtered to ShortPulse production.",
});

const createSupabaseAdmin = () => {
  const insert = vi.fn();
  const select = vi.fn();
  const single = vi.fn().mockResolvedValue({
    data: {
      id: "snapshot-1",
      snapshot_month: "2026-07-01",
      captured_at: "2026-07-05T18:00:00.000Z",
      source: "supabase_usage_page",
    },
    error: null,
  });
  const builder = {
    insert: vi.fn((row: unknown) => {
      insert(row);
      return builder;
    }),
    select: vi.fn((columns: string) => {
      select(columns);
      return builder;
    }),
    single,
  };
  return {
    from: vi.fn(() => builder),
    insert,
    select,
    single,
  };
};

describe("POST /api/admin/storage-usage-snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("validates required provider snapshot fields", async () => {
    const req = {
      method: "POST",
      body: {
        ...buildValidBody(),
        snapshotMonth: "2026-07-15",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "snapshotMonth must be a YYYY-MM value." });
  });

  it("rejects negative observed overage costs instead of dropping them", async () => {
    const req = {
      method: "POST",
      body: {
        ...buildValidBody(),
        observedCachedEgressOverageCostCents: "-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "observedCachedEgressOverageCostCents must be a nonnegative integer.",
    });
  });

  it("inserts a service-role provider snapshot without raw invoice or storage-path fields", async () => {
    const supabase = createSupabaseAdmin();
    getSupabaseAdminMock.mockReturnValue(supabase);
    const req = { method: "POST", body: buildValidBody() };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.from).toHaveBeenCalledWith("admin_storage_usage_snapshots");
    expect(supabase.insert).toHaveBeenCalledWith({
      snapshot_month: "2026-07-01",
      captured_at: "2026-07-05T18:00:00.000Z",
      source: "supabase_usage_page",
      supabase_plan: "Pro",
      compute_plan: "medium",
      compute_monthly_cost_cents: 6000,
      storage_used_gb: 42.125,
      storage_included_gb: 100,
      uncached_egress_gb: 120.5,
      cached_egress_gb: 60,
      uncached_egress_included_gb: 250,
      cached_egress_included_gb: 250,
      observed_storage_overage_cost_cents: null,
      observed_uncached_egress_overage_cost_cents: 450,
      observed_cached_egress_overage_cost_cents: null,
      notes: "Usage page filtered to ShortPulse production.",
    });
    expect(supabase.select).toHaveBeenCalledWith(
      "id, snapshot_month, captured_at, source, supabase_plan, compute_plan, compute_monthly_cost_cents"
    );
    expect(JSON.stringify(supabase.insert.mock.calls[0][0])).not.toContain("storage_path");
    expect(JSON.stringify(supabase.insert.mock.calls[0][0])).not.toContain("invoice");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({ id: "snapshot-1" }),
      })
    );
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "POST", body: buildValidBody(), headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/storage-usage-snapshots.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to capture storage usage snapshot." });
  });
});
