/**
 * Pricing route tests for guest auth handoff and authenticated plan actions.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "../../pages/pricing";

const useRouterMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Pricing route behavior", () => {
  const routerPushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    routerPushMock.mockReset();
    useRouterMock.mockReturnValue({
      query: {
        intent: "create-project",
        plan: "studio",
      },
      push: routerPushMock,
    });
  });

  it("sends guest plan selection into auth while preserving pricing intent", async () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    render(
      <PricingPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Free",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              is_active: true,
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up for Studio" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        "/auth?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstudio"
      );
    });
  });

  it("shows top-right login and signup actions for guests", () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    render(
      <PricingPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Free",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              is_active: true,
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    const actionRegion = document.querySelector(".lp-actions");
    expect(actionRegion).not.toBeNull();

    const loginAction = actionRegion?.querySelector('a[href*="/auth?"]');
    const signupAction = actionRegion?.querySelector('a[href*="mode=signup"]');

    expect(loginAction).toHaveTextContent("Log in");
    expect(loginAction).toHaveAttribute("href", "/auth?next=%2Fdashboard");
    expect(signupAction).toHaveTextContent("Sign up");
    expect(signupAction).toHaveAttribute(
      "href",
      "/auth?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstudio&mode=signup"
    );
  });

  it("starts the authenticated paid-plan flow through the existing subscription endpoint", async () => {
    const assignMock = vi.fn();
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } },
      user: { id: "user-1", email: "user@example.com" },
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        redirectUrl: "https://checkout.stripe.com/test-session",
      }),
    });

    const originalWindowLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: assignMock,
      },
    });

    render(
      <PricingPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Free",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              is_active: true,
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose Studio" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/billing/subscription/change",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            targetPlanId: "studio",
            billingInterval: "month",
          }),
        })
      );
      expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.com/test-session");
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalWindowLocation,
    });
  });

  it("preserves annual interval state through guest auth links", () => {
    useRouterMock.mockReturnValue({
      query: {
        intent: "create-project",
        plan: "studio",
        interval: "year",
      },
      push: routerPushMock,
      replace: vi.fn(),
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    render(
      <PricingPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Free",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              is_active: true,
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    const actionRegion = document.querySelector(".lp-actions");
    const loginAction = actionRegion?.querySelector('a[href*="/auth?"]');
    const signupAction = actionRegion?.querySelector('a[href*="mode=signup"]');

    expect(loginAction).toHaveAttribute("href", "/auth?next=%2Fdashboard");
    expect(signupAction).toHaveAttribute(
      "href",
      "/auth?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstudio%26interval%3Dyear&mode=signup"
    );
    expect(screen.getByRole("button", { name: /annual/i })).toBeInTheDocument();
  });
});
