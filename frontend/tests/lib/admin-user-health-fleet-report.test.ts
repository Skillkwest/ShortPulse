/**
 * Regression tests for fleet report read assembly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFleetReport } from "../../lib/server/adminUserHealth/fleetReport";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("readFleetReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty report when no run exists", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const fromMock = vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    await expect(
      readFleetReport({
        page: 1,
        perPage: 50,
        severity: "all",
        findingCode: "",
        riskBand: "all",
        search: "",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        run: null,
        snapshots: [],
        pagination: expect.objectContaining({ totalCount: 0 }),
      })
    );
  });

  it("filters snapshots and assembles findings", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "run-1",
        trigger_source: "manual",
        status: "completed",
        lookback_days: 30,
        active_window_days: 14,
        retention_days: 90,
        target_count: 2,
        processed_count: 2,
        failed_count: 0,
        partial_data: false,
        started_at: "2026-03-17T00:00:00.000Z",
        finished_at: "2026-03-17T00:10:00.000Z",
        duration_ms: 10000,
        error_summary: null,
        metadata: {},
      },
      error: null,
    }));
    const snapshotLimit = vi.fn(async () => ({
      data: [
        {
          id: "snap-1",
          user_id: "user-1",
          user_email: "one@example.com",
          generated_at: "2026-03-17T00:05:00.000Z",
          highest_severity: "warning",
          risk_score: 55,
          spendable_cents: 900,
          reserved_cents: 100,
          fail_rate_24h_percent: 12,
          fail_count_24h: 3,
          total_count_24h: 25,
          stuck_generations_count: 1,
          cost_without_success_cents: 250,
          cost_without_success_linked_cents: 100,
          cost_without_success_missing_linkage_cents: 150,
          partial_data: false,
          finding_count: 1,
        },
        {
          id: "snap-2",
          user_id: "user-2",
          user_email: "two@example.com",
          generated_at: "2026-03-17T00:06:00.000Z",
          highest_severity: "info",
          risk_score: 10,
          spendable_cents: 1000,
          reserved_cents: 0,
          fail_rate_24h_percent: 0,
          fail_count_24h: 0,
          total_count_24h: 10,
          stuck_generations_count: 0,
          cost_without_success_cents: 0,
          cost_without_success_linked_cents: 0,
          cost_without_success_missing_linkage_cents: 0,
          partial_data: false,
          finding_count: 1,
        },
      ],
      error: null,
    }));
    const findingLimit = vi.fn(async () => ({
      data: [
        {
          snapshot_id: "snap-1",
          code: "STUCK_GENERATIONS",
          severity: "critical",
          confidence: "high",
          summary: "stuck",
          details: "details",
          recommended_actions: ["act"],
        },
        {
          snapshot_id: "snap-2",
          code: "HEALTHY_BASELINE",
          severity: "info",
          confidence: "medium",
          summary: "healthy",
          details: "ok",
          recommended_actions: ["watch"],
        },
      ],
      error: null,
    }));

    const fromMock = vi.fn((table: string) => {
      if (table === "admin_user_health_scan_runs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle })),
          })),
        };
      }
      if (table === "admin_user_health_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: snapshotLimit,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "admin_user_health_snapshot_findings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: findingLimit,
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const result = await readFleetReport({
      runId: "run-1",
      page: 1,
      perPage: 10,
      severity: "all",
      findingCode: "STUCK_GENERATIONS",
      riskBand: "all",
      search: "one@",
    });

    expect(result.run).toEqual(expect.objectContaining({ id: "run-1" }));
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toEqual(
      expect.objectContaining({
        id: "snap-1",
        riskBand: "medium",
        findings: [expect.objectContaining({ code: "STUCK_GENERATIONS" })],
      })
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        warningCount: 1,
        infoCount: 1,
      })
    );
  });

  it("computes drainage trend deltas for latest-run reads", async () => {
    const latestRunMaybeSingle = vi.fn(async () => ({
      data: {
        id: "run-latest",
        trigger_source: "scheduled",
        status: "completed",
        lookback_days: 30,
        active_window_days: 14,
        retention_days: 90,
        target_count: 2,
        processed_count: 2,
        failed_count: 0,
        partial_data: false,
        started_at: "2026-03-20T12:00:00.000Z",
        finished_at: "2026-03-20T12:05:00.000Z",
        duration_ms: 300000,
        error_summary: null,
        metadata: {
          drainage_enabled: true,
          drainage_scanned: 14,
          drainage_released: 5,
          drainage_errors: 2,
        },
      },
      error: null,
    }));
    const previousRunMaybeSingle = vi.fn(async () => ({
      data: {
        id: "run-prev",
        trigger_source: "scheduled",
        status: "completed",
        lookback_days: 30,
        active_window_days: 14,
        retention_days: 90,
        target_count: 2,
        processed_count: 2,
        failed_count: 0,
        partial_data: false,
        started_at: "2026-03-20T11:00:00.000Z",
        finished_at: "2026-03-20T11:05:00.000Z",
        duration_ms: 300000,
        error_summary: null,
        metadata: {
          drainage_enabled: true,
          drainage_scanned: 10,
          drainage_released: 4,
          drainage_errors: 0,
        },
      },
      error: null,
    }));
    const snapshotLimit = vi.fn(async () => ({ data: [], error: null }));
    const findingLimit = vi.fn(async () => ({ data: [], error: null }));

    let scanRunSelectCount = 0;
    const fromMock = vi.fn((table: string) => {
      if (table === "admin_user_health_scan_runs") {
        return {
          select: vi.fn(() => {
            scanRunSelectCount += 1;
            if (scanRunSelectCount === 1) {
              return {
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ maybeSingle: latestRunMaybeSingle })),
                })),
              };
            }
            return {
              lt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ maybeSingle: previousRunMaybeSingle })),
                })),
              })),
            };
          }),
        };
      }
      if (table === "admin_user_health_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: snapshotLimit,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "admin_user_health_snapshot_findings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: findingLimit,
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const result = await readFleetReport({
      page: 1,
      perPage: 50,
      severity: "all",
      findingCode: "",
      riskBand: "all",
      search: "",
    });

    expect(result.run).toEqual(
      expect.objectContaining({
        id: "run-latest",
        drainageTrend: {
          previousRunId: "run-prev",
          scannedDelta: 4,
          releasedDelta: 1,
          errorsDelta: 2,
        },
      })
    );
    expect(result.health).toEqual({ degraded: false, reason: null });
  });
});
