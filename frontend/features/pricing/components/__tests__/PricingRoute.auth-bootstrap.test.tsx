/**
 * Pricing route auth-bootstrap tests.
 * Verifies the public pricing surface keeps the anonymous shell lightweight
 * and only mounts the session-aware path when local auth hints warrant it.
 */
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingRoute } from "../PricingRoute";

const useRouterMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (
      loader: () => Promise<unknown>,
      options?: { loading?: (props: unknown) => ReactNode }
    ) => {
      return function DynamicComponent(props: Record<string, unknown>) {
        const [ResolvedComponent, setResolvedComponent] = React.useState<React.ComponentType<
          Record<string, unknown>
        > | null>(null);

        React.useEffect(() => {
          let cancelled = false;
          void loader().then((loadedModule) => {
            if (cancelled) return;
            const component = loadedModule as React.ComponentType<Record<string, unknown>>;
            setResolvedComponent(() => component);
          });
          return () => {
            cancelled = true;
          };
        }, []);

        if (ResolvedComponent) {
          return <ResolvedComponent {...props} />;
        }
        return options?.loading ? <>{options.loading(props)}</> : null;
      };
    },
  };
});

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
}));

vi.mock("../../../../lib/supabaseSessionHints", () => ({
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

    expect(useSupabaseSessionStateMock).not.toHaveBeenCalled();
  });

  it("boots shared session state when local auth hints exist", async () => {
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);

    render(<PricingRoute billingCatalog={{ plans: [], packages: [], storageAddons: [] }} />);

    expect(useSupabaseSessionStateMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: true });
    });
  });
});
