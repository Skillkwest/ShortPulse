/**
 * Root route tests for the new public dashboard/home surface.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IndexPage from "../../pages/index";

const useRouterMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const useMediaComplianceGateMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const publicFetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => {
    void prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: (...args: unknown[]) => useCreditsMock(...args),
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  ensureSupabaseQueryClient: (...args: unknown[]) => ensureSupabaseQueryClientMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
}));

vi.mock("../../lib/supabaseSessionHints", () => ({
  readSupabaseSessionBootstrapHint: (...args: unknown[]) =>
    readSupabaseSessionBootstrapHintMock(...args),
  readPersistedSupabaseSessionHint: (...args: unknown[]) =>
    readPersistedSupabaseSessionHintMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../features/compliance/hooks/useMediaComplianceGate", () => ({
  useMediaComplianceGate: (...args: unknown[]) => useMediaComplianceGateMock(...args),
}));

vi.mock("../../features/compliance/components/MediaComplianceGate", () => ({
  MediaComplianceGate: () => <div data-testid="media-compliance-gate">Media compliance gate</div>,
}));

const acceptedMediaComplianceState = {
  accepted: true,
  acceptedAt: "2026-06-29T00:00:00.000Z",
  acceptAgreement: vi.fn(),
  agreement: {
    key: "media_usage_compliance",
    version: "2026-04-25",
    title: "Media agreement",
    intro: "Please accept.",
    rules: [],
    checkboxLabel: "I agree",
    confirmLabel: "Continue",
  },
  error: null,
  initialized: true,
  loading: false,
  refreshStatus: vi.fn(),
  status: "accepted",
};

describe("Index route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", publicFetchMock);
    publicFetchMock.mockReturnValue(new Promise(() => {}));
    useRouterMock.mockReturnValue({ push: vi.fn(), replace: vi.fn(), query: {} });
    readSupabaseSessionBootstrapHintMock.mockReturnValue(false);
    readPersistedSupabaseSessionHintMock.mockReturnValue(false);
    useCreditsMock.mockReturnValue({
      balanceCents: null,
      balanceLoading: false,
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
    readSupabaseSessionMock.mockResolvedValue(null);
    useMediaComplianceGateMock.mockReturnValue(acceptedMediaComplianceState);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the public dashboard entry surface at the root route", () => {
    render(
      <IndexPage
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
          ],
          packages: [],
          storageAddons: [],
        }}
        dashboardOffers={[]}
        dashboardTutorials={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: /a true all-in-one for ai creators/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Login" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining("/log-in?next=%2Fdashboard"),
        }),
      ])
    );
  });

  it("holds public signup actions while a stored root session is unresolved", async () => {
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    useRouterMock.mockReturnValue({
      pathname: "/",
      push: vi.fn(),
      replace: vi.fn(),
      query: {},
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });

    render(
      <IndexPage
        billingCatalog={{ plans: [], packages: [], storageAddons: [] }}
        dashboardOffers={[]}
        dashboardTutorials={[]}
      />
    );

    await screen.findByText("Checking your session before your dashboard workspace loads.");
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("keeps signed-in root dashboard content behind the media consent gate", async () => {
    const appUser = {
      id: "user-1",
      email: "user@example.com",
      user_metadata: {
        display_name: "Kirk",
        plan: "business",
      },
    };
    readSupabaseSessionBootstrapHintMock.mockReturnValue(true);
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    useRouterMock.mockReturnValue({
      pathname: "/",
      asPath: "/",
      push: vi.fn(),
      replace: vi.fn(),
      query: {},
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: appUser },
      user: appUser,
    });
    readSupabaseSessionMock.mockResolvedValue({ user: appUser });
    useMediaComplianceGateMock.mockReturnValue({
      ...acceptedMediaComplianceState,
      accepted: false,
      status: "needs_consent",
    });

    render(
      <IndexPage
        billingCatalog={{ plans: [], packages: [], storageAddons: [] }}
        dashboardOffers={[]}
        dashboardTutorials={[]}
      />
    );

    expect(await screen.findByTestId("media-compliance-gate")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile menu" })).not.toBeInTheDocument();
  });
});
