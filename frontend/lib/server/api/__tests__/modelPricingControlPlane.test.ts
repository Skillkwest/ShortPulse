import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyModelPricingPolicy,
  clearRuntimeModelPricingPolicyCacheForTests,
  ensureModelPricingControlPlaneInitialized,
} from "../modelPricingControlPlane";

const buildInitializedSupabaseMock = () => {
  const upsertRuntime = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "model_pricing_policy_runtime") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: upsertRuntime,
      };
    }
    if (table === "model_pricing_policy_versions") {
      return {
        select: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: { id: 7, version: 7 },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, upsertRuntime };
};

describe("modelPricingControlPlane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRuntimeModelPricingPolicyCacheForTests();
  });

  it("initializes the runtime singleton from the latest policy version when missing", async () => {
    const { from, upsertRuntime } = buildInitializedSupabaseMock();

    const initialized = await ensureModelPricingControlPlaneInitialized({
      supabaseAdmin: { from } as never,
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(initialized).toBe(true);
    expect(upsertRuntime).toHaveBeenCalledWith(
      {
        singleton: true,
        active_policy_version_id: 7,
        last_known_safe_policy_version_id: 7,
        updated_by_user_id: "admin-1",
        updated_by_email: "admin@example.com",
      },
      { onConflict: "singleton" }
    );
  });

  it("seeds the first policy version when both version and runtime rows are missing", async () => {
    const insertVersion = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 1, version: 1 }, error: null }),
      }),
    }));
    const upsertRuntime = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "model_pricing_policy_runtime") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          upsert: upsertRuntime,
        };
      }
      if (table === "model_pricing_policy_versions") {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertVersion,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await ensureModelPricingControlPlaneInitialized({
      supabaseAdmin: { from } as never,
    });

    expect(insertVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        note: "baseline_seed_v1",
        created_by_email: "system_seed",
        policy: expect.objectContaining({
          global: expect.objectContaining({
            creditUsdScale: 100,
          }),
        }),
      })
    );
    expect(upsertRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        active_policy_version_id: 1,
        last_known_safe_policy_version_id: 1,
      }),
      { onConflict: "singleton" }
    );
  });

  it("initializes missing rows and retries admin apply when the RPC is not initialized", async () => {
    const { from } = buildInitializedSupabaseMock();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          status: "not_initialized",
          active_policy_version: null,
          active_policy_version_id: null,
          message: "Model pricing control plane is not initialized.",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: "activated",
          active_policy_version: 8,
          active_policy_version_id: 8,
          message: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          active_policy_version: 8,
          active_policy_version_id: 8,
          active_policy: {
            schemaVersion: 3,
            global: {
              creditUsdScale: 125,
              defaultRoundingMode: "ceil",
              defaultRoundingIncrement: 1,
            },
            perModel: {},
          },
          last_known_safe_policy_version: 7,
          last_known_safe_policy_version_id: 7,
          updated_at: "2026-04-24T13:00:00.000Z",
          updated_by_user_id: "admin-1",
          updated_by_email: "admin@example.com",
        },
        error: null,
      });

    const result = await applyModelPricingPolicy({
      supabaseAdmin: { from, rpc } as never,
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 125,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
    });

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      status: "activated",
      activePolicyVersion: 8,
      activePolicyVersionId: 8,
      activePolicy: {
        schemaVersion: 3,
        global: {
          creditUsdScale: 125,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
      activePolicyUpdatedAt: "2026-04-24T13:00:00.000Z",
      activePolicyUpdatedByEmail: "admin@example.com",
      message: null,
    });
  });
});
