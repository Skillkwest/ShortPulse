/**
 * Pricing route tests for guest auth handoff and authenticated plan actions.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "../../pages/pricing";

const useRouterMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const trackBillingPricingViewedMock = vi.hoisted(() => vi.fn());
const trackBillingUpgradeClickedMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/supabaseSessionHints", async () => {
  const actual = await vi.importActual<typeof import("../../lib/supabaseSessionHints")>(
    "../../lib/supabaseSessionHints"
  );
  return {
    ...actual,
    readSupabaseSessionBootstrapHint: (...args: unknown[]) =>
      readSupabaseSessionBootstrapHintMock(...args),
  };
});

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../lib/growthTelemetry", () => ({
  trackBillingPricingViewed: (...args: unknown[]) => trackBillingPricingViewedMock(...args),
  trackBillingUpgradeClicked: (...args: unknown[]) => trackBillingUpgradeClickedMock(...args),
}));

describe("Pricing route behavior", () => {
  const routerPushMock = vi.fn();
  const routerReplaceMock = vi.fn();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    routerPushMock.mockReset();
    routerReplaceMock.mockReset();
    readSupabaseSessionBootstrapHintMock.mockReturnValue(false);
    useRouterMock.mockReturnValue({
      query: {
        intent: "create-project",
        plan: "studio",
      },
      push: routerPushMock,
      replace: routerReplaceMock,
    });
  });

  it("sends guest plan selection into signup while preserving pricing intent", async () => {
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
              display_name: "Starter",
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
              offers: {
                year: {
                  id: "studio_year",
                  billing_interval: "year",
                  recurring_price_cents: 39000,
                  monthly_credits_cents: 3000,
                  storage_limit_bytes: 107374182400,
                  stripe_price_id: "price_studio_year",
                  acquisition_enabled: true,
                  is_active: true,
                },
              },
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up for Studio" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledTimes(1);
    });
    expect(routerPushMock).toHaveBeenCalledWith(
      "/auth?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstudio&mode=signup"
    );
    await waitFor(() => {
      expect(trackBillingUpgradeClickedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          upgrade_surface: "pricing_page",
          pricing_intent: "create-project",
          plan_id: "studio",
          billing_interval: "year",
          is_authenticated: false,
        })
      );
    });
  });

  it("shows only login in the top nav for guests so plan cards own signup", () => {
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
              display_name: "Starter",
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
    expect(signupAction).toBeNull();
  });

  it("hides the hidden baseline tier when a real starter plan exists", () => {
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
              display_name: "Starter",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "starter",
              display_name: "Starter",
              sort_order: 10,
              monthly_price_cents: 1500,
              monthly_credits_cents: 350,
              storage_limit_bytes: 1073741824,
              is_active: true,
              offers: {
                year: {
                  id: "starter_year",
                  billing_interval: "year",
                  recurring_price_cents: 15000,
                  monthly_credits_cents: 350,
                  storage_limit_bytes: 1073741824,
                  stripe_price_id: "price_starter_year",
                  acquisition_enabled: true,
                  is_active: true,
                },
              },
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 12900,
              monthly_credits_cents: 3200,
              storage_limit_bytes: 107374182400,
              is_active: true,
              offers: {
                year: {
                  id: "studio_year",
                  billing_interval: "year",
                  recurring_price_cents: 129000,
                  monthly_credits_cents: 3200,
                  storage_limit_bytes: 107374182400,
                  stripe_price_id: "price_studio_year",
                  acquisition_enabled: true,
                  is_active: true,
                },
              },
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up for Starter" })).toBeInTheDocument();
  });

  it("starts the authenticated paid-plan flow through the existing subscription endpoint", async () => {
    const assignMock = vi.fn();
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
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
              display_name: "Starter",
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
              offers: {
                year: {
                  id: "studio_year",
                  billing_interval: "year",
                  recurring_price_cents: 39000,
                  monthly_credits_cents: 3000,
                  storage_limit_bytes: 107374182400,
                  stripe_price_id: "price_studio_year",
                  acquisition_enabled: true,
                  is_active: true,
                },
              },
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Choose Studio" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/billing/subscription/change",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            targetPlanId: "studio",
            billingInterval: "year",
            checkoutCancelPath: "/pricing?intent=create-project&plan=studio",
          }),
        })
      );
      expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.com/test-session");
    });
    expect(trackBillingUpgradeClickedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        upgrade_surface: "pricing_page",
        pricing_intent: "create-project",
        plan_id: "studio",
        billing_interval: "year",
        is_authenticated: true,
      })
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalWindowLocation,
    });
  });

  it("disables annual plan actions when no live annual offer exists", () => {
    useRouterMock.mockReturnValue({
      query: {
        intent: "create-project",
        plan: "studio",
        interval: "year",
      },
      push: routerPushMock,
      replace: routerReplaceMock,
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } },
      user: { id: "user-1", email: "user@example.com" },
    });
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);

    render(
      <PricingPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Starter",
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

    expect(screen.getByRole("button", { name: "Annual unavailable" })).toBeDisabled();
  });

  it("preserves annual interval state through guest signup auth links", () => {
    useRouterMock.mockReturnValue({
      query: {
        intent: "create-project",
        plan: "studio",
        interval: "year",
      },
      push: routerPushMock,
      replace: routerReplaceMock,
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
              display_name: "Starter",
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
    expect(signupAction).toBeNull();
    expect(screen.getByRole("button", { name: "Annual" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("with annual billing paid upfront")).toBeInTheDocument();
    expect(
      screen.getByText("Upgrade anytime. Downgrades apply at the next billing cycle.")
    ).toBeInTheDocument();
  });

  it("allows switching from annual to monthly billing", async () => {
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
              display_name: "Starter",
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

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/pricing?intent=create-project&plan=studio&interval=month",
        undefined,
        { shallow: true }
      );
    });
  });
});
