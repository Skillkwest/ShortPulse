import { beforeEach, describe, expect, it, vi } from "vitest";
import { markQueueItemExhausted } from "../generationQueue/service";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createUpdateChain = ({
  data,
  error,
}: {
  data: unknown[] | null;
  error: { message?: string | null } | null;
}) => {
  const select = vi.fn(async () => ({ data, error }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { eq, from, select, update };
};

describe("generationQueue/service historical cleanup helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a historical pre-provider queue row exhausted", async () => {
    const chain = createUpdateChain({ data: [{ id: "queue-1" }], error: null });
    getSupabaseAdminMock.mockReturnValue({ from: chain.from });

    await expect(
      markQueueItemExhausted({
        queueId: "queue-1",
        attempts: 3,
        lastError: "retired",
        lastErrorCode: "pre_provider_queue_retired",
      })
    ).resolves.toEqual({
      ok: true,
      operation: "exhaust",
      queueId: "queue-1",
      affectedCount: 1,
      reason: "applied",
      errorMessage: null,
    });

    expect(chain.from).toHaveBeenCalledWith("ai_generation_submit_queue");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "exhausted",
        attempts: 3,
        lease_until: null,
        last_error: "retired",
        last_error_code: "pre_provider_queue_retired",
      })
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "queue-1");
  });

  it("reports db errors without throwing", async () => {
    const chain = createUpdateChain({
      data: null,
      error: { message: "database unavailable" },
    });
    getSupabaseAdminMock.mockReturnValue({ from: chain.from });

    await expect(
      markQueueItemExhausted({
        queueId: "queue-1",
        attempts: 1,
        lastError: "retired",
      })
    ).resolves.toEqual({
      ok: false,
      operation: "exhaust",
      queueId: "queue-1",
      affectedCount: 0,
      reason: "db_error",
      errorMessage: "database unavailable",
    });
  });
});
