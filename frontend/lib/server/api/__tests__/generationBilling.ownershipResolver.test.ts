import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderRequestOwnership } from "../generationBilling/ownershipResolver";

const getSupabaseAdminMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const readGenerationProjectionOwnershipByProviderRequestIdMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../generationProjection", () => ({
  readGenerationProjectionOwnershipByProviderRequestId: (...args: unknown[]) =>
    readGenerationProjectionOwnershipByProviderRequestIdMock(...args),
}));

const createMaybeSingleQuery = (row: Record<string, unknown> | null) => ({
  eq: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
});

const mockOwnershipTables = ({
  reservationOwner = null,
  generationOwner = null,
}: {
  reservationOwner?: string | null;
  generationOwner?: string | null;
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
      if (table === "ai_generations") {
        return {
          select: vi
            .fn()
            .mockReturnValue(
              createMaybeSingleQuery(generationOwner ? { user_id: generationOwner } : null)
            ),
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
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({ userIds: [] });
    mockOwnershipTables({});
  });

  it("uses generation attempts as canonical ownership before projection", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        userId: "user-1",
      },
      error: null,
    });
    mockOwnershipTables({
      generationOwner: "user-2",
    });
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-2"],
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-1",
      })
    ).resolves.toBe("owned");
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenCalledWith({
      providerRequestId: "req-1",
      userId: "user-1",
    });
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

  it("returns unknown when only projection ownership exists without canonical generation lineage", async () => {
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-projection",
      })
    ).resolves.toBe("unknown");
  });

  it("does not let caller-owned projection rows override a foreign reservation owner", async () => {
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });
    mockOwnershipTables({
      reservationOwner: "user-2",
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-foreign-reservation",
      })
    ).resolves.toBe("forbidden");
  });

  it("uses ai_generations request ownership before projection fallback", async () => {
    mockOwnershipTables({
      generationOwner: "user-1",
    });
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-2"],
    });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-generation-owner",
      })
    ).resolves.toBe("owned");
  });

  it("does not let caller-owned projection rows override a foreign generation attempt owner", async () => {
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });
    lookupGenerationAttemptByProviderRequestMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          userId: "user-2",
        },
        error: null,
      });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-foreign-attempt",
      })
    ).resolves.toBe("forbidden");
  });

  it("returns forbidden when another user owns the provider request and the caller has no scoped proof", async () => {
    lookupGenerationAttemptByProviderRequestMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          userId: "user-2",
        },
        error: null,
      });

    await expect(
      resolveProviderRequestOwnership({
        userId: "user-1",
        providerRequestId: "req-foreign",
      })
    ).resolves.toBe("forbidden");
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenNthCalledWith(1, {
      providerRequestId: "req-foreign",
      userId: "user-1",
    });
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenNthCalledWith(2, {
      providerRequestId: "req-foreign",
      userId: null,
    });
  });
});
