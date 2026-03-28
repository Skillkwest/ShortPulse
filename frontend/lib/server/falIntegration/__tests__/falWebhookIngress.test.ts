import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestFalWebhookEvent, parseFalWebhookPayload } from "../falWebhookIngress";

const getSupabaseAdminMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

const createSupabaseMock = () => {
  const insertSingle = vi.fn(async () => ({ data: { event_id: "event-1" }, error: null }));
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: insertSingle,
    })),
  }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table !== "fal_webhook_events") throw new Error(`unexpected table ${table}`);
    return { insert, update };
  });
  return { from, insertSingle, updateEq };
};

describe("falWebhookIngress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns duplicate when the event insert conflicts on event id", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: "23505" },
            })),
          })),
        })),
      })),
    });

    await expect(
      ingestFalWebhookEvent({
        payload: parseFalWebhookPayload(
          JSON.stringify({
            id: "event-1",
            request_id: "req-1",
            status: "completed",
          })
        ),
        headers: {
          requestId: "req-1",
          userId: "fal-user-1",
          eventId: "event-1",
          timestamp: "123",
        },
        verificationMethod: "fal",
        payloadHash: "hash-1",
        maxAttempts: 5,
      })
    ).resolves.toEqual({ kind: "duplicate" });
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
  });

  it("marks missing request id events as ignored", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });

    await expect(
      ingestFalWebhookEvent({
        payload: parseFalWebhookPayload(
          JSON.stringify({
            id: "event-1",
            status: "completed",
          })
        ),
        headers: {
          requestId: null,
          userId: "fal-user-1",
          eventId: "event-1",
          timestamp: "123",
        },
        verificationMethod: "fal",
        payloadHash: "hash-1",
        maxAttempts: 5,
      })
    ).resolves.toEqual({ kind: "ignored", reason: "missing_request_id" });
    expect(supabase.updateEq).toHaveBeenCalled();
  });

  it("processes terminal events through the shared recovery engine", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      requestId: "req-1",
      generationId: "gen-1",
      mediaFileIds: ["media-1"],
      mediaUrls: ["https://cdn.shortpulse.test/output.png"],
      processed: true,
    });

    await expect(
      ingestFalWebhookEvent({
        payload: parseFalWebhookPayload(
          JSON.stringify({
            id: "event-1",
            request_id: "req-1",
            status: "completed",
            payload: {
              images: [{ url: "https://cdn.shortpulse.test/output.png" }],
            },
          })
        ),
        headers: {
          requestId: "req-1",
          userId: "fal-user-1",
          eventId: "event-1",
          timestamp: "123",
        },
        verificationMethod: "fal",
        payloadHash: "hash-1",
        maxAttempts: 5,
      })
    ).resolves.toEqual({
      kind: "processed",
      requestId: "req-1",
      status: "recovered",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "webhook",
        requestId: "req-1",
        routeLabel: "fal/webhook",
      })
    );
    expect(supabase.updateEq).toHaveBeenCalled();
  });
});
