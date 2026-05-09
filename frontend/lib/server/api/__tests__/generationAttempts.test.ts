import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAcceptedRunningGenerationAttempt } from "../generationAttempts";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

describe("generationAttempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts accepted-running attempts without a pre-insert provider request lookup", async () => {
    const selectCalls: string[] = [];
    const insertCalls: Array<Record<string, unknown>> = [];
    const updateCalls: Array<{
      payload: Record<string, unknown>;
      filters: Array<[string, string]>;
    }> = [];

    const buildQuery = ({
      columns,
      filters = [],
    }: {
      columns: string;
      filters?: Array<[string, string]>;
    }): unknown => {
      const query = {
        eq: vi.fn((field: string, value: string) =>
          buildQuery({ columns, filters: [...filters, [field, value]] })
        ),
        order: vi.fn(() => buildQuery({ columns, filters })),
        limit: vi.fn(() => buildQuery({ columns, filters })),
        maybeSingle: vi.fn(async () => {
          if (columns === "id, attempt_number") {
            return {
              data: {
                id: "attempt-prev",
                attempt_number: 0,
              },
              error: null,
            };
          }

          if (columns === "id, attempt_number, metadata") {
            throw new Error("unexpected provider request prelookup");
          }

          throw new Error(`unexpected select columns: ${columns}`);
        }),
      };
      return query;
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((tableName: string) => {
        if (tableName !== "generation_attempts") {
          throw new Error(`unexpected table ${tableName}`);
        }
        return {
          select: vi.fn((columns: string) => {
            selectCalls.push(columns);
            return buildQuery({ columns });
          }),
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertCalls.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "attempt-1",
                    attempt_number: 1,
                  },
                  error: null,
                })),
              })),
            };
          }),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn((field: string, value: string) => ({
              eq: vi.fn((field2: string, value2: string) => {
                updateCalls.push({
                  payload,
                  filters: [
                    [field, value],
                    [field2, value2],
                  ],
                });
                return Promise.resolve({ error: null });
              }),
            })),
          })),
        };
      }),
    });

    const result = await ensureAcceptedRunningGenerationAttempt({
      generationId: "gen-1",
      userId: "user-1",
      provider: "fal",
      modelId: "fal-ai/nano-banana-2",
      providerRequestId: "req-1",
      dispatchSource: "queued_submit",
      metadata: {
        source_ref: "source-1",
      },
    });

    expect(result).toEqual({
      ok: true,
      attemptId: "attempt-1",
      attemptNumber: 1,
      metadata: {
        provider_request_id: "req-1",
        source_ref: "source-1",
      },
    });
    expect(selectCalls).toEqual(["id, attempt_number"]);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toEqual(
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        attempt_number: 1,
        provider: "fal",
        model_id: "fal-ai/nano-banana-2",
        provider_request_id: "req-1",
        status: "running",
        dispatch_source: "queued_submit",
        metadata: {
          provider_request_id: "req-1",
          source_ref: "source-1",
        },
        submitted_at: expect.any(String),
        started_at: expect.any(String),
        last_observed_at: expect.any(String),
      })
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("updates an existing accepted-running attempt after duplicate insert fallback", async () => {
    const selectCalls: string[] = [];
    const updateCalls: Array<{
      payload: Record<string, unknown>;
      filters: Array<[string, string]>;
    }> = [];

    const buildQuery = ({
      columns,
      filters = [],
    }: {
      columns: string;
      filters?: Array<[string, string]>;
    }): unknown => {
      const query = {
        eq: vi.fn((field: string, value: string) =>
          buildQuery({ columns, filters: [...filters, [field, value]] })
        ),
        order: vi.fn(() => buildQuery({ columns, filters })),
        limit: vi.fn(() => buildQuery({ columns, filters })),
        maybeSingle: vi.fn(async () => {
          if (columns === "id, attempt_number") {
            return {
              data: {
                id: "attempt-prev",
                attempt_number: 1,
              },
              error: null,
            };
          }
          if (columns === "id, attempt_number, metadata") {
            return {
              data: {
                id: "attempt-1",
                attempt_number: 1,
                metadata: {
                  existing: "value",
                },
              },
              error: null,
            };
          }
          throw new Error(`unexpected select columns: ${columns}`);
        }),
      };
      return query;
    };

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((tableName: string) => {
        if (tableName !== "generation_attempts") {
          throw new Error(`unexpected table ${tableName}`);
        }
        return {
          select: vi.fn((columns: string) => {
            selectCalls.push(columns);
            return buildQuery({ columns });
          }),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: {
                  code: "23505",
                  message: "duplicate key value violates unique constraint",
                },
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn((field: string, value: string) => ({
              eq: vi.fn((field2: string, value2: string) => {
                updateCalls.push({
                  payload,
                  filters: [
                    [field, value],
                    [field2, value2],
                  ],
                });
                return Promise.resolve({ error: null });
              }),
            })),
          })),
        };
      }),
    });

    const result = await ensureAcceptedRunningGenerationAttempt({
      generationId: "gen-1",
      userId: "user-1",
      provider: "fal",
      modelId: "fal-ai/nano-banana-2",
      providerRequestId: "req-1",
      dispatchSource: "queued_submit",
      metadata: {
        source_ref: "source-1",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        attemptId: "attempt-1",
        attemptNumber: 1,
        metadata: {
          existing: "value",
          provider_request_id: "req-1",
          source_ref: "source-1",
        },
      })
    );
    expect(selectCalls).toEqual(["id, attempt_number", "id, attempt_number, metadata"]);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual(
      expect.objectContaining({
        filters: [
          ["id", "attempt-1"],
          ["user_id", "user-1"],
        ],
        payload: expect.objectContaining({
          status: "running",
          metadata: {
            existing: "value",
            provider_request_id: "req-1",
            source_ref: "source-1",
          },
          started_at: expect.any(String),
          last_observed_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      })
    );
  });
});
