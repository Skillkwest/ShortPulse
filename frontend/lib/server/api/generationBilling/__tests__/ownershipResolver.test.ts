/**
 * Unit coverage for provider-request ownership resolution precedence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProviderRequestOwnership } from "../ownershipResolver";

const getSupabaseAdminMock = vi.fn();
const resolveGenerationLineageByProviderRequestMock = vi.fn();
const readGenerationProjectionOwnershipByProviderRequestIdMock = vi.fn();

vi.mock("../../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../generationLineageResolver", () => ({
  resolveGenerationLineageByProviderRequest: (...args: unknown[]) =>
    resolveGenerationLineageByProviderRequestMock(...args),
}));

vi.mock("../../generationProjection", () => ({
  readGenerationProjectionOwnershipByProviderRequestId: (...args: unknown[]) =>
    readGenerationProjectionOwnershipByProviderRequestIdMock(...args),
}));

const createMockSupabase = ({
  reservationData = null,
}: {
  reservationData?: { user_id: string } | null;
}) => {
  const reservationBuilder: Record<string, unknown> = {};
  reservationBuilder.eq = vi.fn(() => reservationBuilder);
  reservationBuilder.order = vi.fn(() => reservationBuilder);
  reservationBuilder.limit = vi.fn(() => reservationBuilder);
  reservationBuilder.maybeSingle = vi.fn(async () => ({
    data: reservationData,
    error: null,
  }));

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations") {
        return { select: vi.fn(() => reservationBuilder) };
      }
      throw new Error(`Unexpected table ${tableName}`);
    }),
  };
};

const createLineage = (userId: string | null) => ({
  generationId: userId ? "gen-1" : null,
  generationAttemptId: null,
  userId,
  modelId: null,
  sourceRef: null,
  requestId: null,
  providerRequestId: "req-1",
  evidence: userId ? ["generation_attempt"] : [],
  attemptLookupError: null,
});

describe("resolveProviderRequestOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue(createLineage(null));
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
    resolveGenerationLineageByProviderRequestMock.mockResolvedValueOnce(createLineage("user-1"));

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-collision-attempt",
    });

    expect(result).toBe("owned");
    expect(resolveGenerationLineageByProviderRequestMock).toHaveBeenNthCalledWith(1, {
      providerRequestId: "req-collision-attempt",
      userId: "user-1",
      includeProjection: true,
    });
  });

  it("returns owned when canonical lineage proves ownership after reservation miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    resolveGenerationLineageByProviderRequestMock.mockResolvedValueOnce({
      ...createLineage("user-1"),
      evidence: ["generation_request_id"],
    });

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-4",
    });

    expect(result).toBe("owned");
  });

  it("returns forbidden when canonical lineage proves a different owner after scoped miss", async () => {
    const admin = createMockSupabase({
      reservationData: null,
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    resolveGenerationLineageByProviderRequestMock
      .mockResolvedValueOnce(createLineage(null))
      .mockResolvedValueOnce({
        ...createLineage("user-2"),
        evidence: ["generation_request_id"],
      });
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
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const result = await resolveProviderRequestOwnership({
      userId: "user-1",
      providerRequestId: "req-5",
    });

    expect(result).toBe("unknown");
  });
});
