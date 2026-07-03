/**
 * Tests the server-side plan concurrency entitlement resolver against contract, offer, and default paths.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBillingConcurrencyEntitlement } from "../../lib/server/api/billingConcurrencyEntitlements";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type QueryResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type ContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  max_concurrent_generations: number | string | null;
};

type ProfileRow = {
  plan_id: string | null;
};

type OfferRow = {
  id: string;
  plan_id: string | null;
  max_concurrent_generations: number | string | null;
};

type TableResults = {
  contract?: QueryResult<ContractRow>;
  profile?: QueryResult<ProfileRow>;
  offer?: QueryResult<OfferRow>;
};

type MaybeSingleQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

const ok = <T>(data: T | null): QueryResult<T> => ({ data, error: null });

const failed = <T>(error: SupabaseError): QueryResult<T> => ({ data: null, error });

const createMaybeSingleQuery = <T>(result: QueryResult<T>): MaybeSingleQuery => {
  const query = {} as MaybeSingleQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  return query;
};

const createSupabaseMock = (results: TableResults) => {
  const queries: Record<string, MaybeSingleQuery> = {};
  const from = vi.fn((table: string) => {
    const result =
      table === "billing_subscription_contracts"
        ? (results.contract ?? ok<ContractRow>(null))
        : table === "billing_profiles"
          ? (results.profile ?? ok<ProfileRow>(null))
          : table === "billing_plan_offers"
            ? (results.offer ?? ok<OfferRow>(null))
            : ok(null);
    const query = createMaybeSingleQuery(result);
    queries[table] = query;
    return query;
  });

  return {
    client: { from },
    from,
    queries,
  };
};

describe("resolveBillingConcurrencyEntitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the open billing subscription contract as the runtime authority", async () => {
    const supabase = createSupabaseMock({
      contract: ok({
        id: "contract-business",
        plan_id: "business",
        offer_id: "business__2026_annual",
        max_concurrent_generations: "8",
      }),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const entitlement = await resolveBillingConcurrencyEntitlement("user-1");

    expect(entitlement).toEqual({
      userId: "user-1",
      planId: "business",
      planDisplayName: "Business",
      offerId: "business__2026_annual",
      contractId: "contract-business",
      maxConcurrentGenerations: 8,
      source: "contract",
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("billing_subscription_contracts");
  });

  it("falls back to the active monthly offer for users without an open contract", async () => {
    const supabase = createSupabaseMock({
      contract: ok<ContractRow>(null),
      profile: ok({ plan_id: "media" }),
      offer: ok({
        id: "media__current",
        plan_id: "media",
        max_concurrent_generations: 2,
      }),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const entitlement = await resolveBillingConcurrencyEntitlement("user-2");

    expect(entitlement).toEqual({
      userId: "user-2",
      planId: "media",
      planDisplayName: "Media",
      offerId: "media__current",
      contractId: null,
      maxConcurrentGenerations: 2,
      source: "current_offer",
    });
    expect(supabase.from).toHaveBeenCalledWith("billing_profiles");
    expect(supabase.from).toHaveBeenCalledWith("billing_plan_offers");
    expect(supabase.queries.billing_plan_offers.eq).toHaveBeenCalledWith("plan_id", "media");
    expect(supabase.queries.billing_plan_offers.eq).toHaveBeenCalledWith(
      "billing_interval",
      "month"
    );
    expect(supabase.queries.billing_plan_offers.eq).not.toHaveBeenCalledWith(
      "acquisition_enabled",
      expect.anything()
    );
  });

  it("uses the plan default when a contract row has a missing concurrency snapshot", async () => {
    const supabase = createSupabaseMock({
      contract: ok({
        id: "contract-studio",
        plan_id: "studio",
        offer_id: "studio__legacy",
        max_concurrent_generations: null,
      }),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const entitlement = await resolveBillingConcurrencyEntitlement("user-3");

    expect(entitlement).toMatchObject({
      planId: "studio",
      planDisplayName: "Studio",
      contractId: "contract-studio",
      maxConcurrentGenerations: 4,
      source: "contract",
    });
  });

  it("returns the baseline default when temporary schema-rollout reads are unavailable", async () => {
    const supabase = createSupabaseMock({
      contract: failed({
        code: "42703",
        message: "column max_concurrent_generations does not exist",
      }),
      profile: failed({ code: "42P01", message: "relation billing_profiles does not exist" }),
      offer: failed({ code: "PGRST204", message: "Could not find column in schema cache" }),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const entitlement = await resolveBillingConcurrencyEntitlement("user-4");

    expect(entitlement).toEqual({
      userId: "user-4",
      planId: "free",
      planDisplayName: "Baseline access",
      offerId: null,
      contractId: null,
      maxConcurrentGenerations: 0,
      source: "default",
    });
  });

  it("throws non-schema contract resolver errors instead of silently inventing access", async () => {
    const supabase = createSupabaseMock({
      contract: failed({ code: "42501", message: "permission denied for table" }),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await expect(resolveBillingConcurrencyEntitlement("user-5")).rejects.toThrow(
      "permission denied for table"
    );
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
