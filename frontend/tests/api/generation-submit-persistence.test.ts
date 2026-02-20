import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSubmittedGenerationRecord } from "../../lib/server/api/generationSubmitPersistence";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

type TableMockConfig = {
  selectResponses?: Array<{ data: unknown; error: unknown }>;
  insertResponses?: Array<{ data: unknown; error: unknown }>;
  updateResponses?: Array<{ error: unknown }>;
};

const createAiGenerationsTableMock = (config: TableMockConfig) => {
  const selectResponses = [...(config.selectResponses ?? [])];
  const insertResponses = [...(config.insertResponses ?? [])];
  const updateResponses = [...(config.updateResponses ?? [])];
  const insertPayloads: Record<string, unknown>[] = [];
  const updatePayloads: Record<string, unknown>[] = [];

  const table = {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.eq = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      builder.limit = vi.fn(async () => selectResponses.shift() ?? { data: [], error: null });
      return builder;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      insertPayloads.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => insertResponses.shift() ?? { data: null, error: null }),
        })),
      };
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayloads.push(payload);
      const secondEq = vi.fn(async () => updateResponses.shift() ?? { error: null });
      return {
        eq: vi.fn(() => ({
          eq: secondEq,
        })),
      };
    }),
  };

  return {
    table,
    insertPayloads,
    updatePayloads,
  };
};

describe("ensureSubmittedGenerationRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues recovery metadata and scheduling fields when inserting a fresh generation row", async () => {
    const aiGenerations = createAiGenerationsTableMock({
      selectResponses: [{ data: [], error: null }],
      insertResponses: [{ data: { id: "gen-1" }, error: null }],
    });

    getSupabaseAdminMock.mockReturnValue({
      from: (tableName: string) => {
        if (tableName === "ai_generations") return aiGenerations.table;
        throw new Error(`unexpected table ${tableName}`);
      },
    });

    const result = await ensureSubmittedGenerationRecord({
      userId: "user-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      routeLabel: "Fal Seedream edit",
      payload: {
        prompt: "Stylize this frame",
        aspect_ratio: "9:16",
        image_urls: ["https://cdn.test/image.png"],
      },
      providerRequestId: "req-1",
      sourceRef: "source-1",
      submitTargetUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit",
      submitTargetIndex: 0,
    });

    expect(result).toEqual({ ok: true, generationId: "gen-1" });
    expect(aiGenerations.insertPayloads).toHaveLength(1);
    const payload = aiGenerations.insertPayloads[0] ?? {};
    expect(payload).toEqual(
      expect.objectContaining({
        user_id: "user-1",
        request_id: "req-1",
        status: "running",
        failure_reason_code: null,
        recovery_state: "queued",
        recovery_attempts: 0,
        last_recovery_at: null,
        last_media_detected_at: null,
      })
    );
    expect(typeof payload.next_recovery_at).toBe("string");
    expect(payload.metadata).toEqual(
      expect.objectContaining({
        source_ref: "source-1",
        provider_request_id: "req-1",
        recovery_queue_reason: "submit_persisted",
      })
    );
  });
});
