/**
 * Regression tests for fleet scan execution behavior.
 * Focuses on flag-gated drainage execution and run-status outcomes.
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
  drainageEnabled: false,
  drainageMinAgeSeconds: 900,
  drainageBatchSize: 200,
  drainageProviderAttachedEnabled: false,
  drainageProviderAttachedMinAgeSeconds: 7200,
  drainageProviderAttachedOrphanMinAgeSeconds: 86400,
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

  it("skips drainage RPCs when drainage is disabled", async () => {
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

  it("runs both drainage RPCs when enabled and reports aggregated metrics", async () => {
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({
      ...baseFlags,
      drainageEnabled: true,
      drainageProviderAttachedEnabled: true,
      drainageBatchSize: 111,
      drainageMinAgeSeconds: 333,
      drainageProviderAttachedMinAgeSeconds: 444,
      drainageProviderAttachedOrphanMinAgeSeconds: 555,
    });

    const rpcMock = vi.fn(async (functionName: string, args?: Record<string, unknown>) => {
      if (functionName === "release_stale_generation_reservations") {
        expect(args).toEqual({
          p_limit: 111,
          p_min_age_seconds: 333,
        });
        return {
          data: [{ scanned_count: 10, released_count: 3, error_count: 0 }],
          error: null,
        };
      }
      if (functionName === "release_stale_provider_attached_generation_reservations") {
        expect(args).toEqual({
          p_limit: 111,
          p_min_age_seconds: 444,
          p_orphan_min_age_seconds: 555,
        });
        return {
          data: [{ scanned_count: 4, released_count: 2, error_count: 0 }],
          error: null,
        };
      }
      if (functionName === "prune_admin_user_health_history") {
        return { error: null };
      }
      return { data: null, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "manual",
    });

    expect(result.status).toBe("completed");
    expect(result.drainage).toEqual({
      enabled: true,
      scanned: 14,
      released: 5,
      errors: 0,
    });
    expect(finishFleetScanRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          drainage_enabled: true,
          drainage_scanned: 14,
          drainage_released: 5,
          drainage_errors: 0,
        }),
      })
    );
  });

  it("marks run partial when drainage RPC fails but continues processing", async () => {
    readAdminUserHealthFleetRuntimeFlagsMock.mockReturnValue({
      ...baseFlags,
      drainageEnabled: true,
      drainageProviderAttachedEnabled: false,
    });

    const rpcMock = vi.fn(async (functionName: string) => {
      if (functionName === "release_stale_generation_reservations") {
        return {
          data: null,
          error: { message: "drain rpc unavailable" },
        };
      }
      if (functionName === "prune_admin_user_health_history") {
        return { error: null };
      }
      return { data: null, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("partial");
    expect(result.partial).toBe(true);
    expect(result.drainage).toEqual({
      enabled: true,
      scanned: 0,
      released: 0,
      errors: 1,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Fleet drainage failed for release_stale_generation_reservations"),
      ])
    );
  });
});
