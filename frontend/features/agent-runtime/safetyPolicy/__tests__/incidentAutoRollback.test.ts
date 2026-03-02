import { beforeEach, describe, expect, it, vi } from "vitest";

const rollbackAgentSafetyPolicyMock = vi.fn();

vi.mock("../../../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  resolveAgentSafetyRollbackCooldownHours: () => 24,
  rollbackAgentSafetyPolicy: (...args: unknown[]) => rollbackAgentSafetyPolicyMock(...args),
}));

vi.mock("../../../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({}),
}));

import {
  maybeTriggerSafetyIncidentAutoRollback,
  shouldAttemptSafetyIncidentAutoRollback,
} from "../incidentAutoRollback";

describe("incidentAutoRollback", () => {
  beforeEach(() => {
    rollbackAgentSafetyPolicyMock.mockReset();
  });

  it("gates rollback attempts to production hard-floor incidents", () => {
    expect(
      shouldAttemptSafetyIncidentAutoRollback({
        environment: "production",
        autoRollbackEnabled: true,
        hardFloorViolation: true,
      })
    ).toBe(true);
    expect(
      shouldAttemptSafetyIncidentAutoRollback({
        environment: "development",
        autoRollbackEnabled: true,
        hardFloorViolation: true,
      })
    ).toBe(false);
    expect(
      shouldAttemptSafetyIncidentAutoRollback({
        environment: "production",
        autoRollbackEnabled: false,
        hardFloorViolation: true,
      })
    ).toBe(false);
  });

  it("returns no-op result when gate conditions are not met", async () => {
    const result = await maybeTriggerSafetyIncidentAutoRollback({
      environment: "production",
      autoRollbackEnabled: false,
      hardFloorViolation: true,
      actorUserId: "user-1",
      actorEmail: "a@example.com",
    });

    expect(result).toEqual({
      attempted: false,
      rollbackTriggered: false,
      status: null,
      cooldownUntil: null,
      message: null,
    });
    expect(rollbackAgentSafetyPolicyMock).not.toHaveBeenCalled();
  });

  it("marks rollback as triggered for rolled_back and already_safe results", async () => {
    rollbackAgentSafetyPolicyMock.mockResolvedValueOnce({
      status: "rolled_back",
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 1,
      cooldownUntil: "2026-03-03T00:00:00.000Z",
      message: null,
    });

    const rolledBack = await maybeTriggerSafetyIncidentAutoRollback({
      environment: "production",
      autoRollbackEnabled: true,
      hardFloorViolation: true,
      actorUserId: "user-1",
      actorEmail: "a@example.com",
    });
    expect(rolledBack.rollbackTriggered).toBe(true);
    expect(rolledBack.status).toBe("rolled_back");

    rollbackAgentSafetyPolicyMock.mockResolvedValueOnce({
      status: "already_safe",
      activeProfileId: "prod_safe_v1",
      activePolicyVersion: 1,
      cooldownUntil: "2026-03-03T00:00:00.000Z",
      message: null,
    });

    const alreadySafe = await maybeTriggerSafetyIncidentAutoRollback({
      environment: "production",
      autoRollbackEnabled: true,
      hardFloorViolation: true,
      actorUserId: "user-1",
      actorEmail: "a@example.com",
    });
    expect(alreadySafe.rollbackTriggered).toBe(true);
    expect(alreadySafe.status).toBe("already_safe");
  });

  it("does not mark rollback as triggered for no-op mutation statuses", async () => {
    rollbackAgentSafetyPolicyMock.mockResolvedValueOnce({
      status: "no_safe_target",
      activeProfileId: null,
      activePolicyVersion: null,
      cooldownUntil: null,
      message: "No target",
    });

    const result = await maybeTriggerSafetyIncidentAutoRollback({
      environment: "production",
      autoRollbackEnabled: true,
      hardFloorViolation: true,
      actorUserId: "user-1",
      actorEmail: "a@example.com",
    });

    expect(result.rollbackTriggered).toBe(false);
    expect(result.status).toBe("no_safe_target");
  });
});
