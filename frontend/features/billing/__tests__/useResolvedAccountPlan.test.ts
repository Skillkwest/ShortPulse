import type { User } from "@supabase/supabase-js";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../lib/supabaseClient";
import { useResolvedAccountPlan } from "../useResolvedAccountPlan";

const contractMaybeSingleMock = vi.fn();
const profileMaybeSingleMock = vi.fn();
const billingPlansEqMock = vi.fn();

vi.mock("../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const useSupabaseSessionStateMock = vi.mocked(useSupabaseSessionState);

describe("useResolvedAccountPlan", () => {
  beforeEach(() => {
    contractMaybeSingleMock.mockReset();
    profileMaybeSingleMock.mockReset();
    billingPlansEqMock.mockReset();

    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: {
        id: "user-1",
        email: "owner@example.com",
        user_metadata: { plan: "free" },
      } as unknown as User,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_subscription_contracts") {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: contractMaybeSingleMock,
                }),
              }),
            }),
          };
        }
        if (table === "billing_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: profileMaybeSingleMock,
              }),
            }),
          };
        }
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: billingPlansEqMock,
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    contractMaybeSingleMock.mockResolvedValue({
      data: { plan_id: "free" },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { plan_id: "free" },
      error: null,
    });
    billingPlansEqMock.mockResolvedValue({
      data: [
        {
          id: "free",
          display_name: "Free",
          monthly_price_cents: 0,
          monthly_credits_cents: 500,
          storage_limit_bytes: 1073741824,
          is_active: true,
        },
      ],
      error: null,
    });
  });

  it("resolves the active plan from the current subscription contract", async () => {
    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "free",
        label: "Free",
        className: "plan-free",
      });
    });
  });

  it("falls back to the explicit default tier when billing queries fail", async () => {
    contractMaybeSingleMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useResolvedAccountPlan({ defaultPlanTier: "business" }));

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "business",
        label: "Business",
        className: "plan-business",
      });
    });
  });

  it("does not trust a paid billing profile when the current contract is missing", async () => {
    contractMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { plan_id: "business" },
      error: null,
    });

    const { result } = renderHook(() => useResolvedAccountPlan());

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        id: "free",
        label: "Free",
        className: "plan-free",
      });
    });
  });
});
