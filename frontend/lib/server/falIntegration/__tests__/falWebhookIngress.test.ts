import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestFalWebhookEvent, parseFalWebhookPayload } from "../falWebhookIngress";

const getSupabaseAdminMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const persistGenerationObservationMock = vi.fn();
const readRecoveryGenerationRowMock = vi.fn();
const requestGenerationControlPlaneWakeMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../../api/generationObservationInbox", () => ({
  persistGenerationObservation: (...args: unknown[]) => persistGenerationObservationMock(...args),
}));

vi.mock("../recoveryGenerationLookup", () => ({
  readRecoveryGenerationRow: (...args: unknown[]) => readRecoveryGenerationRowMock(...args),
}));

vi.mock("../../generationControlPlane/controlPlaneWake", () => ({
  requestGenerationControlPlaneWake: (...args: unknown[]) =>
    requestGenerationControlPlaneWakeMock(...args),
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
    readRecoveryGenerationRowMock.mockResolvedValue(null);
    requestGenerationControlPlaneWakeMock.mockResolvedValue(undefined);
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

  it("persists terminal events into the observation inbox and wakes the control plane", async () => {
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
    expect(supabase.updateEq).toHaveBeenCalled();
  });
});
