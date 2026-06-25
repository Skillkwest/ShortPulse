import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyModelPricingPolicy,
  clearRuntimeModelPricingPolicyCacheForTests,
  ensureModelPricingControlPlaneInitialized,
} from "../modelPricingControlPlane";
import { getDefaultAdminPricingCustomRowsDocument } from "../../../model-runtime/adminPricingCustomRows";

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
          active_custom_rows: {
            schemaVersion: 1,
            rowsByModel: {},
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
    expect(rpc).toHaveBeenNthCalledWith(1, "apply_model_pricing_policy", {
      p_policy: {
        schemaVersion: 4,
        global: {
          creditUsdScale: 125,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
      p_custom_rows: getDefaultAdminPricingCustomRowsDocument(),
      p_note: null,
      p_reason: null,
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
      p_source: "admin_api",
    });
    expect(result).toEqual({
      status: "activated",
      activePolicyVersion: 8,
      activePolicyVersionId: 8,
      activePolicy: {
        schemaVersion: 4,
        global: {
          creditUsdScale: 125,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
      activeCustomRows: getDefaultAdminPricingCustomRowsDocument(),
      activePolicyUpdatedAt: "2026-04-24T13:00:00.000Z",
      activePolicyUpdatedByEmail: "admin@example.com",
      message: null,
    });
  });

  it("fails closed when default built-in custom rows require the latest apply RPC signature", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.apply_model_pricing_policy(p_policy, p_custom_rows, p_note, p_reason, p_actor_user_id, p_actor_email, p_source) in the schema cache",
      },
    });

    await expect(
      applyModelPricingPolicy({
        supabaseAdmin: { rpc } as never,
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
        policy: {
          schemaVersion: 4,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
      })
    ).rejects.toThrow(
      "Model pricing custom rows require the latest control-plane SQL migration before they can be saved."
    );

    expect(rpc).toHaveBeenNthCalledWith(1, "apply_model_pricing_policy", {
      p_policy: {
        schemaVersion: 4,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {},
      },
      p_custom_rows: getDefaultAdminPricingCustomRowsDocument(),
      p_note: null,
      p_reason: null,
      p_actor_user_id: "admin-1",
      p_actor_email: "admin@example.com",
      p_source: "admin_api",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed when custom rows exist but the database only supports the legacy apply RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.apply_model_pricing_policy(p_policy, p_custom_rows, p_note, p_reason, p_actor_user_id, p_actor_email, p_source) in the schema cache",
      },
    });

    await expect(
      applyModelPricingPolicy({
        supabaseAdmin: { rpc } as never,
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
        policy: {
          schemaVersion: 4,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
        customRows: {
          schemaVersion: 1,
          rowsByModel: {
            "fal-ai/flux-2/klein/9b": [
              {
                displayRowId: "row-1",
                label: null,
                variantId: "create|res:model_default|aspect:4:3",
                spec: {
                  baseVariantId: "create",
                  aspect: "4:3",
                  resolution: "model_default",
                },
                overrides: {
                  markupBps: null,
                  providerUsdOverride: null,
                  providerUsdPerSecondOverride: null,
                },
              },
            ],
          },
        },
      })
    ).rejects.toThrow(
      "Model pricing custom rows require the latest control-plane SQL migration before they can be saved."
    );
  });
});
