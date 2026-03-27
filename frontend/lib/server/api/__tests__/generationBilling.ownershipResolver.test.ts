import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderRequestOwnership } from "../generationBilling/ownershipResolver";

const getSupabaseAdminMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

const createMaybeSingleQuery = (row: Record<string, unknown> | null) => ({
  eq: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
});

const createArrayQuery = (rows: Record<string, unknown>[]) => ({
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
});

const mockOwnershipTables = ({
  reservationOwner = null,
  ledgerOwner = null,
  generationOwners = [],
}: {
  reservationOwner?: string | null;
  ledgerOwner?: string | null;
  generationOwners?: string[];
}) => {
  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "ai_credit_reservations") {
        return {
          select: vi
            .fn()
            .mockReturnValue(
              createMaybeSingleQuery(reservationOwner ? { user_id: reservationOwner } : null)
            ),
        };
      }
      if (table === "ai_credit_ledger") {
        return {
          select: vi
            .fn()
            .mockReturnValue(createMaybeSingleQuery(ledgerOwner ? { user_id: ledgerOwner } : null)),
        };
      }
      if (table === "ai_generations") {
        return {
          select: vi
            .fn()
            .mockReturnValue(createArrayQuery(generationOwners.map((user_id) => ({ user_id })))),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
};

describe("resolveProviderRequestOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
    mockOwnershipTables({});
  });

  it("uses generation attempts as canonical ownership before ledger and generation fallbacks", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        userId: "user-1",
      },
      error: null,
    });
    mockOwnershipTables({
      ledgerOwner: "user-2",
      generationOwners: ["user-2"],
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-1",
      })
    ).resolves.toBe("owned");
  });

  it("returns forbidden when the canonical generation attempt belongs to another user", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        userId: "user-2",
      },
      error: null,
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-2",
      })
    ).resolves.toBe("forbidden");
  });

  it("falls back to legacy generation ownership when no attempt row exists", async () => {
    mockOwnershipTables({
      generationOwners: ["user-1"],
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-legacy",
      })
    ).resolves.toBe("owned");
  });
});
