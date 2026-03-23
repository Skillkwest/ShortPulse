import type { User } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterManagerAccountState } from "../useCharacterManagerAccountState";

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const billingPlansEqMock = vi.fn();
const unsubscribeMock = vi.fn();
let authStateListener: ((event: string, session: { user: User | null } | null) => void) | null =
  null;

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
      onAuthStateChange: (callback: typeof authStateListener) => {
        authStateListener = callback;
        return {
          data: {
            subscription: {
              unsubscribe: unsubscribeMock,
            },
          },
        };
      },
    },
    from: (table: string) => {
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
  }),
}));

describe("useCharacterManagerAccountState", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    billingPlansEqMock.mockReset();
    unsubscribeMock.mockReset();
    authStateListener = null;

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          user_metadata: { plan: "studio" },
        },
      },
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
          is_active: true,
        },
      ],
      error: null,
    });
  });

  it("skips auth/bootstrap work for embedded surfaces", () => {
    const { result } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: true,
        defaultPlanTier: "business",
      })
    );

    expect(getUserMock).not.toHaveBeenCalled();
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

  it("updates the user on auth events and clears on sign-out", async () => {
    const { result } = renderHook(() =>
      useCharacterManagerAccountState({
        isEmbeddedSurface: false,
        defaultPlanTier: "business",
      })
    );

    await waitFor(() => {
      expect(authStateListener).toBeTypeOf("function");
    });

    act(() => {
      authStateListener?.("SIGNED_IN", {
        user: {
          id: "user-2",
          email: "next@example.com",
          user_metadata: { plan: "media" },
        } as unknown as User,
      });
    });

    await waitFor(() => {
      expect(result.current.user?.id).toBe("user-2");
    });

    act(() => {
      authStateListener?.("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it("falls back to normalized plan metadata when the plan catalog is unavailable", async () => {
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
