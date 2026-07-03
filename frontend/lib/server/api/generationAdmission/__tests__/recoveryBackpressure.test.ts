import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRecoveryBackpressureDecision } from "../recoveryBackpressure";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type ReservationCountBuilder = {
  eq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
};

type GenerationCountBuilder = {
  in: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
};

type AppErrorEventBuilder = {
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
};

const createReservationCountBuilder = (): ReservationCountBuilder => {
  const builder = {} as ReservationCountBuilder;
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.ilike = vi.fn(async () => ({ count: 0, error: null }));
  return builder;
};

const createGenerationCountBuilder = (): GenerationCountBuilder => {
  const builder = {} as GenerationCountBuilder;
  builder.in = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.ilike = vi.fn(async () => ({ count: 0, error: null }));
  return builder;
};

describe("readRecoveryBackpressureDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads scalar telemetry fields without hydrating raw app-error metadata", async () => {
    const appErrorSelects: string[] = [];
    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === "ai_credit_reservations") {
          const builder = createReservationCountBuilder();
          return {
            select: vi.fn(() => builder),
          };
        }

        if (table === "ai_generations") {
          const builder = createGenerationCountBuilder();
          return {
            select: vi.fn(() => builder),
          };
        }

        if (table === "app_error_events") {
          return {
            select: vi.fn((columns: string) => {
              appErrorSelects.push(columns);
              const builder = {} as AppErrorEventBuilder;
              builder.eq = vi.fn(() => builder);
              builder.gte = vi.fn(async () => {
                if (columns.includes("error_code:metadata->>error_code")) {
                  return {
                    data: [
                      {
                        error_code: "queue_wait_timeout",
                        model_id: "fal-ai/flux-2/klein/9b",
                      },
                      {
                        error_code: "QUEUE_WAIT_TIMEOUT",
                        model_id: "kie-ai/seedance-2",
                      },
                      {
                        error_code: "OTHER",
                        model_id: "fal-ai/flux-2/klein/9b",
                      },
                    ],
                    error: null,
                  };
                }
                return {
                  data: [
                    {
                      provider: "fal",
                      model_id: null,
                      provider_terminal_to_media_visible_ms: "450000",
                    },
                    {
                      provider: null,
                      model_id: "fal-ai/flux-2/klein/9b",
                      provider_terminal_to_media_visible_ms: 360000,
                    },
                    {
                      provider: "kie",
                      model_id: "kie-ai/seedance-2",
                      provider_terminal_to_media_visible_ms: 900000,
                    },
                  ],
                  error: null,
                };
              });
              return builder;
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    getSupabaseAdminMock.mockReturnValue(supabaseAdmin);

    await expect(
      readRecoveryBackpressureDecision({
        provider: "fal",
        requestedGlobalMax: 4,
        nowMs: Date.parse("2026-07-03T12:00:00.000Z"),
      })
    ).resolves.toEqual({
      level: 1,
      requestedGlobalMax: 4,
      effectiveGlobalMax: 3,
      reduction: 1,
      signals: {
        staleProviderAttachedReservations: 0,
        staleRecoverableGenerations: 0,
        recentQueueWaitTimeouts: 1,
        recentRecoveryP95Ms: 450000,
      },
    });

    expect(appErrorSelects).toEqual([
      "error_code:metadata->>error_code, model_id:metadata->>model_id",
      "provider:metadata->>provider, model_id:metadata->>model_id, provider_terminal_to_media_visible_ms:metadata->>provider_terminal_to_media_visible_ms",
    ]);
    expect(appErrorSelects).not.toContain("metadata");
  });
});
