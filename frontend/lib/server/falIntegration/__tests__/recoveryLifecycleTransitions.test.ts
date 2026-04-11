import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAlreadyPersistedSuccessUpdate,
  buildMissingRequestUpdate,
  buildNoMediaUpdate,
  buildProviderFailedUpdate,
  buildProviderRunningUpdate,
  buildRecoveredSuccessUpdate,
  buildRecoveryQueuePlan,
} from "../recoveryLifecycleTransitions";

describe("recoveryLifecycleTransitions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds queued vs exhausted recovery queue plans", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const queuedPlan = buildRecoveryQueuePlan({
      attempts: 1,
      effectiveMaxAttempts: 3,
      nextDelaySeconds: 120,
    });
    const exhaustedPlan = buildRecoveryQueuePlan({
      attempts: 3,
      effectiveMaxAttempts: 3,
      nextDelaySeconds: 120,
    });

    expect(queuedPlan).toEqual({
      isExhausted: false,
      exhaustionDeferredByMinAge: false,
      recoveryState: "queued",
      nextRecoveryAt: new Date(1_700_000_000_000 + 120_000).toISOString(),
    });
    expect(exhaustedPlan).toEqual({
      isExhausted: true,
      exhaustionDeferredByMinAge: false,
      recoveryState: "exhausted",
      nextRecoveryAt: null,
    });
  });

  it("defers exhaustion when min-age policy is active and row is too young", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const deferredPlan = buildRecoveryQueuePlan({
      attempts: 3,
      effectiveMaxAttempts: 3,
      nextDelaySeconds: 120,
      generationAgeSeconds: 1800,
      exhaustMinAgeSeconds: 7200,
      enforceMinAgeForExhaustion: true,
    });

    expect(deferredPlan).toEqual({
      isExhausted: false,
      exhaustionDeferredByMinAge: true,
      recoveryState: "queued",
      nextRecoveryAt: new Date(1_700_000_000_000 + 120_000).toISOString(),
    });
  });

  it("builds transition update payloads without changing field semantics", () => {
    const nowIso = "2026-02-23T12:00:00.000Z";
    const queuePlan = {
      isExhausted: false,
      exhaustionDeferredByMinAge: false,
      recoveryState: "queued" as const,
      nextRecoveryAt: "2026-02-23T12:02:00.000Z",
    };
    const exhaustedQueuePlan = {
      isExhausted: true,
      exhaustionDeferredByMinAge: false,
      recoveryState: "exhausted" as const,
      nextRecoveryAt: null,
    };

    expect(buildMissingRequestUpdate(nowIso)).toEqual({
      recovery_state: "exhausted",
      failure_reason_code: "recovery_exhausted",
      next_recovery_at: null,
      last_recovery_at: nowIso,
    });

    expect(
      buildAlreadyPersistedSuccessUpdate({
        completedAt: null,
        nowIso,
      })
    ).toEqual({
      status: "success",
      completed_at: nowIso,
      recovery_state: "recovered",
      next_recovery_at: null,
      last_recovery_at: nowIso,
      last_media_detected_at: nowIso,
      failure_reason_code: null,
    });

    expect(
      buildProviderRunningUpdate({
        nowIso,
        attempts: 1,
        queuePlan,
      })
    ).toEqual({
      recovery_state: "queued",
      failure_reason_code: null,
      last_recovery_at: nowIso,
      next_recovery_at: "2026-02-23T12:02:00.000Z",
      recovery_attempts: 1,
    });

    expect(
      buildProviderRunningUpdate({
        nowIso,
        attempts: 3,
        queuePlan: exhaustedQueuePlan,
      })
    ).toEqual({
      status: "fail",
      completed_at: nowIso,
      recovery_state: "exhausted",
      failure_reason_code: "recovery_exhausted",
      last_recovery_at: nowIso,
      next_recovery_at: null,
    });

    expect(
      buildProviderRunningUpdate({
        nowIso,
        attempts: 3,
        queuePlan: {
          isExhausted: false,
          exhaustionDeferredByMinAge: true,
          recoveryState: "queued",
          nextRecoveryAt: "2026-02-23T12:05:00.000Z",
        },
      })
    ).toEqual({
      recovery_state: "queued",
      failure_reason_code: null,
      last_recovery_at: nowIso,
      next_recovery_at: "2026-02-23T12:05:00.000Z",
      recovery_attempts: 2,
    });

    expect(buildProviderFailedUpdate(nowIso)).toEqual({
      status: "fail",
      completed_at: nowIso,
      failure_reason_code: "provider_error",
      recovery_state: "exhausted",
      last_recovery_at: nowIso,
      next_recovery_at: null,
    });

    expect(
      buildNoMediaUpdate({
        nowIso,
        queuePlan,
      })
    ).toEqual({
      failure_reason_code: "terminal_success_no_media",
      recovery_state: "queued",
      last_recovery_at: nowIso,
      next_recovery_at: "2026-02-23T12:02:00.000Z",
    });
  });

  it("builds recovered success update metadata with execution provenance", () => {
    const nowIso = "2026-02-23T12:00:00.000Z";
    const update = buildRecoveredSuccessUpdate({
      nowIso,
      metadata: { prior: true },
      actor: "webhook",
    });

    expect(update).toEqual({
      status: "success",
      completed_at: nowIso,
      metadata: {
        autosave_enabled: true,
        autosave_decision: "auto_persisted",
        autosave_decision_reason: "auto_allowed",
        autosave_skipped: false,
        prior: true,
        recovery_execution_at: nowIso,
        recovery_execution_actor: "webhook",
      },
      recovery_state: "recovered",
      last_recovery_at: nowIso,
      next_recovery_at: null,
      last_media_detected_at: nowIso,
      failure_reason_code: null,
    });
  });
});
