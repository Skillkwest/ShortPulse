/**
 * Regression tests for fleet scan lifecycle/persistence helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finishFleetScanRun,
  loadFleetTargetUsers,
  parseFleetRunRow,
  persistFleetSnapshotBatch,
  startFleetScanRun,
} from "../../lib/server/adminUserHealth/fleetPersistence";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("admin user health fleet persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses persisted run rows safely", () => {
    expect(
      parseFleetRunRow({
        id: "run-1",
        trigger_source: "manual",
        status: "partial",
        lookback_days: 30,
        active_window_days: 14,
        retention_days: 90,
        target_count: 10,
        processed_count: 8,
        failed_count: 2,
        partial_data: true,
        started_at: "2026-03-17T00:00:00.000Z",
        finished_at: "2026-03-17T00:10:00.000Z",
        duration_ms: 10000,
        error_summary: "partial",
        metadata: { foo: "bar" },
      })
    ).toEqual(
      expect.objectContaining({
        id: "run-1",
        triggerSource: "manual",
        status: "partial",
        targetCount: 10,
        processedCount: 8,
        failedCount: 2,
      })
    );
  });

  it("returns already_running on unique constraint conflict", async () => {
    const maybeSingleConflict = vi.fn(async () => ({
      data: null,
      error: { message: "duplicate key", code: "23505" },
    }));
    const maybeSingleExisting = vi.fn(async () => ({
      data: { id: "run-existing" },
      error: null,
    }));

    const insertQuery = {
      select: vi.fn(() => ({ maybeSingle: maybeSingleConflict })),
    };
    const runningQuery = {
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({ maybeSingle: maybeSingleExisting })),
        })),
      })),
    };

    const fromMock = vi.fn((table: string) => {
      if (table === "admin_user_health_scan_runs") {
        return {
          insert: vi.fn(() => insertQuery),
          select: vi.fn(() => runningQuery),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    await expect(
      startFleetScanRun({
        lookbackDays: 30,
        activeWindowDays: 14,
        retentionDays: 90,
        triggerSource: "manual",
      })
    ).resolves.toEqual({
      ok: false,
      reason: "already_running",
      existingRunId: "run-existing",
    });
  });

  it("loads fleet targets from rpc payload", async () => {
    const rpcMock = vi.fn(async () => ({
      data: [
        { user_id: "user-1", email: "user@example.com", last_activity_at: "2026-03-16T00:00:00Z" },
      ],
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    await expect(
      loadFleetTargetUsers({
        activeWindowDays: 7,
        maxUsers: 25,
      })
    ).resolves.toEqual([
      {
        userId: "user-1",
        email: "user@example.com",
        lastActivityAt: "2026-03-16T00:00:00Z",
      },
    ]);
  });

  it("persists snapshots and findings for a batch", async () => {
    const snapshotsInsert = vi.fn(() => ({
      select: vi.fn(async () => ({
        data: [{ id: "snap-1", user_id: "user-1" }],
        error: null,
      })),
    }));
    const findingsInsert = vi.fn(async () => ({ error: null }));

    const fromMock = vi.fn((table: string) => {
      if (table === "admin_user_health_snapshots") {
        return { insert: snapshotsInsert };
      }
      if (table === "admin_user_health_snapshot_findings") {
        return { insert: findingsInsert };
      }
      throw new Error(`unexpected table ${table}`);
    });

    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    await persistFleetSnapshotBatch({
      runId: "run-1",
      drafts: [
        {
          userId: "user-1",
          userEmail: "user@example.com",
          generatedAt: "2026-03-17T00:00:00.000Z",
          highestSeverity: "warning",
          riskScore: 55,
          spendableCents: 900,
          reservedCents: 100,
          failRate24hPercent: 12,
          failCount24h: 3,
          totalCount24h: 25,
          stuckGenerationsCount: 1,
          exhaustedQueueCount: 2,
          costWithoutSuccessCents: 250,
          costWithoutSuccessLinkedCents: 100,
          costWithoutSuccessMissingLinkageCents: 150,
          partialData: false,
          findingCount: 1,
          findings: [
            {
              code: "STUCK_GENERATIONS",
              severity: "critical",
              confidence: "high",
              summary: "stuck",
              details: "details",
              recommendedActions: ["act"],
            },
          ],
          nextSteps: ["act"],
          metadata: { riskBand: "medium" },
        },
      ],
    });

    expect(snapshotsInsert).toHaveBeenCalledTimes(1);
    expect(findingsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        run_id: "run-1",
        snapshot_id: "snap-1",
        user_id: "user-1",
        code: "STUCK_GENERATIONS",
      }),
    ]);
  });

  it("updates a completed run", async () => {
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    await expect(
      finishFleetScanRun({
        runId: "run-1",
        status: "completed",
        targetCount: 5,
        processedCount: 5,
        failedCount: 0,
        partialData: false,
        startedAtMs: Date.now() - 1000,
        errorSummary: null,
        metadata: { critical_users: 0 },
      })
    ).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("id", "run-1");
  });
});
