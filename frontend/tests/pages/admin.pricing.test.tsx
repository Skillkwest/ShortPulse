import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPricingPage from "../../pages/admin/pricing";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminPricingControllerMock = vi.hoisted(() => vi.fn());
const refreshPricingStateMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminPricingController", () => ({
  useAdminPricingController: (...args: unknown[]) => useAdminPricingControllerMock(...args),
}));

const buildPricingState = () => ({
  generatedAt: "2026-04-24T12:00:00.000Z",
  modelPolicy: {
    version: "policy-v3",
    activePolicyVersion: 3,
    policySource: "control_plane",
    updatedAt: "2026-04-24T12:00:00.000Z",
    updatedByEmail: "admin@example.com",
    creditUsdScale: 100,
    creditValueUsd: 0.01,
    markupBps: 300,
    markupPercent: 3,
    defaultRoundingMode: "nearest-5",
    defaultRoundingIncrement: 5,
    overrideCount: 0,
    document: {
      schemaVersion: 1,
      global: {
        creditUsdScale: 100,
        markupBps: 300,
        defaultRoundingMode: "nearest-5",
        defaultRoundingIncrement: 5,
      },
      perModel: {},
    },
  },
  models: [
    {
      id: "fal-ai/flux-2/klein/9b",
      label: "FLUX.2 Lite",
      provider: "fal",
      workflowType: "text_to_image",
      pricingStrategy: "fal-economy-image-per-mp",
      pricingStrategyLabel: "fal-economy-image-per-mp",
      defaultAspect: "4:3",
      defaultResolution: "model_default",
      defaultDurationSeconds: null,
      roundingIncrement: 5,
      pricingPreview: {
        usdRaw: 0.08,
        rawCredits: 8,
        billedCredits: 10,
        billedUsd: 0.1,
      },
    },
  ],
  plans: [],
  creditPackages: [],
  storageAddons: [],
  health: {
    planOffersMissingStripePriceIds: 0,
    storageOffersMissingStripePriceIds: 0,
    creditPackagesMissingStripePriceIds: 0,
    totalWarnings: 0,
    warnings: [],
  },
});

describe("Admin pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshPricingStateMock.mockResolvedValue(undefined);
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-1", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("shows a route-level loading state before the first pricing snapshot resolves", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: null,
      pricingLoading: true,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Loading pricing workspace" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Fetching the current model policy, public catalog rows, and Stripe linkage health."
      )
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
  });

  it("shows a route-level retry state when the first pricing fetch fails", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: null,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: "Pricing API unavailable.",
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Pricing state is unavailable" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pricing API unavailable.")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));
    expect(refreshPricingStateMock).toHaveBeenCalledTimes(1);
  });

  it("shows stale-data warning while keeping the pricing workspace visible", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: "Background refresh failed.",
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.queryByText("Current pricing snapshot")).not.toBeInTheDocument();
    expect(screen.getByText("Runtime model policy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Background refresh failed. Showing the last loaded pricing snapshot while refresh recovers."
      )
    ).toBeInTheDocument();
  });
});
