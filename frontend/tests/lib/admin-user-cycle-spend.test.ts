/**
 * Tests admin support cycle-spend aggregation against grant allocation and legacy ledger rows.
 */
import { describe, expect, it, vi } from "vitest";
import { fetchAdminUserCycleSpend } from "../../lib/server/api/adminUserCycleSpend";

type QueryResult = { data: unknown[]; error: { message?: string } | null };
type MockSpendQuery = {
  in: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
};

const createQuery = (result: QueryResult) => {
  const query: MockSpendQuery = {
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    lt: vi.fn(() => query),
    gte: vi.fn(() => query),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
};

const createSpendClient = ({
  allocations,
  ledger,
}: {
  allocations: unknown[];
  ledger: unknown[];
}) => ({
  from: vi.fn((table: string) => {
    if (table === "ai_credit_grant_allocations") {
      return { select: vi.fn(() => createQuery({ data: allocations, error: null })) };
    }
    if (table === "ai_credit_ledger") {
      return { select: vi.fn(() => createQuery({ data: ledger, error: null })) };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
});

const noSchemaCompatibilityError = () => false;

describe("fetchAdminUserCycleSpend", () => {
  it("uses allocation updated_at for subscription cycle spend and avoids ledger double counts", async () => {
    const supabaseAdmin = createSpendClient({
      allocations: [
        {
          user_id: "user-1",
          ledger_id: "ledger-cycle",
          amount_cents: 42,
          allocation_status: "captured",
          allocation_source: "generation_reservation",
          created_at: "2026-01-31T23:00:00.000Z",
          updated_at: "2026-02-10T00:00:00.000Z",
        },
        {
          user_id: "user-1",
          ledger_id: "ledger-admin",
          amount_cents: 900,
          allocation_status: "debited",
          allocation_source: "admin_adjustment",
          created_at: "2026-02-11T00:00:00.000Z",
          updated_at: "2026-02-11T00:00:00.000Z",
        },
        {
          user_id: "user-1",
          ledger_id: "ledger-after",
          amount_cents: 7,
          allocation_status: "captured",
          allocation_source: "generation_reservation",
          created_at: "2026-02-28T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      ledger: [
        {
          id: "ledger-cycle",
          user_id: "user-1",
          change_cents: -42,
          created_at: "2026-02-10T00:00:00.000Z",
        },
        {
          id: "legacy-cycle",
          user_id: "user-1",
          change_cents: -8,
          created_at: "2026-02-12T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchAdminUserCycleSpend({
      supabaseAdmin: supabaseAdmin as never,
      userIds: ["user-1"],
      contractByUser: new Map([
        [
          "user-1",
          {
            user_id: "user-1",
            current_period_start: "2026-02-01T00:00:00.000Z",
            current_period_end: "2026-03-01T00:00:00.000Z",
          },
        ],
      ]),
      profileByUser: new Map(),
      isSchemaCompatibilityError: noSchemaCompatibilityError,
    });

    expect(result.error).toBeNull();
    expect(result.spentByUser.get("user-1")).toBe(50);
  });

  it("falls back to current-month spend when a user has no billing cycle", async () => {
    const supabaseAdmin = createSpendClient({
      allocations: [
        {
          user_id: "user-free",
          ledger_id: "ledger-old",
          amount_cents: 99,
          allocation_status: "captured",
          allocation_source: "generation_reservation",
          created_at: "2026-06-30T00:00:00.000Z",
          updated_at: "2026-06-30T00:00:00.000Z",
        },
        {
          user_id: "user-free",
          ledger_id: "ledger-july",
          amount_cents: 55,
          allocation_status: "captured",
          allocation_source: "generation_reservation",
          created_at: "2026-07-04T00:00:00.000Z",
          updated_at: "2026-07-05T00:00:00.000Z",
        },
      ],
      ledger: [
        {
          id: "ledger-july",
          user_id: "user-free",
          change_cents: -55,
          created_at: "2026-07-05T00:00:00.000Z",
        },
        {
          id: "legacy-july",
          user_id: "user-free",
          change_cents: -12,
          created_at: "2026-07-06T00:00:00.000Z",
        },
        {
          id: "legacy-old",
          user_id: "user-free",
          change_cents: -88,
          created_at: "2026-06-30T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchAdminUserCycleSpend({
      supabaseAdmin: supabaseAdmin as never,
      userIds: ["user-free"],
      contractByUser: new Map(),
      profileByUser: new Map(),
      isSchemaCompatibilityError: noSchemaCompatibilityError,
      nowMs: Date.parse("2026-07-08T12:00:00.000Z"),
    });

    expect(result.error).toBeNull();
    expect(result.spentByUser.get("user-free")).toBe(67);
  });
});
