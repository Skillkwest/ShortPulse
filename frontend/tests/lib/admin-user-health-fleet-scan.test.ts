/**
 * Regression tests for fleet scan execution behavior.
 * Focuses on fleet scan run status and steady-state reporting behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAdminUserHealthFleetScan } from "../../lib/server/adminUserHealth/fleet";

const getSupabaseAdminMock = vi.fn();
const startFleetScanRunMock = vi.fn();
const loadFleetTargetUsersMock = vi.fn();
const persistFleetSnapshotBatchMock = vi.fn();
const finishFleetScanRunMock = vi.fn();
const readAdminUserHealthFleetRuntimeFlagsMock = vi.fn();
const writeAppErrorLogMock = vi.fn();

const baseFlags = {
  enabled: true,
  cronSecret: "fleet-secret",
  lookbackDays: 30,
  activeWindowDays: 30,
  retentionDays: 90,
  maxUsersPerRun: 1000,
  pageSize: 100,
  timeBudgetMs: 300_000,
  incidentsEnabled: false,
  criticalRiskThreshold: 80,
  warningCostWithoutSuccessThresholdCents: 2000,
};

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock("../../lib/server/adminUserHealth/fleetPersistence", () => ({
  startFleetScanRun: (...args: unknown[]) => startFleetScanRunMock(...args),
  loadFleetTargetUsers: (...args: unknown[]) => loadFleetTargetUsersMock(...args),
  persistFleetSnapshotBatch: (...args: unknown[]) => persistFleetSnapshotBatchMock(...args),
  finishFleetScanRun: (...args: unknown[]) => finishFleetScanRunMock(...args),
}));

vi.mock("../../lib/server/adminUserHealth/runtime", () => ({
  readAdminUserHealthFleetRuntimeFlags: (...args: unknown[]) =>
    readAdminUserHealthFleetRuntimeFlagsMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

describe("runAdminUserHealthFleetScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startFleetScanRunMock.mockResolvedValue({
      ok: true,
      runId: "run-1",
    });
    loadFleetTargetUsersMock.mockResolvedValue([]);
    persistFleetSnapshotBatchMock.mockResolvedValue(undefined);
    finishFleetScanRunMock.mockResolvedValue(undefined);
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({ ...baseFlags });
  });

  it("keeps drainage reporting disabled and skips cleanup RPCs", async () => {
    const rpcMock = vi.fn(async (functionName: string) => {
      if (functionName === "prune_admin_user_health_history") {
        return { error: null };
      }
      return { data: null, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("completed");
    expect(result.drainage).toEqual({
      enabled: false,
      scanned: 0,
      released: 0,
      errors: 0,
    });
    expect(finishFleetScanRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          drainage_enabled: false,
          drainage_scanned: 0,
          drainage_released: 0,
          drainage_errors: 0,
        }),
      })
    );
    expect(rpcMock).toHaveBeenCalledWith("prune_admin_user_health_history", {
      p_retention_days: 90,
    });
    expect(rpcMock).not.toHaveBeenCalledWith(
      "release_stale_generation_reservations",
      expect.anything()
    );
    expect(rpcMock).not.toHaveBeenCalledWith(
      "release_stale_provider_attached_generation_reservations",
      expect.anything()
    );
  });
});
