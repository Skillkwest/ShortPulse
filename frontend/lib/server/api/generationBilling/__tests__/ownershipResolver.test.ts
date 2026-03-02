/**
 * Unit coverage for provider-request ownership resolution precedence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderRequestOwnership } from "../ownershipResolver";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockSupabase = ({
  reservationData = null,
  ledgerData = null,
  generationData = [],
}: {
  reservationData?: { user_id: string } | null;
  ledgerData?: { user_id: string } | null;
  generationData?: Array<{ user_id: string }>;
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

  const generationBuilder: Record<string, unknown> = {};
  generationBuilder.eq = vi.fn(() => generationBuilder);
  generationBuilder.limit = vi.fn(async () => ({
    data: generationData,
    error: null,
  }));

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations")
        return { select: vi.fn(() => reservationBuilder) };
      if (tableName === "ai_credit_ledger") return { select: vi.fn(() => ledgerBuilder) };
      if (tableName === "ai_generations") return { select: vi.fn(() => generationBuilder) };
      throw new Error(`Unexpected table ${tableName}`);
    }),
  };
};

describe("resolveProviderRequestOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("returns owned when ledger proves ownership after reservation miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: { user_id: "user-1" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-2",
    });

    expect(result).toBe("owned");
  });

  it("returns owned when ai_generations fallback proves ownership", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: null,
      generationData: [{ user_id: "user-1" }],
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-3",
    });

    expect(result).toBe("owned");
  });

  it("returns forbidden when ai_generations fallback resolves a different owner", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: null,
      generationData: [{ user_id: "user-2" }],
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-4",
    });

    expect(result).toBe("forbidden");
  });

  it("returns unknown when no ownership source can prove request ownership", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      ledgerData: null,
      generationData: [],
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-5",
    });

    expect(result).toBe("unknown");
  });
});
