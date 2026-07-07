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

const createGrantSummaryRow = (userId: string, spendableCents: number) => ({
  user_id: userId,
  spendable_cents: spendableCents,
  reserved_cents: 0,
  expiring_cents: spendableCents,
  non_expiring_cents: 0,
  next_expiring_cents: spendableCents,
  next_expires_at: "2026-08-01T00:00:00.000Z",
});

const createGrantSummaryRpcMock = (spendableByUser: Record<string, number> = {}) =>
  vi.fn(async (functionName: string, params?: { p_user_id?: string; p_user_ids?: string[] }) => {
    if (functionName === "get_credit_grant_summary") {
      const spendableCents = spendableByUser[params?.p_user_id ?? ""] ?? 100;
      return {
        data: [createGrantSummaryRow(params?.p_user_id ?? "", spendableCents)],
        error: null,
      };
    }
    if (functionName === "get_credit_grant_summaries") {
      const userIds = params?.p_user_ids ?? [];
      return {
        data: userIds.map((userId) =>
          createGrantSummaryRow(userId, spendableByUser[userId] ?? 100)
        ),
        error: null,
      };
    }
    return { data: null, error: null };
  });

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

  it("uses projection request lineage to avoid false fleet cost-without-success alerts", async () => {
    loadFleetTargetUsersMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "user@example.com",
      },
    ]);

    const rpcMock = createGrantSummaryRpcMock();
    const buildQuery = (table: string) => {
      const filters = new Map<string, unknown[]>();
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.in = vi.fn((field: string, values: unknown[]) => {
        filters.set(field, values);
        return chain;
      });
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.lt = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
        let data: unknown[] = [];
        if (table === "ai_credit_balance") {
          data = [{ user_id: "user-1", balance_cents: 100 }];
        } else if (table === "ai_credit_reservations") {
          data = [
            {
              user_id: "user-1",
              status: "captured",
              source_ref: "ledger-source-ref",
              provider_request_id: "provider-request-1",
              amount_cents: 5,
              created_at: "2026-06-03T10:00:00.000Z",
            },
          ];
        } else if (table === "ai_credit_ledger") {
          data = [
            {
              user_id: "user-1",
              change_cents: -5,
              source: "generation_charge",
              source_ref: "ledger-source-ref",
              reason: "elevenlabs music generation",
              created_at: "2026-06-03T10:01:00.000Z",
            },
          ];
        } else if (table === "generation_projection") {
          const requestIds = filters.get("request_id") ?? [];
          data = requestIds.includes("provider-request-1")
            ? [
                {
                  user_id: "user-1",
                  source_ref: "projection-source-ref",
                  request_id: "provider-request-1",
                  provider_request_id: null,
                  status: "success",
                  task_state: "success",
                  result_urls: ["https://cdn.test/audio.mp3"],
                  preview_url: null,
                },
              ]
            : [];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return chain;
    };
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => buildQuery(table),
      rpc: rpcMock,
    });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("completed");
    const persistedDrafts = persistFleetSnapshotBatchMock.mock.calls[0]?.[0]?.drafts ?? [];
    expect(persistedDrafts[0]).toEqual(
      expect.objectContaining({
        costWithoutSuccessCents: 0,
        costWithoutSuccessLinkedCents: 0,
        costWithoutSuccessMissingLinkageCents: 0,
      })
    );
  });

  it("uses generation metadata source_ref lineage to avoid false fleet cost alerts", async () => {
    loadFleetTargetUsersMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "user@example.com",
      },
    ]);

    const rpcMock = createGrantSummaryRpcMock();
    const buildQuery = (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.lt = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
        let data: unknown[] = [];
        if (table === "ai_credit_balance") {
          data = [{ user_id: "user-1", balance_cents: 100 }];
        } else if (table === "ai_generations") {
          data = [
            {
              user_id: "user-1",
              status: "success",
              recovery_state: null,
              request_id: null,
              created_at: "2026-06-03T10:00:00.000Z",
              metadata: {
                source_ref: "metadata-source-ref-1",
              },
            },
          ];
        } else if (table === "ai_credit_ledger") {
          data = [
            {
              user_id: "user-1",
              change_cents: -5,
              source: "generation_charge",
              source_ref: "metadata-source-ref-1",
              reason: "generation charge",
              created_at: "2026-06-03T10:01:00.000Z",
            },
          ];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return chain;
    };
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => buildQuery(table),
      rpc: rpcMock,
    });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("completed");
    const persistedDrafts = persistFleetSnapshotBatchMock.mock.calls[0]?.[0]?.drafts ?? [];
    expect(persistedDrafts[0]).toEqual(
      expect.objectContaining({
        costWithoutSuccessCents: 0,
        costWithoutSuccessLinkedCents: 0,
        costWithoutSuccessMissingLinkageCents: 0,
      })
    );
  });

  it("uses credit grant summary spendability for fleet snapshots", async () => {
    loadFleetTargetUsersMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "user@example.com",
      },
    ]);

    const rpcMock = createGrantSummaryRpcMock({
      "user-1": 25,
    });
    rpcMock.mockImplementation(async (functionName, params) => {
      if (functionName === "get_credit_grant_summary") {
        return {
          data: [
            {
              user_id: params?.p_user_id ?? "user-1",
              spendable_cents: 25,
              reserved_cents: 10,
              expiring_cents: 25,
              non_expiring_cents: 0,
              next_expiring_cents: 25,
              next_expires_at: "2026-08-01T00:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const buildQuery = (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.lt = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
        let data: unknown[] = [];
        if (table === "ai_credit_balance") {
          data = [{ user_id: "user-1", balance_cents: 100 }];
        } else if (table === "ai_credit_reservations") {
          data = [
            {
              user_id: "user-1",
              status: "reserved",
              source_ref: "source-ref-1",
              provider_request_id: null,
              amount_cents: 90,
              created_at: "2026-06-03T10:00:00.000Z",
            },
          ];
        } else if (table === "ai_credit_ledger") {
          data = [];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return chain;
    };
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => buildQuery(table),
      rpc: rpcMock,
    });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("completed");
    const persistedDrafts = persistFleetSnapshotBatchMock.mock.calls[0]?.[0]?.drafts ?? [];
    expect(persistedDrafts[0]).toEqual(
      expect.objectContaining({
        spendableCents: 25,
        reservedCents: 10,
      })
    );
    expect(rpcMock).toHaveBeenCalledWith("get_credit_grant_summary", {
      p_user_id: "user-1",
    });
  });

  it("fails the target chunk when a fleet user's grant summary is missing", async () => {
    loadFleetTargetUsersMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "user@example.com",
      },
    ]);

    const rpcMock = vi.fn(async (functionName: string) => {
      if (functionName === "get_credit_grant_summary") {
        return { data: [], error: null };
      }
      if (functionName === "prune_admin_user_health_history") {
        return { error: null };
      }
      return { data: null, error: null };
    });
    const buildQuery = () => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.lt = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject);
      return chain;
    };
    getSupabaseAdminMock.mockReturnValue({
      from: () => buildQuery(),
      rpc: rpcMock,
    });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("failed");
    expect(result.errors).toEqual(["Credit grant summary missing for fleet user user-1."]);
    expect(persistFleetSnapshotBatchMock).not.toHaveBeenCalled();
  });

  it("keeps fleet projection lineage scoped to the owning user", async () => {
    loadFleetTargetUsersMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "one@example.com",
      },
      {
        userId: "user-2",
        email: "two@example.com",
      },
    ]);

    const rpcMock = createGrantSummaryRpcMock({
      "user-1": 100,
      "user-2": 100,
    });
    const buildQuery = (table: string) => {
      const filters = new Map<string, unknown[]>();
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.in = vi.fn((field: string, values: unknown[]) => {
        filters.set(field, values);
        return chain;
      });
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.lt = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
        let data: unknown[] = [];
        if (table === "ai_credit_balance") {
          data = [
            { user_id: "user-1", balance_cents: 100 },
            { user_id: "user-2", balance_cents: 100 },
          ];
        } else if (table === "ai_credit_ledger") {
          data = [
            {
              user_id: "user-1",
              change_cents: -5,
              source: "generation_charge",
              source_ref: "shared-source-ref",
              reason: "generation charge",
              created_at: "2026-06-03T10:01:00.000Z",
            },
          ];
        } else if (table === "generation_projection") {
          const sourceRefs = filters.get("source_ref") ?? [];
          data = sourceRefs.includes("shared-source-ref")
            ? [
                {
                  user_id: "user-2",
                  source_ref: "shared-source-ref",
                  request_id: null,
                  provider_request_id: null,
                  status: "success",
                  task_state: "success",
                  result_urls: ["https://cdn.test/other-user.mp3"],
                  preview_url: null,
                },
              ]
            : [];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return chain;
    };
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => buildQuery(table),
      rpc: rpcMock,
    });

    const result = await runAdminUserHealthFleetScan({
      triggerSource: "scheduled",
    });

    expect(result.status).toBe("completed");
    expect(rpcMock).toHaveBeenCalledWith("get_credit_grant_summaries", {
      p_user_ids: ["user-1", "user-2"],
    });
    const persistedDrafts = persistFleetSnapshotBatchMock.mock.calls[0]?.[0]?.drafts ?? [];
    const userOneDraft = persistedDrafts.find(
      (draft: { userId?: string }) => draft.userId === "user-1"
    );
    expect(userOneDraft).toEqual(
      expect.objectContaining({
        costWithoutSuccessCents: 5,
        costWithoutSuccessLinkedCents: 0,
        costWithoutSuccessMissingLinkageCents: 5,
      })
    );
  });
});
