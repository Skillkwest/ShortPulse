import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/storage-economics";

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

const createSupabaseAdmin = (
  tables: Record<string, unknown[]>,
  authEmailsByUserId: Record<string, string | null> = {}
) => {
  const selects: Record<string, string[]> = {};
  const getUserById = vi.fn(async (userId: string) => ({
    data: {
      user: authEmailsByUserId[userId]
        ? {
            id: userId,
            email: authEmailsByUserId[userId],
          }
        : null,
    },
    error: null,
  }));
  type MockQueryResult = { data: unknown[]; error: null };
  type MockQueryBuilder = {
    select: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: Promise<MockQueryResult>["then"];
  };

  const from = vi.fn((tableName: string) => {
    const builder = {} as MockQueryBuilder;
    builder.select = vi.fn((columns: string) => {
      selects[tableName] = [...(selects[tableName] ?? []), columns];
      return builder;
    });
    builder.is = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.then = (onfulfilled, onrejected) =>
      Promise.resolve({ data: tables[tableName] ?? [], error: null }).then(onfulfilled, onrejected);
    return builder;
  });

  return {
    auth: {
      admin: {
        getUserById,
      },
    },
    from,
    getUserById,
    selects,
  };
};

describe("GET /api/admin/storage-economics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns aggregate storage economics without selecting private storage paths", async () => {
    const supabase = createSupabaseAdmin(
      {
        media_files: [
          {
            user_id: "user-paid",
            file_size: 600,
            created_at: "2026-07-01T00:00:00.000Z",
            storage_path: "must-not-be-selected",
          },
          {
            user_id: "user-free",
            file_size: 300,
            created_at: "2026-06-30T00:00:00.000Z",
          },
          {
            user_id: "user-exempt",
            file_size: 200,
            created_at: "2026-06-29T00:00:00.000Z",
          },
        ],
        billing_subscription_contracts: [
          {
            user_id: "user-paid",
            plan_id: "starter",
            storage_limit_bytes: 1000,
            contract_source: "stripe",
            stripe_subscription_id: "sub_123",
            recurring_price_cents: 1900,
            billing_interval: "month",
            status: "active",
          },
          {
            user_id: "user-exempt",
            plan_id: "business",
            offer_id: "business__current",
            storage_limit_bytes: 15000,
            contract_source: "stripe",
            stripe_subscription_id: null,
            recurring_price_cents: 29900,
            billing_interval: "month",
            status: "inactive",
            created_at: "2026-06-01T00:00:00.000Z",
          },
          {
            user_id: "user-exempt",
            plan_id: "media",
            offer_id: "media__internal_comp",
            storage_limit_bytes: 2500,
            contract_source: null,
            stripe_subscription_id: null,
            recurring_price_cents: 0,
            billing_interval: "month",
            status: "active",
            created_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        billing_profiles: [
          {
            user_id: "user-free",
            plan_id: "free",
          },
        ],
        billing_plans: [
          {
            id: "starter",
            display_name: "Starter",
            monthly_price_cents: 1900,
            storage_limit_bytes: 1000,
            sort_order: 2,
            is_active: true,
          },
          {
            id: "media",
            display_name: "Media",
            monthly_price_cents: 3900,
            storage_limit_bytes: 2500,
            sort_order: 3,
            is_active: true,
          },
        ],
        billing_plan_offers: [
          {
            id: "offer-starter-monthly",
            plan_id: "starter",
            recurring_price_cents: 1900,
            billing_interval: "month",
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-06-01T00:00:00.000Z",
            effective_end_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "offer-media-monthly",
            plan_id: "media",
            recurring_price_cents: 3900,
            billing_interval: "month",
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-06-01T00:00:00.000Z",
            effective_end_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "media__internal_comp",
            plan_id: "media",
            recurring_price_cents: 0,
            billing_interval: "month",
            acquisition_enabled: false,
            is_active: true,
            effective_start_at: "2026-07-01T00:00:00.000Z",
            effective_end_at: null,
            created_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        billing_storage_addons: [
          {
            id: "storage_50gb",
            display_name: "50 GB",
            sort_order: 1,
            is_active: true,
          },
          {
            id: "storage_250gb",
            display_name: "250 GB",
            sort_order: 2,
            is_active: true,
          },
        ],
        billing_storage_addon_offers: [
          {
            id: "offer-storage-50gb",
            storage_addon_id: "storage_50gb",
            storage_limit_bytes: 500,
            recurring_price_cents: 900,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-06-01T00:00:00.000Z",
            effective_end_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "offer-storage-250gb",
            storage_addon_id: "storage_250gb",
            storage_limit_bytes: 2500,
            recurring_price_cents: 2500,
            acquisition_enabled: true,
            is_active: true,
            effective_start_at: "2026-06-01T00:00:00.000Z",
            effective_end_at: null,
            created_at: "2026-06-01T00:00:00.000Z",
          },
        ],
        billing_subscription_storage_addons: [
          {
            user_id: "user-paid",
            storage_addon_id: "storage_50gb",
            offer_id: "offer-storage-50gb",
            stripe_subscription_item_id: "si_123",
            stripe_price_id: "price_123",
            storage_limit_bytes: 500,
            quantity: 1,
            recurring_price_cents: 900,
            status: "active",
          },
        ],
        admin_storage_usage_snapshots: [
          {
            snapshot_month: "2026-07-01",
            captured_at: new Date().toISOString(),
            source: "manual",
            supabase_plan: "Pro",
            compute_plan: "medium",
            compute_monthly_cost_cents: 6000,
            storage_used_gb: 42,
            storage_included_gb: 100,
            uncached_egress_gb: 120,
            cached_egress_gb: 60,
            uncached_egress_included_gb: 250,
            cached_egress_included_gb: 250,
            observed_storage_overage_cost_cents: null,
            observed_uncached_egress_overage_cost_cents: null,
            observed_cached_egress_overage_cost_cents: null,
            notes: "usage page snapshot",
          },
        ],
        app_error_events: [
          {
            message: "storage_addon_request_started",
            occurred_at: "2026-07-01T00:00:00.000Z",
            metadata: {
              event_name: "storage_addon_request_started",
            },
          },
          {
            message: "storage_addon_request_succeeded",
            occurred_at: "2026-07-01T00:00:00.000Z",
            metadata: {
              event_name: "storage_addon_request_succeeded",
            },
          },
        ],
      },
      {
        "user-free": "free@example.com",
      }
    );
    getSupabaseAdminMock.mockReturnValue(supabase);
    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.overview).toEqual(
      expect.objectContaining({
        trackedAccounts: 3,
        accountsWithMedia: 3,
        totalTrackedBytes: 1100,
        baselineStorageUsers: 1,
        activeAddonSubscribers: 1,
        activeAddonMrrCents: 900,
        estimatedPlanMrrCents: 1900,
        estimatedComputeCostCents: 6000,
      })
    );
    expect(payload.providerUsage).toEqual(
      expect.objectContaining({
        status: "current",
        source: "manual",
        snapshotMonth: "2026-07-01",
        storageUsedGb: 42,
        uncachedEgressGb: 120,
        cachedEgressGb: 60,
        storageQuotaUsedPct: 42,
        egressMultiple: expect.any(Number),
        notes: "usage page snapshot",
      })
    );
    expect(payload.byPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planId: "free",
          baselineStorageUsers: 1,
        }),
        expect.objectContaining({
          planId: "starter",
          catalogStorageLimitBytes: 1000,
          catalogRecurringPriceCents: 1900,
          catalogAcquisitionEnabled: true,
          activeStripeContracts: 1,
          contractMrrCents: 1900,
          isActive: true,
          accountsOver80Pct: 0,
        }),
        expect.objectContaining({
          planId: "payment_exempt",
          displayName: "Payment exempt testers",
          visibilityLabel: "hidden/admin only",
          catalogStorageLimitBytes: 2500,
          catalogAcquisitionEnabled: false,
          activeStripeContracts: 0,
          contractMrrCents: 0,
          accountCount: 1,
          usersWithMedia: 1,
          totalTrackedBytes: 200,
          baseLimitBytes: 2500,
        }),
        expect.objectContaining({
          planId: "media",
          accountCount: 0,
          catalogStorageLimitBytes: 2500,
          catalogRecurringPriceCents: 3900,
          activeStripeContracts: 0,
          contractMrrCents: 0,
        }),
      ])
    );
    expect(payload.addonPackages[0]).toEqual(
      expect.objectContaining({
        storageAddonId: "storage_50gb",
        catalogStorageLimitBytes: 500,
        catalogRecurringPriceCents: 900,
        activeSubscribers: 1,
        mrrCents: 900,
      })
    );
    expect(payload.addonPackages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storageAddonId: "storage_250gb",
          catalogStorageLimitBytes: 2500,
          catalogRecurringPriceCents: 2500,
          activeSubscribers: 0,
        }),
      ])
    );
    expect(payload.funnel).toEqual(
      expect.objectContaining({
        source: "app_error_events",
        addRequests: expect.objectContaining({ total: 1 }),
        addSuccesses: expect.objectContaining({ total: 1 }),
      })
    );
    expect(payload.riskQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-free",
          userEmail: "free@example.com",
          riskTypes: expect.arrayContaining(["baseline_storage_usage"]),
        }),
      ])
    );
    expect(supabase.getUserById).toHaveBeenCalledWith("user-free");
    expect(JSON.stringify(payload)).not.toContain("must-not-be-selected");
    expect(supabase.selects.media_files?.[0]).toBe("user_id, file_size, created_at");
    expect(supabase.selects.billing_plans?.[0]).toBe(
      "id, display_name, monthly_price_cents, storage_limit_bytes, sort_order, is_active"
    );
    expect(supabase.selects.billing_subscription_contracts?.[0]).toBe(
      "user_id, plan_id, offer_id, storage_limit_bytes, contract_source, stripe_subscription_id, recurring_price_cents, billing_interval, status, created_at"
    );
    expect(supabase.selects.billing_plan_offers?.[0]).toBe(
      "id, plan_id, recurring_price_cents, billing_interval, acquisition_enabled, is_active, effective_start_at, effective_end_at, created_at"
    );
    expect(supabase.selects.admin_storage_usage_snapshots?.[0]).toBe(
      "snapshot_month, captured_at, source, supabase_plan, compute_plan, compute_monthly_cost_cents, storage_used_gb, storage_included_gb, uncached_egress_gb, cached_egress_gb, uncached_egress_included_gb, cached_egress_included_gb, observed_storage_overage_cost_cents, observed_uncached_egress_overage_cost_cents, observed_cached_egress_overage_cost_cents, notes"
    );
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/storage-economics.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load admin storage economics." });
  });
});
