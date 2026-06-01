/**
 * Pricing route auth-bootstrap tests.
 * Verifies the public pricing surface only boots the shared session store when
 * local auth hints say the visitor might already be signed in.
 */
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingRoute } from "../PricingRoute";

const useRouterMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../lib/growthTelemetry", () => ({
  trackBillingPricingViewed: vi.fn(),
  trackBillingUpgradeClicked: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  readSupabaseSessionBootstrapHint: (...args: unknown[]) =>
    readSupabaseSessionBootstrapHintMock(...args),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("PricingRoute auth bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      query: {},
      push: vi.fn(),
      replace: vi.fn(),
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });
  });

  it("skips shared session bootstrap for clearly anonymous visits", () => {
    readSupabaseSessionBootstrapHintMock.mockReturnValue(false);

    render(<PricingRoute billingCatalog={{ plans: [], packages: [], storageAddons: [] }} />);

    expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: false });
  });

  it("boots shared session state when local auth hints exist", () => {
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);

    render(<PricingRoute billingCatalog={{ plans: [], packages: [], storageAddons: [] }} />);

    expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: true });
  });
});
