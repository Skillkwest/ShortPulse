import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyGenerationLifecycleTransition } from "../generationLifecycleTransitionService";

const ensureAcceptedRunningGenerationAttemptMock = vi.fn();
const updateGenerationAttemptStateMock = vi.fn();

vi.mock("../generationAttempts", () => ({
  ensureAcceptedRunningGenerationAttempt: (...args: unknown[]) =>
    ensureAcceptedRunningGenerationAttemptMock(...args),
  updateGenerationAttemptState: (...args: unknown[]) => updateGenerationAttemptStateMock(...args),
}));

describe("applyGenerationLifecycleTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureAcceptedRunningGenerationAttemptMock.mockResolvedValue({
      ok: true,
      attemptId: "attempt-1",
      attemptNumber: 1,
    });
    updateGenerationAttemptStateMock.mockResolvedValue({ ok: true });
  });

  it("runs provider submit accepted transitions generation-first", async () => {
    const events: string[] = [];
    ensureAcceptedRunningGenerationAttemptMock.mockImplementationOnce(async () => {
      events.push("attempt");
      return {
        ok: true,
        attemptId: "attempt-1",
        attemptNumber: 1,
      };
    });

    const result = await applyGenerationLifecycleTransition({
      intent: "provider_submit_accepted",
      applyGenerationMutation: async () => {
        events.push("generation");
        return { ok: true };
      },
      attemptMutation: {
        kind: "accepted_running",
        input: {
          generationId: "gen-1",
          userId: "user-1",
          provider: "fal",
          modelId: "fal-ai/nano-banana-pro",
          providerRequestId: "req-1",
          dispatchSource: "direct_submit",
        },
      },
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["generation", "attempt"]);
    expect(ensureAcceptedRunningGenerationAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        providerRequestId: "req-1",
      })
    );
  });

  it("runs request-id repair transitions attempt-first", async () => {
    const events: string[] = [];
    ensureAcceptedRunningGenerationAttemptMock.mockImplementationOnce(async () => {
      events.push("attempt");
      return {
        ok: true,
        attemptId: "attempt-1",
        attemptNumber: 1,
      };
    });

    const result = await applyGenerationLifecycleTransition({
      intent: "request_id_repaired",
      applyGenerationMutation: async () => {
        events.push("generation");
        return { ok: true };
      },
      attemptMutation: {
        kind: "accepted_running",
        input: {
          generationId: "gen-1",
          userId: "user-1",
          provider: "fal",
          modelId: "fal-ai/nano-banana-pro",
          providerRequestId: "req-1",
          dispatchSource: "reconciler",
        },
      },
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["attempt", "generation"]);
  });

  it("rejects invalid attempt mutation kinds for running observations", async () => {
    const result = await applyGenerationLifecycleTransition({
      intent: "provider_running_observed",
      attemptMutation: {
        kind: "accepted_running",
        input: {
          generationId: "gen-1",
          userId: "user-1",
          provider: "fal",
          modelId: "fal-ai/nano-banana-pro",
          providerRequestId: "req-1",
          dispatchSource: "reconciler",
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      stage: "request",
      error: "invalid_attempt_mutation_for_provider_running_observed",
    });
    expect(ensureAcceptedRunningGenerationAttemptMock).not.toHaveBeenCalled();
  });

  it("allows queue reconcile running to ignore missing attempts when explicitly requested", async () => {
    updateGenerationAttemptStateMock.mockResolvedValueOnce({
      ok: false,
      error: "attempt_not_found",
    });

    const result = await applyGenerationLifecycleTransition({
      intent: "queue_reconcile_running",
      attemptMutation: {
        kind: "state_update",
        input: {
          providerRequestId: "req-1",
          userId: "user-1",
          status: "running",
        },
        allowMissingAttempt: true,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        userId: "user-1",
        status: "running",
      })
    );
  });
});
