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

  it("updates accepted-running attempts by known attempt id without re-reading by provider request id", async () => {
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
    }) => {
      const query = {
        eq: vi.fn((field: string, value: string) =>
          buildQuery({ columns, filters: [...filters, [field, value]] })
        ),
        order: vi.fn(() => buildQuery({ columns, filters })),
        limit: vi.fn(() => buildQuery({ columns, filters })),
        maybeSingle: vi.fn(async () => {
          if (columns === "id, attempt_number, metadata") {
            return {
              data: {
                id: null,
                attempt_number: null,
                metadata: null,
              },
              error: null,
            };
          }

          if (columns === "id, attempt_number") {
            return {
              data: {
                id: "attempt-prev",
                attempt_number: 0,
              },
              error: null,
            };
          }

          if (
            columns === "id, generation_id, user_id, attempt_number, provider_request_id, metadata"
          ) {
            throw new Error("unexpected provider request lookup");
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
          insert: vi.fn((_payload: Record<string, unknown>) => ({
            select: vi.fn((_columns: string) => ({
              single: vi.fn(async () => ({
                data: {
                  id: "attempt-1",
                  attempt_number: 1,
                },
                error: null,
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
      modelId: "fal-ai/nano-banana",
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
    expect(selectCalls).toEqual(["id, attempt_number, metadata", "id, attempt_number"]);
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
            provider_request_id: "req-1",
            source_ref: "source-1",
          },
        }),
      })
    );
  });
});
