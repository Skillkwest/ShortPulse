import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestFalWebhookEvent, parseFalWebhookPayload } from "../falWebhookIngress";

const getSupabaseAdminMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const persistGenerationObservationMock = vi.fn();
const markGenerationObservationProcessingStateMock = vi.fn();
const readRecoveryGenerationRowMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../../api/generationObservationInbox", () => ({
  persistGenerationObservation: (...args: unknown[]) => persistGenerationObservationMock(...args),
  markGenerationObservationProcessingState: (...args: unknown[]) =>
    markGenerationObservationProcessingStateMock(...args),
}));

vi.mock("../recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

vi.mock("../recoveryGenerationLookup", () => ({
  readRecoveryGenerationRow: (...args: unknown[]) => readRecoveryGenerationRowMock(...args),
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
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
    persistGenerationObservationMock.mockResolvedValue(undefined);
    markGenerationObservationProcessingStateMock.mockResolvedValue(undefined);
    readRecoveryGenerationRowMock.mockResolvedValue(null);
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
    expect(persistGenerationObservationMock).not.toHaveBeenCalled();
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
    expect(persistGenerationObservationMock).not.toHaveBeenCalled();
  });

  it("processes terminal events through the shared recovery engine", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        id: "attempt-1",
        generationId: "gen-1",
        userId: "user-1",
        attemptNumber: 1,
        providerRequestId: "req-1",
        metadata: {},
      },
      error: null,
    });
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
    expect(persistGenerationObservationMock).toHaveBeenCalledWith({
      generationId: "gen-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      provider: "fal",
      providerRequestId: "req-1",
      observationSource: "webhook",
      observationType: "completed",
      idempotencyKey: "fal:webhook:event-1",
      payload: expect.any(Object),
    });
    expect(markGenerationObservationProcessingStateMock).toHaveBeenCalledWith({
      idempotencyKey: "fal:webhook:event-1",
      processingState: "processed",
      processingError: null,
    });
    expect(supabase.updateEq).toHaveBeenCalled();
  });

  it("marks observation inbox row failed when recovery execution throws", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    executeGenerationRecoveryMock.mockRejectedValue(new Error("boom"));

    await expect(
      ingestFalWebhookEvent({
        payload: parseFalWebhookPayload(
          JSON.stringify({
            id: "event-2",
            request_id: "req-2",
            status: "completed",
          })
        ),
        headers: {
          requestId: "req-2",
          userId: "fal-user-2",
          eventId: "event-2",
          timestamp: "123",
        },
        verificationMethod: "fal",
        payloadHash: "hash-2",
        maxAttempts: 5,
      })
    ).rejects.toThrow("boom");

    expect(markGenerationObservationProcessingStateMock).toHaveBeenCalledWith({
      idempotencyKey: "fal:webhook:event-2",
      processingState: "failed",
      processingError: "boom",
    });
  });
});
