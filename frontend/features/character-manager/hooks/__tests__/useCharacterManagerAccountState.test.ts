import type { User } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../../lib/supabaseClient";
import { useCharacterManagerAccountState } from "../useCharacterManagerAccountState";

const maybeSingleMock = vi.fn();
const contractMaybeSingleMock = vi.fn();
const billingPlansEqMock = vi.fn();

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const useSupabaseSessionStateMock = vi.mocked(useSupabaseSessionState);

describe("useCharacterManagerAccountState", () => {
  let sessionState: ReturnType<typeof useSupabaseSessionState>;

  beforeEach(() => {
    maybeSingleMock.mockReset();
    contractMaybeSingleMock.mockReset();
    billingPlansEqMock.mockReset();
    sessionState = {
      initialized: true,
      session: null,
      user: {
        id: "user-1",
        email: "owner@example.com",
        user_metadata: { plan: "studio" },
      } as unknown as User,
    };
    useSupabaseSessionStateMock.mockImplementation(() => sessionState);
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
                maybeSingle: maybeSingleMock,
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
      data: { plan_id: "business" },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { plan_id: "business" },
      error: null,
    });
    billingPlansEqMock.mockResolvedValue({
      data: [
        {
          id: "business",
          display_name: "Business",
          monthly_price_cents: 4900,
          monthly_credits_cents: 100000,
          storage_limit_bytes: 536870912000,
          is_active: true,
        },
      ],
      error: null,
    });
  });

  it("skips auth/bootstrap work for embedded surfaces", () => {
    sessionState = {
      initialized: true,
      session: null,
      user: null,
    };

    const { result } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: true,
        defaultPlanTier: "business",
      })
    );

    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.resolvedPlan).toBeNull();
  });

  it("bootstraps the user and resolves the active plan", async () => {
    const { result } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: false,
        defaultPlanTier: "business",
      })
    );

    await waitFor(() => {
      expect(result.current.user?.id).toBe("user-1");
    });
    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        label: "Business",
        className: "plan-business",
      });
    });
  });

  it("updates the user when Supabase session state changes and clears on sign-out", async () => {
    const { result, rerender } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: false,
        defaultPlanTier: "business",
      })
    );

    await waitFor(() => {
      expect(result.current.user?.id).toBe("user-1");
    });

    act(() => {
      sessionState = {
        initialized: true,
        session: null,
        user: {
          id: "user-2",
          email: "next@example.com",
          user_metadata: { plan: "media" },
        } as unknown as User,
      };
    });
    rerender();

    await waitFor(() => {
      expect(result.current.user?.id).toBe("user-2");
    });

    act(() => {
      sessionState = {
        initialized: true,
        session: null,
        user: null,
      };
    });
    rerender();

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it("falls back to normalized plan metadata when the plan catalog is unavailable", async () => {
    contractMaybeSingleMock.mockResolvedValue({
      data: { plan_id: null },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { plan_id: null },
      error: null,
    });
    billingPlansEqMock.mockResolvedValue({
      data: null,
      error: { message: "offline" },
    });

    const { result } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: false,
        defaultPlanTier: "business",
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedPlan).toEqual({
        label: "studio",
        className: "plan-studio",
      });
    });
  });
});
