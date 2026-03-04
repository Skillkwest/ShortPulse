import { describe, it, expect, beforeEach, vi } from "vitest";
import { readActiveProviderCapacitySnapshot } from "../generationQueue/activeProviderCapacity";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type ReservationQuery = {
  select: ReturnType<typeof vi.fn>;
};

type GenerationQuery = {
  select: ReturnType<typeof vi.fn>;
};

const buildSupabaseMock = ({
  reservations,
  generations,
}: {
  reservations: unknown[];
  generations: unknown[];
}) => {
  const reservationNot = vi.fn(async () => ({ data: reservations, error: null }));
  const reservationEq2 = vi.fn(() => ({ not: reservationNot }));
  const reservationEq1 = vi.fn(() => ({ eq: reservationEq2 }));
  const reservationSelect = vi.fn(() => ({ eq: reservationEq1 }));

  const generationIn = vi.fn(async () => ({ data: generations, error: null }));
  const generationEq = vi.fn(() => ({ in: generationIn }));
  const generationSelect = vi.fn(() => ({ eq: generationEq }));

  const reservationQuery: ReservationQuery = {
    select: reservationSelect,
  };
  const generationQuery: GenerationQuery = {
    select: generationSelect,
  };

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations") return reservationQuery;
      if (tableName === "ai_generations") return generationQuery;
      throw new Error(`Unexpected table: ${tableName}`);
    }),
    spies: {
      reservationSelect,
      generationSelect,
    },
  };
};

describe("readActiveProviderCapacitySnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counters when no provider-attached reservations exist", async () => {
    const supabase = buildSupabaseMock({ reservations: [], generations: [] });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      userId: "user-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      staleIgnoreMinAgeSeconds: 7200,
      orphanGraceSeconds: 60,
      nowMs: Date.parse("2026-03-04T12:00:00.000Z"),
    });

    expect(snapshot).toEqual({
      tier: "image_heavy",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    expect(supabase.spies.reservationSelect).toHaveBeenCalled();
    expect(supabase.spies.generationSelect).not.toHaveBeenCalled();
  });

  it("ignores stale provider-attached holds while preserving active and grace-window holds", async () => {
    const nowMs = Date.parse("2026-03-04T12:00:00.000Z");
    const supabase = buildSupabaseMock({
      reservations: [
        {
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-active",
          created_at: "2026-03-04T11:59:50.000Z",
        },
        {
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-terminal",
          created_at: "2026-03-04T08:00:00.000Z",
        },
        {
          model_id: "fal-ai/nano-banana-2/edit",
          provider_request_id: "req-orphan-old",
          created_at: "2026-03-03T08:00:00.000Z",
        },
        {
          model_id: "fal-ai/nano-banana-2/edit",
          provider_request_id: "req-orphan-new",
          created_at: "2026-03-04T11:59:30.000Z",
        },
      ],
      generations: [
        {
          request_id: "req-active",
          status: "running",
          recovery_state: "recovering",
        },
        {
          request_id: "req-terminal",
          status: "fail",
          recovery_state: "exhausted",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      userId: "user-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      staleIgnoreMinAgeSeconds: 7200,
      orphanGraceSeconds: 60,
      nowMs,
    });

    expect(snapshot).toEqual({
      tier: "image_heavy",
      globalActive: 2,
      tierActive: 1,
      staleIgnoredGlobal: 2,
      staleIgnoredTier: 1,
    });
  });
});
