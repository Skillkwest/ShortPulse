import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

import {
  clearRuntimeSafetyProfileCacheForTests,
  resolveRuntimeSafetyProfile,
} from "../agentSafetyPolicyControlPlane";

describe("resolveRuntimeSafetyProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearRuntimeSafetyProfileCacheForTests();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("uses env profile when control-plane sync is disabled", async () => {
    const resolved = await resolveRuntimeSafetyProfile({
      envProfileId: "staging_lenient",
      runtimeControlPlaneSyncEnabled: "false",
    });
    expect(resolved).toEqual({
      profileId: "staging_lenient",
      policyVersion: null,
      activePolicy: null,
      source: "env",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("uses control-plane profile when admin config is available", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          active_profile_id: "staging_lenient",
          active_policy_version: 7,
          active_policy: {},
          active_policy_version_id: 42,
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const first = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "60000",
    });
    const second = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "60000",
    });

    expect(first).toEqual({
      profileId: "staging_lenient",
      policyVersion: 7,
      activePolicy: {},
      source: "control_plane",
    });
    expect(second).toEqual({
      profileId: "staging_lenient",
      policyVersion: 7,
      activePolicy: {},
      source: "control_plane",
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to env profile when control-plane read fails", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rpc unavailable" },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const resolved = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "60000",
    });
    expect(resolved).toEqual({
      profileId: "prod_safe_v1",
      policyVersion: 1,
      activePolicy: null,
      source: "env",
    });
  });

  it("uses fallback source when env profile is invalid and control-plane sync is disabled", async () => {
    const resolved = await resolveRuntimeSafetyProfile({
      envProfileId: "unknown_profile",
      runtimeControlPlaneSyncEnabled: "false",
    });
    expect(resolved).toEqual({
      profileId: "prod_safe_v1",
      policyVersion: 1,
      activePolicy: null,
      source: "fallback",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("re-fetches control-plane profile after cache TTL expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            active_profile_id: "staging_lenient",
            active_policy_version: 7,
            active_policy: {},
            active_policy_version_id: 42,
            updated_at: "2026-03-20T00:00:00.000Z",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            active_profile_id: "prod_safe_v1",
            active_policy_version: 9,
            active_policy: {},
            active_policy_version_id: 43,
            updated_at: "2026-03-20T00:05:00.000Z",
          },
        ],
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const first = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "1000",
    });
    vi.setSystemTime(new Date("2026-03-20T00:00:00.500Z"));
    const cached = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "1000",
    });
    vi.setSystemTime(new Date("2026-03-20T00:00:02.000Z"));
    const refreshed = await resolveRuntimeSafetyProfile({
      envProfileId: "prod_safe_v1",
      controlPlaneCacheTtlMs: "1000",
    });

    expect(first).toEqual({
      profileId: "staging_lenient",
      policyVersion: 7,
      activePolicy: {},
      source: "control_plane",
    });
    expect(cached).toEqual({
      profileId: "staging_lenient",
      policyVersion: 7,
      activePolicy: {},
      source: "control_plane",
    });
    expect(refreshed).toEqual({
      profileId: "prod_safe_v1",
      policyVersion: 9,
      activePolicy: {},
      source: "control_plane",
    });
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
