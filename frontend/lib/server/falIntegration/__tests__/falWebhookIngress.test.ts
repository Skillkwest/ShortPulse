import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestFalWebhookEvent, parseFalWebhookPayload } from "../falWebhookIngress";

const getSupabaseAdminMock = vi.fn();
const resolveGenerationLineageByProviderRequestMock = vi.fn();
const persistGenerationObservationMock = vi.fn();
const readPersistedGenerationStatusContextMock = vi.fn();
const readRecoveryGenerationRowMock = vi.fn();
const requestGenerationControlPlaneWakeMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/generationLineageResolver", () => ({
  resolveGenerationLineageByProviderRequest: (...args: unknown[]) =>
    resolveGenerationLineageByProviderRequestMock(...args),
}));

vi.mock("../../api/generationObservationInbox", () => ({
  persistGenerationObservation: (...args: unknown[]) => persistGenerationObservationMock(...args),
}));

vi.mock("../../api/falStatusPersistedResults", () => ({
  readPersistedGenerationStatusContext: (...args: unknown[]) =>
    readPersistedGenerationStatusContextMock(...args),
}));

vi.mock("../recoveryGenerationLookup", () => ({
  readRecoveryGenerationRow: (...args: unknown[]) => readRecoveryGenerationRowMock(...args),
}));

vi.mock("../../generationControlPlane/controlPlaneWake", () => ({
  requestGenerationControlPlaneWake: (...args: unknown[]) =>
    requestGenerationControlPlaneWakeMock(...args),
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
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: null,
      generationAttemptId: null,
      userId: null,
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-1",
      evidence: [],
      attemptLookupError: null,
    });
    persistGenerationObservationMock.mockResolvedValue(undefined);
    readPersistedGenerationStatusContextMock.mockResolvedValue({
      generationId: "gen-1",
      resultUrls: ["https://cdn.shortpulse.test/output.png"],
      taskState: "success",
    });
    readRecoveryGenerationRowMock.mockResolvedValue(null);
    requestGenerationControlPlaneWakeMock.mockResolvedValue(undefined);
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      generationId: "gen-1",
      requestId: "req-1",
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    });
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

  it("synthesizes an event id when Fal omits one but request id is present", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: "gen-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
    readPersistedGenerationStatusContextMock.mockResolvedValue({
      generationId: "gen-1",
      resultUrls: [],
      taskState: "running",
    });

    await expect(
      ingestFalWebhookEvent({
        payload: parseFalWebhookPayload(
          JSON.stringify({
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
          eventId: null,
          timestamp: "123",
        },
        verificationMethod: "fal",
        payloadHash: "hash-1",
        maxAttempts: 5,
      })
    ).resolves.toEqual({
      kind: "accepted",
      requestId: "req-1",
      status: "completed",
    });

    expect(persistGenerationObservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^fal:webhook:synthetic:req-1:/),
        providerRequestId: "req-1",
      })
    );
    expect(supabase.updateEq).toHaveBeenCalledWith(
      "event_id",
      expect.stringMatching(/^synthetic:req-1:/)
    );
  });

  it("skips fallback observation when immediate webhook recovery settles canonical success", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: "gen-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
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
      kind: "accepted",
      requestId: "req-1",
      status: "completed",
    });
    expect(persistGenerationObservationMock).not.toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "webhook",
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      observation: {
        state: "completed",
        payload: expect.any(Object),
        mediaUrls: ["https://cdn.shortpulse.test/output.png"],
      },
      routeLabel: "fal/webhook",
    });
    expect(requestGenerationControlPlaneWakeMock).not.toHaveBeenCalled();
    expect(supabase.updateEq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("persists terminal events into the observation inbox and wakes the control plane when immediate recovery does not settle", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: "gen-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
    readPersistedGenerationStatusContextMock.mockResolvedValue({
      generationId: "gen-1",
      resultUrls: [],
      taskState: "running",
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
      kind: "accepted",
      requestId: "req-1",
      status: "completed",
    });
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
    expect(requestGenerationControlPlaneWakeMock).toHaveBeenCalledWith({
      routeLabel: "fal/webhook",
      reason: "webhook_observation",
    });
    expect(supabase.updateEq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("passes extracted Fal media URLs into immediate webhook recovery", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ from: supabase.from });
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: "gen-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });

    await ingestFalWebhookEvent({
      payload: parseFalWebhookPayload(
        JSON.stringify({
          id: "event-1",
          request_id: "req-1",
          status: "OK",
          payload: {
            images: [{ url: "https://cdn.shortpulse.test/from-webhook.png" }],
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
    });

    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        observation: expect.objectContaining({
          mediaUrls: ["https://cdn.shortpulse.test/from-webhook.png"],
        }),
      })
    );
  });
});
