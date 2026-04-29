import { describe, it, expect, beforeEach, vi } from "vitest";
import { readActiveProviderCapacitySnapshot } from "../generationAdmission/activeProviderCapacity";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type ReservationQuery = {
  select: ReturnType<typeof vi.fn>;
};

type GenerationAttemptQuery = {
  select: ReturnType<typeof vi.fn>;
};

type GenerationQuery = {
  select: ReturnType<typeof vi.fn>;
};

type ReservationResult = { data: unknown[]; error: null };

type ReservationAwaitable = {
  eq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  then: PromiseLike<ReservationResult>["then"];
};

const buildSupabaseMock = ({
  reservations,
  attempts = [],
  generations,
}: {
  reservations: unknown[];
  attempts?: unknown[];
  generations: unknown[];
}) => {
  const filterRowsByEq = (rows: unknown[], column: string, value: unknown) =>
    rows.filter((row) => {
      if (!row || typeof row !== "object" || !(column in (row as Record<string, unknown>))) {
        return true;
      }
      return (row as Record<string, unknown>)[column] === value;
    });

  const filterRowsByNot = (rows: unknown[], column: string, operator: string, value: unknown) => {
    if (operator === "is" && value === null) {
      return rows.filter((row) => {
        if (!row || typeof row !== "object") return true;
        return (row as Record<string, unknown>)[column] !== null;
      });
    }
    return rows;
  };

  const createReservationAwaitable = (initialRows: unknown[]) => {
    let currentRows = initialRows;
    const query = {} as ReservationAwaitable;
    query.eq = vi.fn((column: string, value: unknown) => {
      currentRows = filterRowsByEq(currentRows, column, value);
      return query;
    });
    query.not = vi.fn((column: string, operator: string, value: unknown) => {
      currentRows = filterRowsByNot(currentRows, column, operator, value);
      return query;
    });
    query.then = <TResult1 = ReservationResult, TResult2 = never>(
      onfulfilled?: ((value: ReservationResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) =>
      Promise.resolve({ data: currentRows, error: null } as ReservationResult).then(
        onfulfilled ?? undefined,
        onrejected ?? undefined
      );

    return query;
  };

  const reservationSelect = vi.fn(() => createReservationAwaitable(reservations));

  const attemptIn = vi.fn(async () => ({ data: attempts, error: null }));
  const attemptEq = vi.fn(() => ({ in: attemptIn }));
  const attemptQuery: GenerationAttemptQuery = {
    select: vi.fn(() => ({
      eq: attemptEq,
      in: attemptIn,
    })),
  };

  const generationIn = vi.fn(async () => ({ data: generations, error: null }));
  const generationEq = vi.fn(() => ({ in: generationIn }));
  const generationQuery: GenerationQuery = {
    select: vi.fn(() => ({
      eq: generationEq,
      in: generationIn,
    })),
  };

  const reservationQuery: ReservationQuery = {
    select: reservationSelect,
  };

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_credit_reservations") return reservationQuery;
      if (tableName === "generation_attempts") return attemptQuery;
      if (tableName === "ai_generations") return generationQuery;
      throw new Error(`Unexpected table: ${tableName}`);
    }),
    spies: {
      reservationSelect,
      attemptSelect: attemptQuery.select,
      generationSelect: generationQuery.select,
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
      provider: "fal",
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
    expect(supabase.spies.attemptSelect).not.toHaveBeenCalled();
    expect(supabase.spies.generationSelect).not.toHaveBeenCalled();
  });

  it("can ignore unattached reservations for queue dispatch capacity reads", async () => {
    const nowMs = Date.parse("2026-03-04T12:00:00.000Z");
    const supabase = buildSupabaseMock({
      reservations: [
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: null,
          created_at: "2026-03-04T11:59:50.000Z",
        },
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: null,
          created_at: "2026-03-04T11:59:40.000Z",
        },
      ],
      generations: [],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      userId: "user-1",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      includeUnattachedReservations: false,
      staleIgnoreMinAgeSeconds: 7200,
      orphanGraceSeconds: 60,
      nowMs,
    });

    expect(snapshot).toEqual({
      tier: "image_heavy",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    expect(supabase.spies.reservationSelect).toHaveBeenCalled();
    const reservationQuery = supabase.spies.reservationSelect.mock.results[0]?.value;
    const scopedReservationQuery = reservationQuery?.eq?.mock?.results?.[0]?.value;
    expect(scopedReservationQuery.not).toHaveBeenCalledWith("provider_request_id", "is", null);
    expect(supabase.spies.attemptSelect).not.toHaveBeenCalled();
    expect(supabase.spies.generationSelect).not.toHaveBeenCalled();
  });

  it("ignores stale provider-attached holds while preserving active and grace-window holds", async () => {
    const nowMs = Date.parse("2026-03-04T12:00:00.000Z");
    const supabase = buildSupabaseMock({
      reservations: [
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-active",
          created_at: "2026-03-04T11:59:50.000Z",
        },
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-terminal",
          created_at: "2026-03-04T08:00:00.000Z",
        },
        {
          user_id: "user-1",
          model_id: "fal-ai/nano-banana-2/edit",
          provider_request_id: "req-orphan-old",
          created_at: "2026-03-03T08:00:00.000Z",
        },
        {
          user_id: "user-1",
          model_id: "fal-ai/nano-banana-2/edit",
          provider_request_id: "req-orphan-new",
          created_at: "2026-03-04T11:59:30.000Z",
        },
      ],
      attempts: [
        {
          user_id: "user-1",
          provider_request_id: "req-active",
          generation_id: "gen-active",
        },
        {
          user_id: "user-1",
          provider_request_id: "req-terminal",
          generation_id: "gen-terminal",
        },
      ],
      generations: [
        {
          user_id: "user-1",
          id: "gen-active",
          status: "running",
          recovery_state: "recovering",
        },
        {
          user_id: "user-1",
          id: "gen-terminal",
          status: "fail",
          recovery_state: "exhausted",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      userId: "user-1",
      provider: "fal",
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

  it("ignores provider-linked running holds once they exceed the stale active threshold", async () => {
    const nowMs = Date.parse("2026-03-25T12:00:00.000Z");
    const supabase = buildSupabaseMock({
      reservations: [
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-stale-running",
          created_at: "2026-03-25T08:00:00.000Z",
        },
      ],
      attempts: [
        {
          user_id: "user-1",
          provider_request_id: "req-stale-running",
          generation_id: "gen-stale-running",
        },
      ],
      generations: [
        {
          user_id: "user-1",
          id: "gen-stale-running",
          status: "running",
          recovery_state: "queued",
          created_at: "2026-03-25T08:00:00.000Z",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      userId: "user-1",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      staleIgnoreMinAgeSeconds: 1200,
      activeGenerationStaleIgnoreMinAgeSeconds: 7200,
      orphanGraceSeconds: 60,
      nowMs,
    });

    expect(snapshot).toEqual({
      tier: "image_heavy",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 1,
      staleIgnoredTier: 1,
    });
  });

  it("fails closed when generation_attempts lookup is unavailable", async () => {
    const reservationResult = Promise.resolve({
      data: [
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-legacy",
          created_at: "2026-03-25T11:59:30.000Z",
        },
      ],
      error: null,
    });
    const reservationEq2 = vi.fn(() => reservationResult);
    const reservationEq1 = vi.fn(() => ({
      eq: reservationEq2,
      then: reservationResult.then.bind(reservationResult),
    }));
    const reservationSelect = vi.fn(() => ({ eq: reservationEq1 }));

    const attemptIn = vi.fn(async () => ({
      data: null,
      error: { code: "42P01", message: "relation generation_attempts does not exist" },
    }));
    const attemptEq = vi.fn(() => ({ in: attemptIn }));
    const attemptSelect = vi.fn(() => ({ eq: attemptEq }));

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((tableName: string) => {
        if (tableName === "ai_credit_reservations") return { select: reservationSelect };
        if (tableName === "generation_attempts") return { select: attemptSelect };
        throw new Error(`Unexpected table: ${tableName}`);
      }),
    });

    await expect(
      readActiveProviderCapacitySnapshot({
        userId: "user-1",
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        staleIgnoreMinAgeSeconds: 1200,
        orphanGraceSeconds: 60,
        nowMs: Date.parse("2026-03-25T12:00:00.000Z"),
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "42P01",
        message: "relation generation_attempts does not exist",
      })
    );
  });

  it("reads shared-provider capacity across users while excluding other provider families", async () => {
    const nowMs = Date.parse("2026-03-25T12:00:00.000Z");
    const supabase = buildSupabaseMock({
      reservations: [
        {
          user_id: "user-1",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          provider_request_id: "req-fal-active",
          created_at: "2026-03-25T11:59:30.000Z",
        },
        {
          user_id: "user-2",
          model_id: "fal-ai/nano-banana",
          provider_request_id: null,
          created_at: "2026-03-25T11:59:40.000Z",
        },
        {
          user_id: "user-3",
          model_id: "kie-ai/kling-video/v2/master/image-to-video",
          provider_request_id: "req-kie-active",
          created_at: "2026-03-25T11:59:30.000Z",
        },
      ],
      attempts: [
        {
          user_id: "user-1",
          provider_request_id: "req-fal-active",
          generation_id: "gen-fal-active",
        },
        {
          user_id: "user-3",
          provider_request_id: "req-kie-active",
          generation_id: "gen-kie-active",
        },
      ],
      generations: [
        {
          user_id: "user-1",
          id: "gen-fal-active",
          status: "running",
          recovery_state: "recovering",
          created_at: "2026-03-25T11:59:30.000Z",
        },
        {
          user_id: "user-3",
          id: "gen-kie-active",
          status: "running",
          recovery_state: "recovering",
          created_at: "2026-03-25T11:59:30.000Z",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const snapshot = await readActiveProviderCapacitySnapshot({
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      staleIgnoreMinAgeSeconds: 1200,
      orphanGraceSeconds: 60,
      nowMs,
    });

    expect(snapshot).toEqual({
      tier: "image_heavy",
      globalActive: 3,
      tierActive: 1,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
  });
});
