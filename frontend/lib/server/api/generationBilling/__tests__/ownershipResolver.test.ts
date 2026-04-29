/**
 * Unit coverage for provider-request ownership resolution precedence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderRequestOwnership } from "../ownershipResolver";

const getSupabaseAdminMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const readGenerationProjectionOwnershipByProviderRequestIdMock = vi.fn();

vi.mock("../../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../../generationProjection", () => ({
  readGenerationProjectionOwnershipByProviderRequestId: (...args: unknown[]) =>
    readGenerationProjectionOwnershipByProviderRequestIdMock(...args),
}));

const createMockSupabase = ({
  reservationData = null,
  ledgerData = null,
}: {
  reservationData?: { user_id: string } | null;
  ledgerData?: { user_id: string } | null;
}) => {
  const reservationBuilder: Record<string, unknown> = {};
  reservationBuilder.eq = vi.fn(() => reservationBuilder);
  reservationBuilder.order = vi.fn(() => reservationBuilder);
  reservationBuilder.limit = vi.fn(() => reservationBuilder);
  reservationBuilder.maybeSingle = vi.fn(async () => ({
    data: reservationData,
    error: null,
  }));

  const ledgerBuilder: Record<string, unknown> = {};
  ledgerBuilder.eq = vi.fn(() => ledgerBuilder);
  ledgerBuilder.contains = vi.fn(() => ledgerBuilder);
  ledgerBuilder.order = vi.fn(() => ledgerBuilder);
  ledgerBuilder.limit = vi.fn(() => ledgerBuilder);
  ledgerBuilder.maybeSingle = vi.fn(async () => ({
    data: ledgerData,
    error: null,
  }));

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations") {
        return { select: vi.fn(() => reservationBuilder) };
      }
      if (tableName === "ai_credit_ledger") {
        return { select: vi.fn(() => ledgerBuilder) };
      }
      throw new Error(`Unexpected table ${tableName}`);
    }),
  };
};

describe("resolveProviderRequestOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({ userIds: [] });
  });

  it("returns owned when reservation proves ownership", async () => {
    const admin = createMockSupabase({
      reservationData: { user_id: "user-1" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-1",
    });

    expect(result).toBe("owned");
  });

  it("returns owned when projection proves ownership after reservation and attempt miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: { user_id: "user-2" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-2",
    });

    expect(result).toBe("owned");
  });

  it("returns forbidden when projection resolves a different owner", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-2"],
    });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-3",
    });

    expect(result).toBe("forbidden");
  });

  it("returns unknown when only legacy ledger metadata matches after canonical lineage misses", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: { user_id: "user-1" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-4",
    });

    expect(result).toBe("unknown");
  });

  it("returns unknown when no ownership source can prove request ownership", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-5",
    });

    expect(result).toBe("unknown");
  });
});
