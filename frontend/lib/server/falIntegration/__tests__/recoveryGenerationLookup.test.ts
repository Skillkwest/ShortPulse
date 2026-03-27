import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRecoveryGenerationRow } from "../recoveryGenerationLookup";

const getSupabaseAdminMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

const createLookupAdmin = (responses: Array<{ data: unknown; error: unknown }>) => {
  const queue = [...responses];
  const limit = vi.fn(async () => queue.shift() ?? { data: [], error: null });
  const builder: Record<string, unknown> = {};
  const eq = vi.fn(() => builder);
  builder.eq = eq;
  builder.order = vi.fn(() => builder);
  builder.limit = limit;
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  return {
    admin: { from },
    select,
    eq,
    builder,
    limit,
  };
};

const fullRow = {
  id: "gen-1",
  created_at: "2026-03-02T17:00:00.000Z",
  user_id: "user-1",
  request_id: "req-1",
  model_id: "fal-ai/nano-banana-pro",
  provider: "fal",
  mode: "image",
  prompt_text: "cinematic portrait",
  status: "running",
  metadata: { foo: "bar" },
  recovery_attempts: 2,
  recovery_state: "recovering",
  failure_reason_code: null,
  completed_at: null,
};

describe("readRecoveryGenerationRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
  });

  it("reads by generation id with optional user scoping and parses typed row", async () => {
    const lookup = createLookupAdmin([{ data: [fullRow], error: null }]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    const row = await readRecoveryGenerationRow({
      generationId: "gen-1",
      userId: "user-1",
    });

    expect(lookup.eq).toHaveBeenNthCalledWith(1, "id", "gen-1");
    expect(lookup.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(row).toEqual(
      expect.objectContaining({
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
        metadata: { foo: "bar" },
        recovery_attempts: 2,
        recovery_state: "recovering",
      })
    );
  });

  it("reads by request id when generation id is absent", async () => {
    const lookup = createLookupAdmin([{ data: [fullRow], error: null }]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    const row = await readRecoveryGenerationRow({
      requestId: "req-1",
    });

    expect(lookup.eq).toHaveBeenNthCalledWith(1, "request_id", "req-1");
    expect(row?.id).toBe("gen-1");
  });

  it("resolves request-id lookup through generation_attempts before legacy ai_generations.request_id", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-1",
      },
      error: null,
    });
    const lookup = createLookupAdmin([{ data: [fullRow], error: null }]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    const row = await readRecoveryGenerationRow({
      requestId: "req-1",
      userId: "user-1",
    });

    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenCalledWith({
      providerRequestId: "req-1",
      userId: "user-1",
    });
    expect(lookup.eq).toHaveBeenNthCalledWith(1, "id", "gen-1");
    expect(lookup.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(row?.id).toBe("gen-1");
  });

  it("returns null when both generation id and request id are absent", async () => {
    const lookup = createLookupAdmin([]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    const row = await readRecoveryGenerationRow({});

    expect(row).toBeNull();
    expect(lookup.select).not.toHaveBeenCalled();
  });

  it("returns null when row is missing required fields", async () => {
    const lookup = createLookupAdmin([
      {
        data: [{ ...fullRow, prompt_text: null }],
        error: null,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    const row = await readRecoveryGenerationRow({ generationId: "gen-1" });

    expect(row).toBeNull();
  });

  it("throws on supabase query error", async () => {
    const lookup = createLookupAdmin([{ data: null, error: new Error("db down") }]);
    getSupabaseAdminMock.mockReturnValue(lookup.admin);

    await expect(readRecoveryGenerationRow({ generationId: "gen-1" })).rejects.toThrow("db down");
  });
});
