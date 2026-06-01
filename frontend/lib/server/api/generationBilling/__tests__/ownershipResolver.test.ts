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
  generationData = null,
}: {
  reservationData?: { user_id: string } | null;
  generationData?: { user_id: string } | null;
}) => {
  const reservationBuilder: Record<string, unknown> = {};
  reservationBuilder.eq = vi.fn(() => reservationBuilder);
  reservationBuilder.order = vi.fn(() => reservationBuilder);
  reservationBuilder.limit = vi.fn(() => reservationBuilder);
  reservationBuilder.maybeSingle = vi.fn(async () => ({
    data: reservationData,
    error: null,
  }));

  const generationBuilder: Record<string, unknown> = {};
  generationBuilder.eq = vi.fn(() => generationBuilder);
  generationBuilder.order = vi.fn(() => generationBuilder);
  generationBuilder.limit = vi.fn(() => generationBuilder);
  generationBuilder.maybeSingle = vi.fn(async () => ({
    data: generationData,
    error: null,
  }));

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations") {
        return { select: vi.fn(() => reservationBuilder) };
      }
      if (tableName === "ai_generations") {
        return { select: vi.fn(() => generationBuilder) };
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

  it("returns owned when another user's reservation exists but the caller also has a scoped reservation", async () => {
    const admin = createMockSupabase({
      reservationData: { user_id: "user-1" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-collision-reservation",
    });

    expect(result).toBe("owned");
    expect(admin.from).toHaveBeenCalledWith("ai_credit_reservations");
  });

  it("returns unknown when projection is the only ownership hint", async () => {
    const admin = createMockSupabase({
      reservationData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-2",
    });

    expect(result).toBe("unknown");
  });

  it("returns forbidden when projection resolves a different owner", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      generationData: null,
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

  it("returns owned when a scoped attempt exists even if another user would match the same provider request id globally", async () => {
    const admin = createMockSupabase({
      reservationData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    lookupGenerationAttemptByProviderRequestMock
      .mockResolvedValueOnce({
        data: {
          userId: "user-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          userId: "user-2",
        },
        error: null,
      });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-collision-attempt",
    });

    expect(result).toBe("owned");
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenNthCalledWith(1, {
      providerRequestId: "req-collision-attempt",
      userId: "user-1",
    });
  });

  it("returns owned when ai_generations proves ownership after reservation and attempt miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      generationData: { user_id: "user-1" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-4",
    });

    expect(result).toBe("owned");
  });

  it("returns forbidden when ai_generations proves a different owner after reservation and attempt miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      generationData: { user_id: "user-2" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    readGenerationProjectionOwnershipByProviderRequestIdMock.mockResolvedValue({
      userIds: ["user-1"],
    });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-4-foreign-generation",
    });

    expect(result).toBe("forbidden");
  });

  it("returns unknown when no ownership source can prove request ownership", async () => {
    const admin = createMockSupabase({
      reservationData: null,
      generationData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-5",
    });

    expect(result).toBe("unknown");
  });
});
