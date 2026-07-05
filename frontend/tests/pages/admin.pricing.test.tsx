import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCatalogPage from "../../pages/admin/catalog";
import AdminPricingPage from "../../pages/admin/pricing";
import type { AdminPricingStateResponse } from "../../features/admin/types";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const useAdminPricingControllerMock = vi.hoisted(() => vi.fn());
const refreshPricingStateMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminPricingController", () => ({
  useAdminPricingController: (...args: unknown[]) => useAdminPricingControllerMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const buildPricingState = (): AdminPricingStateResponse => ({
  generatedAt: "2026-04-24T12:00:00.000Z",
  modelPolicy: {
    version: "policy-v3",
    activePolicyVersion: 3,
    policySource: "control_plane",
    updatedAt: "2026-04-24T12:00:00.000Z",
    updatedByEmail: "admin@example.com",
    creditUsdScale: 100,
    creditValueUsd: 0.01,
    defaultRoundingMode: "ceil",
    defaultRoundingIncrement: 1,
    overrideCount: 0,
    document: {
      schemaVersion: 1,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil",
        defaultRoundingIncrement: 1,
      },
      perModel: {},
    },
  },
  customRows: {
    schemaVersion: 1,
    rowsByModel: {},
  },
  models: [
    {
      id: "fal-ai/flux-2/klein/9b",
      label: "FLUX.2 Lite",
      provider: "fal",
      sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
      workflowType: "Text to image",
      pricingStrategy: "fal-economy-image-per-mp",
      pricingStrategyLabel: "fal-economy-image-per-mp",
      defaultAspect: "4:3",
      allowedAspects: ["4:3"],
      defaultResolution: "model_default",
      allowedResolutions: ["model_default"],
      defaultDurationSeconds: null,
      defaultSourceDurationSeconds: null,
      minDurationSeconds: null,
      maxDurationSeconds: null,
      allowedDurations: [],
      defaultAudio: null,
      roundingIncrement: 5,
      pricingAuthority: "shared_policy",
      pricingPreview: {
        usdRaw: 0.08,
        rawCredits: 8,
        billedCredits: 10,
        billedUsd: 0.1,
      },
      pricingPreviewVariants: [
        {
          id: "default",
          label: "Default",
          breakdown: {
            usdRaw: 0.08,
            rawCredits: 8,
            billedCredits: 10,
            billedUsd: 0.1,
          },
        },
      ],
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

const buildPricingStateWithPlans = (): AdminPricingStateResponse => ({
  ...buildPricingState(),
  plans: [
    {
      planId: "studio",
      displayName: "Studio",
      offerId: "studio__current",
      sortOrder: 30,
      accountCount: 4,
      status: "active",
      recurringPriceCents: 3900,
      monthlyCreditsCents: 3000,
      storageLimitBytes: 107374182400,
      maxConcurrentGenerations: 4,
      stripeProductId: "prod_studio",
      stripePriceId: "price_studio_current",
      acquisitionEnabled: true,
      isActive: true,
      effectiveStartAt: "2026-04-24T12:00:00.000Z",
      monthlyOffer: {
        offerId: "studio__current",
        recurringPriceCents: 3900,
        monthlyCreditsCents: 3000,
        storageLimitBytes: 107374182400,
        maxConcurrentGenerations: 4,
        stripePriceId: "price_studio_current",
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
      },
      annualOffer: {
        offerId: "studio__year_current",
        recurringPriceCents: 39000,
        monthlyCreditsCents: 3000,
        storageLimitBytes: 107374182400,
        maxConcurrentGenerations: 4,
        stripePriceId: "price_studio_year_current",
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
      },
    },
    {
      planId: "business",
      displayName: "Business",
      offerId: "business__current",
      sortOrder: 40,
      accountCount: 2,
      status: "active",
      recurringPriceCents: 9900,
      monthlyCreditsCents: 8000,
      storageLimitBytes: 214748364800,
      maxConcurrentGenerations: 8,
      stripeProductId: "prod_business",
      stripePriceId: "price_business_current",
      acquisitionEnabled: true,
      isActive: true,
      effectiveStartAt: "2026-04-24T12:00:00.000Z",
      monthlyOffer: {
        offerId: "business__current",
        recurringPriceCents: 9900,
        monthlyCreditsCents: 8000,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 8,
        stripePriceId: "price_business_current",
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
      },
      annualOffer: {
        offerId: "business__year_current",
        recurringPriceCents: 99000,
        monthlyCreditsCents: 8000,
        storageLimitBytes: 214748364800,
        maxConcurrentGenerations: 8,
        stripePriceId: "price_business_year_current",
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
      },
    },
  ],
});

describe("Admin pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshPricingStateMock.mockResolvedValue(undefined);
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({ ok: true, message: "Saved." })),
    });
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

    expect(screen.getAllByText("Pricing API unavailable.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));
    expect(refreshPricingStateMock).toHaveBeenCalledTimes(1);
  });

  it("shows stale-data warning while keeping the pricing workspace visible", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError:
        "Background refresh failed. Showing the last loaded pricing snapshot while refresh recovers.",
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByLabelText("Search pricing models")).toBeInTheDocument();
    expect(screen.getByText(/Background refresh failed\./)).toBeInTheDocument();
  });

  it("keeps catalog tools off the model pricing page", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingStateWithPlans(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Model Pricing" })).toBeInTheDocument();
    expect(screen.getByText("Pricing Grid")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Catalog tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create new plan" })).not.toBeInTheDocument();
  });

  it("does not treat built-in custom display rows as unsaved pricing edits", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByText("Live pricing active")).toBeInTheDocument();
    expect(
      screen.getByText("No runtime pricing edits. Built-in display rows are loaded from code.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Unsaved draft")).not.toBeInTheDocument();
    expect(screen.queryByText(/Custom rows:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft live" })).toBeDisabled();
  });

  it("renders catalog warnings and catalog tools on the catalog page", () => {
    const state = buildPricingState();
    state.creditPackages = [
      {
        id: "100",
        displayName: "100 credits",
        creditAmountCents: 100,
        priceCents: 500,
        stripePriceId: null,
        sortOrder: 30,
        isActive: false,
      },
    ];
    state.storageAddons = [
      {
        storageAddonId: "storage_100gb",
        displayName: "Extra 100 GB",
        offerId: null,
        storageLimitBytes: 0,
        recurringPriceCents: 0,
        stripePriceId: null,
        acquisitionEnabled: false,
        isActive: false,
        effectiveStartAt: null,
        sortOrder: 20,
      },
    ];
    state.health = {
      planOffersMissingStripePriceIds: 1,
      storageOffersMissingStripePriceIds: 1,
      creditPackagesMissingStripePriceIds: 0,
      totalWarnings: 2,
      warnings: [
        "1 active public plan offer missing Stripe price ids.",
        "1 active storage add-on offer missing Stripe price ids.",
      ],
    };
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminCatalogPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Product Catalog" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Catalog warnings" })).toBeInTheDocument();
    expect(
      screen.getByText("1 active public plan offer missing Stripe price ids.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Catalog tools" })).toBeInTheDocument();
    expect(screen.queryByText("Pricing Grid")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add simulator plan" })).not.toBeInTheDocument();
  });

  it("renders the baseline-access sentinel with the documented product catalog name", () => {
    const state = buildPricingState();
    state.plans = [
      {
        planId: "free",
        displayName: "Baseline access",
        offerId: "free__none",
        sortOrder: 0,
        accountCount: 4,
        status: "legacy",
        recurringPriceCents: 0,
        monthlyCreditsCents: 0,
        storageLimitBytes: 0,
        maxConcurrentGenerations: 0,
        stripeProductId: null,
        stripePriceId: null,
        acquisitionEnabled: false,
        isActive: false,
        effectiveStartAt: null,
        monthlyOffer: null,
        annualOffer: null,
      },
    ];
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminCatalogPage />);

    expect(screen.getByText("Baseline access")).toBeInTheDocument();
    expect(screen.queryByText("Baseline fallback")).not.toBeInTheDocument();
  });

  it("renders workbook controls and lets the admin add simulator plans", () => {
    const state = buildPricingState();
    state.plans = buildPricingStateWithPlans().plans;
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByLabelText("Global credit conversion")).toHaveValue("100");
    expect(screen.getByLabelText("Sort models")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add simulator plan" }));
    expect(screen.getAllByRole("group", { name: /simulator plan$/i }).length).toBeGreaterThan(0);
  });

  it("does not expose the custom pricing variant row add control", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /FLUX\.2 Lite/i })[0]!);

    expect(screen.queryByRole("button", { name: "Add custom variant" })).not.toBeInTheDocument();
    expect(screen.queryByText("Custom variant 1")).not.toBeInTheDocument();
    expect(screen.getAllByText("FLUX.2 Lite").length).toBeGreaterThan(1);
  });

  it("saves model policy drafts and preserves the refreshed preview", async () => {
    const persistedState: AdminPricingStateResponse = {
      ...buildPricingState(),
      modelPolicy: {
        ...buildPricingState().modelPolicy,
        version: "policy-v4",
        activePolicyVersion: 4,
        updatedAt: "2026-04-24T13:00:00.000Z",
        updatedByEmail: "admin2@example.com",
        document: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil" as const,
            defaultRoundingIncrement: 1,
          },
          perModel: {
            "fal-ai/flux-2/klein/9b": {
              markupBps: 20000,
            },
          },
        },
      },
    };
    let currentState = buildPricingState();
    fetchWithAuthMock.mockImplementationOnce(async (_url, options) => ({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        activePolicyVersion: 4,
        activePolicy: JSON.parse(String(options?.body ?? "{}")).policy,
        activeCustomRows: JSON.parse(String(options?.body ?? "{}")).customRows,
      })),
    }));
    useAdminPricingControllerMock.mockImplementation(() => ({
      pricingState: currentState,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: async () => {
        currentState = persistedState;
        await refreshPricingStateMock();
      },
    }));

    const { rerender } = render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Model markup for FLUX.2 Lite"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft live" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/pricing/model-policy/apply",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(refreshPricingStateMock).toHaveBeenCalledTimes(1));

    rerender(<AdminPricingPage />);

    expect(screen.getByLabelText("Model markup for FLUX.2 Lite")).toHaveValue("200");
    expect(screen.getByText("Live policy v4")).toBeInTheDocument();
    expect(screen.getByText(/admin2@example\.com/)).toBeInTheDocument();
    expect(screen.getByText("Live pricing active")).toBeInTheDocument();
  });

  it("keeps the draft dirty when the applied policy cannot be verified", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        activePolicyVersion: 4,
        activePolicy: {
          schemaVersion: 1,
          global: {
            creditUsdScale: 100,
            defaultRoundingMode: "ceil",
            defaultRoundingIncrement: 1,
          },
          perModel: {},
        },
      })),
    });
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Model markup for FLUX.2 Lite"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft live" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "The pricing policy was not confirmed as the active runtime policy. Refresh and retry."
      )
    ).toBeInTheDocument();
    expect(refreshPricingStateMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save draft live" })).not.toBeDisabled()
    );
  });

  it("saves edited monthly plan pricing as a new current offer", async () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingStateWithPlans(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminCatalogPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit monthly" })[0]!);
    fireEvent.change(screen.getByLabelText("Recurring price (cents)"), {
      target: { value: "4900" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Activate offer" })
    );

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/pricing/plan-offers/create",
        expect.objectContaining({ method: "POST" })
      )
    );

    const [, requestOptions] =
      fetchWithAuthMock.mock.calls.find(
        ([url]) => url === "/api/admin/pricing/plan-offers/create"
      ) ?? [];
    expect(JSON.parse(String(requestOptions?.body))).toEqual(
      expect.objectContaining({
        planId: "studio",
        billingInterval: "month",
        recurringPriceCents: "4900",
        monthlyCreditsCents: "3000",
        stripePriceId: "price_studio_current",
        expectedCurrentOfferId: "studio__current",
      })
    );
    await waitFor(() => expect(refreshPricingStateMock).toHaveBeenCalledTimes(1));
  });

  it("creates new plans with an annual price draft", async () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminCatalogPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create new plan" }));
    fireEvent.change(screen.getByLabelText("Plan id"), {
      target: { value: "creator" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Creator" },
    });
    fireEvent.change(screen.getByLabelText("Recurring price (cents)"), {
      target: { value: "5900" },
    });
    expect(screen.getByLabelText("Annual price (cents)")).toHaveValue("70800");
    fireEvent.change(screen.getByLabelText("Monthly credits"), {
      target: { value: "4500" },
    });
    fireEvent.change(screen.getByLabelText("Storage bytes"), {
      target: { value: "214748364800" },
    });
    fireEvent.change(screen.getByLabelText("Max active generations"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create plan" })
    );

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/pricing/plans/create",
        expect.objectContaining({ method: "POST" })
      )
    );
    const [, requestOptions] =
      fetchWithAuthMock.mock.calls.find(([url]) => url === "/api/admin/pricing/plans/create") ?? [];
    expect(JSON.parse(String(requestOptions?.body))).toEqual(
      expect.objectContaining({
        planId: "creator",
        recurringPriceCents: "5900",
        annualRecurringPriceCents: "70800",
        maxConcurrentGenerations: "6",
      })
    );
  });

  it("disables paid plan offer confirmation when Stripe linkage is missing", () => {
    const state = {
      ...buildPricingStateWithPlans(),
      plans: [
        {
          ...buildPricingStateWithPlans().plans[0],
          annualOffer: null,
        },
      ],
    };
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminCatalogPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create annual" }));
    fireEvent.change(screen.getByLabelText("Stripe price id"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Activate offer" })
    ).toBeDisabled();
  });
});
