import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginOpenAiInternalCapacityAttempt,
  extractOpenAiInternalCapacityUsage,
  mergeOpenAiInternalCapacityUsage,
  OpenAiInternalCapacityError,
  reserveOpenAiInternalCapacity,
  settleOpenAiInternalCapacity,
} from "../openAiInternalCapacityAdmission";

const rpcMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const row = {
  id: "admission-1",
  user_id: "user-1",
  eligibility_kind: "paid",
  route_lane: "ai.extract-style",
  source_ref: "request-1",
  idempotency_key: "request-1",
  internal_budget_microusd: 25000,
  max_attempts: 2,
  attempt_count: 0,
  status: "reserved",
  expires_at: "2026-07-10T20:00:00.000Z",
};

describe("openAiInternalCapacityAdmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({ data: row, error: null });
  });

  it("normalizes and aggregates provider token usage without retaining payload data", () => {
    const responsesUsage = extractOpenAiInternalCapacityUsage({
      usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
      output: [{ private: "must not persist" }],
    });
    const chatUsage = extractOpenAiInternalCapacityUsage({
      usage: { prompt_tokens: 7, completion_tokens: 3 },
    });

    expect(responsesUsage).toEqual({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
    expect(mergeOpenAiInternalCapacityUsage(responsesUsage, chatUsage)).toEqual({
      inputTokens: 17,
      outputTokens: 7,
      totalTokens: 24,
    });
  });

  it("reserves internal capacity without any customer-credit parameter", async () => {
    await expect(
      reserveOpenAiInternalCapacity({
        userId: "user-1",
        routeLane: "ai.extract-style",
        sourceRef: "request-1",
        idempotencyKey: "request-1",
        internalBudgetMicrousd: 25000,
        maxAttempts: 2,
      })
    ).resolves.toMatchObject({ id: "admission-1", status: "reserved" });

    expect(rpcMock).toHaveBeenCalledWith("reserve_openai_internal_capacity_admission", {
      p_user_id: "user-1",
      p_route_lane: "ai.extract-style",
      p_source_ref: "request-1",
      p_idempotency_key: "request-1",
      p_internal_budget_microusd: 25000,
      p_max_attempts: 2,
      p_ttl_seconds: 900,
    });
    expect(JSON.stringify(rpcMock.mock.calls[0])).not.toMatch(/credit|balance|debit/i);
  });

  it("begins attempts through the atomic RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { ...row, status: "in_progress", attempt_count: 1 },
      error: null,
    });

    await expect(
      beginOpenAiInternalCapacityAttempt({ admissionId: "admission-1", userId: "user-1" })
    ).resolves.toMatchObject({ status: "in_progress", attemptCount: 1 });
    expect(rpcMock).toHaveBeenCalledWith("begin_openai_internal_capacity_attempt", {
      p_admission_id: "admission-1",
      p_user_id: "user-1",
    });
  });

  it("settles with sanitized numeric usage only", async () => {
    rpcMock.mockResolvedValue({
      data: { ...row, status: "completed", attempt_count: 1 },
      error: null,
    });

    await settleOpenAiInternalCapacity({
      admissionId: "admission-1",
      userId: "user-1",
      status: "completed",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        requestCount: 1,
        estimatedCostMicrousd: 120,
      },
    });

    expect(rpcMock).toHaveBeenCalledWith("settle_openai_internal_capacity_admission", {
      p_admission_id: "admission-1",
      p_user_id: "user-1",
      p_status: "completed",
      p_usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        request_count: 1,
        estimated_cost_microusd: 120,
      },
    });
  });

  it("fails closed on RPC errors or malformed rows", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });
    await expect(
      beginOpenAiInternalCapacityAttempt({ admissionId: "admission-1", userId: "user-1" })
    ).rejects.toMatchObject({
      status: 503,
      code: "OPENAI_INTERNAL_CAPACITY_UNAVAILABLE",
    } satisfies Partial<OpenAiInternalCapacityError>);

    rpcMock.mockResolvedValueOnce({ data: { id: "partial" }, error: null });
    await expect(
      beginOpenAiInternalCapacityAttempt({ admissionId: "admission-1", userId: "user-1" })
    ).rejects.toMatchObject({
      status: 503,
      code: "OPENAI_INTERNAL_CAPACITY_UNAVAILABLE",
    } satisfies Partial<OpenAiInternalCapacityError>);
  });

  it("maps paid-access and durable allowance denials without exposing database errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: new Error("Paid OpenAI internal-capacity access is required."),
    });
    await expect(
      reserveOpenAiInternalCapacity({
        userId: "baseline-user",
        routeLane: "ai.extract-style",
        sourceRef: "request-2",
        idempotencyKey: "request-2",
        internalBudgetMicrousd: 25000,
        maxAttempts: 2,
      })
    ).rejects.toMatchObject({ status: 402, code: "OPENAI_PAID_ACCESS_REQUIRED" });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "OpenAI internal-capacity allowance is exhausted.", code: "P0001" },
    });
    await expect(
      reserveOpenAiInternalCapacity({
        userId: "paid-user",
        routeLane: "ai.extract-style",
        sourceRef: "request-3",
        idempotencyKey: "request-3",
        internalBudgetMicrousd: 25000,
        maxAttempts: 2,
      })
    ).rejects.toMatchObject({ status: 429, code: "OPENAI_INTERNAL_CAPACITY_EXHAUSTED" });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { details: "OpenAI internal-capacity attempt limit reached.", code: "P0001" },
    });
    await expect(
      beginOpenAiInternalCapacityAttempt({ admissionId: "admission-1", userId: "paid-user" })
    ).rejects.toMatchObject({ status: 429, code: "OPENAI_INTERNAL_CAPACITY_EXHAUSTED" });
  });
});
