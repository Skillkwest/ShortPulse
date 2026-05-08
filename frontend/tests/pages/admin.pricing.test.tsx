import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPricingPage from "../../pages/admin/pricing";
import type { AdminPricingStateResponse } from "../../features/admin/types";
import { buildDefaultPricingParams, computeCostForModel } from "../../lib/model-runtime/pricing";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";

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
      defaultResolution: "model_default",
      defaultDurationSeconds: null,
      defaultSourceDurationSeconds: null,
      minDurationSeconds: null,
      maxDurationSeconds: null,
      allowedDurations: [],
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
        stripePriceId: "price_business_year_current",
        acquisitionEnabled: true,
        isActive: true,
        effectiveStartAt: "2026-04-24T12:00:00.000Z",
      },
    },
  ],
});

const openCatalogTools = () => {
  const toggle = screen.getByRole("button", {
    name: /Show catalog tools|Hide catalog tools/,
  });
  if (toggle.textContent?.includes("Show")) {
    fireEvent.click(toggle);
  }
};

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
    expect(screen.getByLabelText("Search pricing models")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Background refresh failed. Showing the last loaded pricing snapshot while refresh recovers."
      )
    ).toBeInTheDocument();
  });

  it("keeps usage-mix assumptions scoped to the selected plan", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingStateWithPlans(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Runs / month"), {
      target: { value: "99" },
    });

    fireEvent.change(screen.getByLabelText("Plan"), {
      target: { value: "business" },
    });
    expect(screen.getByLabelText("Runs / month")).toHaveValue("10");

    fireEvent.change(screen.getByLabelText("Runs / month"), {
      target: { value: "5" },
    });

    fireEvent.change(screen.getByLabelText("Plan"), {
      target: { value: "studio" },
    });
    expect(screen.getByLabelText("Runs / month")).toHaveValue("99");
  });

  it("resets support-module plan inputs back to live-derived defaults when resetting the pricing draft", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingStateWithPlans(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Plan price ($)"), {
      target: { value: "49.00" },
    });

    fireEvent.change(screen.getByLabelText("Model markup for FLUX.2 Lite"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset draft" }));

    expect(screen.getByLabelText("Plan price ($)")).toHaveValue("39.00");
  });

  it("reseeds untouched plan analysis drafts when live plan pricing refreshes", () => {
    const initialState = buildPricingStateWithPlans();
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: initialState,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    const { rerender } = render(<AdminPricingPage />);

    expect(screen.getByLabelText("Plan price ($)")).toHaveValue("39.00");

    const refreshedState = buildPricingStateWithPlans();
    refreshedState.plans[0] = {
      ...refreshedState.plans[0],
      recurringPriceCents: 4900,
      monthlyCreditsCents: 3500,
      monthlyOffer: {
        ...refreshedState.plans[0].monthlyOffer!,
        recurringPriceCents: 4900,
        monthlyCreditsCents: 3500,
      },
    };
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: refreshedState,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    rerender(<AdminPricingPage />);

    expect(screen.getByLabelText("Plan price ($)")).toHaveValue("49.00");
    expect(screen.getByLabelText("Included credits")).toHaveValue("3500");
  });

  it("renders catalog health warnings from the pricing state", () => {
    const state = buildPricingState();
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

    render(<AdminPricingPage />);

    expect(screen.getByRole("heading", { name: "Catalog warnings" })).toBeInTheDocument();
    expect(
      screen.getByText("1 active public plan offer missing Stripe price ids.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 active storage add-on offer missing Stripe price ids.")
    ).toBeInTheDocument();
  });

  it("keeps inactive credit packages and unconfigured storage add-ons visible", () => {
    const state = buildPricingState();
    state.creditPackages = [
      {
        id: "starter_500",
        displayName: "Starter 500",
        creditAmountCents: 500,
        priceCents: 900,
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
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);
    openCatalogTools();

    expect(screen.getByText("Starter 500")).toBeInTheDocument();
    expect(screen.getAllByText("inactive").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Extra 100 GB")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Create first offer" })).toBeInTheDocument();
  });

  it("renders model type and margin columns in the workbook", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Margin").length).toBeGreaterThan(0);
    expect(screen.getByText("Round")).toBeInTheDocument();
    expect(screen.getAllByText("text → image").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Round nearest for FLUX.2 Lite")).toHaveValue("");
    expect(screen.getAllByText("0.648").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("$0.0065").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("$0.0100")).not.toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("sorts workbook models by label, type family, and raw provider cost", () => {
    const state = buildPricingState();
    const baseModel = state.models[0];
    state.models = [
      {
        ...baseModel,
        id: "model-zulu",
        label: "Zulu Model",
        workflowType: "Image to image",
        pricingPreview: {
          usdRaw: 0.2,
          rawCredits: 20,
          billedCredits: 21,
          billedUsd: 0.21,
        },
        pricingPreviewVariants: [
          {
            id: "default",
            label: "Default",
            breakdown: {
              usdRaw: 0.2,
              rawCredits: 20,
              billedCredits: 21,
              billedUsd: 0.21,
            },
          },
        ],
      },
      {
        ...baseModel,
        id: "model-middle",
        label: "Middle Model",
        provider: "elevenlabs",
        workflowType: "Text",
        pricingStrategy: "elevenlabs-voice-changer-per-minute",
        pricingStrategyLabel: "Per minute",
        pricingPreview: {
          usdRaw: 0.08,
          rawCredits: 8,
          billedCredits: 9,
          billedUsd: 0.09,
        },
        pricingPreviewVariants: [
          {
            id: "default",
            label: "Default",
            breakdown: {
              usdRaw: 0.08,
              rawCredits: 8,
              billedCredits: 9,
              billedUsd: 0.09,
            },
          },
        ],
      },
      {
        ...baseModel,
        id: "model-alpha",
        label: "Alpha Model",
        workflowType: "Text to image",
        pricingPreview: {
          usdRaw: 0.01,
          rawCredits: 1,
          billedCredits: 2,
          billedUsd: 0.02,
        },
        pricingPreviewVariants: [
          {
            id: "default",
            label: "Default",
            breakdown: {
              usdRaw: 0.01,
              rawCredits: 1,
              billedCredits: 2,
              billedUsd: 0.02,
            },
          },
        ],
      },
    ];
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const modelOrder = () =>
      screen
        .getAllByRole("button", { name: /Configure pricing override for/ })
        .map((button) => button.textContent?.trim());
    const sortSelect = screen.getByLabelText("Sort models");

    expect(sortSelect).toHaveValue("type");
    expect(screen.getByRole("option", { name: "Type" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Type A-Z" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Type Z-A" })).toBeNull();
    expect(modelOrder()).toEqual(["Alpha Model", "Zulu Model", "Middle Model"]);

    fireEvent.change(sortSelect, { target: { value: "model_asc" } });
    expect(modelOrder()).toEqual(["Alpha Model", "Middle Model", "Zulu Model"]);

    fireEvent.change(sortSelect, { target: { value: "model_desc" } });
    expect(modelOrder()).toEqual(["Zulu Model", "Middle Model", "Alpha Model"]);

    fireEvent.change(sortSelect, { target: { value: "type" } });
    expect(modelOrder()).toEqual(["Alpha Model", "Zulu Model", "Middle Model"]);

    fireEvent.change(sortSelect, { target: { value: "cost_desc" } });
    expect(modelOrder()[0]).toBe("Zulu Model");

    fireEvent.change(sortSelect, { target: { value: "cost_asc" } });
    expect(modelOrder()[0]).toBe("Alpha Model");
  });

  it("renders inline create/edit pricing preview variants for dual-capability models", () => {
    const state = buildPricingState();
    state.models = [
      {
        ...state.models[0],
        id: "gpt-image-2",
        label: "ChatGPT Image 2",
        workflowType: "Text + image edit",
        pricingPreview: {
          usdRaw: 0.08,
          rawCredits: 8,
          billedCredits: 10,
          billedUsd: 0.1,
        },
        pricingPreviewVariants: [
          {
            id: "create",
            label: "Create",
            breakdown: {
              usdRaw: 0.08,
              rawCredits: 8,
              billedCredits: 10,
              billedUsd: 0.1,
            },
          },
          {
            id: "edit",
            label: "Edit",
            breakdown: {
              usdRaw: 0.12,
              rawCredits: 12,
              billedCredits: 15,
              billedUsd: 0.15,
            },
          },
        ],
      },
    ];

    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByText("Create / model_default / 4:3")).toBeInTheDocument();
    expect(screen.getByText("Edit / model_default / 4:3")).toBeInTheDocument();
    expect(screen.getAllByText("text → image").length).toBeGreaterThan(0);
    expect(screen.getAllByText("image → image").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Model markup for ChatGPT Image 2 Create")).toBeInTheDocument();
    expect(screen.getByLabelText("Model markup for ChatGPT Image 2 Edit")).toBeInTheDocument();
  });

  it("recalculates workbook pricing from the entered duration", () => {
    const state = buildPricingState();
    state.models = [
      {
        ...state.models[0],
        id: "kie-ai/kling-3.0",
        label: "Kling 3.0 (Kie)",
        provider: "kie",
        workflowType: "Image to video",
        pricingStrategy: "kling-3-per-second",
        pricingStrategyLabel: "Per output second",
        defaultAspect: "16:9",
        defaultResolution: "1080p",
        defaultDurationSeconds: 10,
        minDurationSeconds: 3,
        maxDurationSeconds: 15,
        allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      },
    ];
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const durationInput = screen.getByLabelText("Duration seconds for Kling 3.0 (Kie)");
    expect(durationInput).toHaveValue(10);

    fireEvent.change(durationInput, { target: { value: "5" } });

    const expectedCost = computeCostForModel(
      "kie-ai/kling-3.0",
      buildDefaultPricingParams("kie-ai/kling-3.0", { durationSeconds: 5 }),
      state.modelPolicy.document as ModelPricingPolicyDocument
    );
    const expectedRawCreditsAtCost = (expectedCost?.usdRaw ?? 0) * 100;
    const expectedCreditsAtCost = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: Number.isInteger(expectedRawCreditsAtCost) ? 0 : 2,
      maximumFractionDigits: expectedRawCreditsAtCost > 0 && expectedRawCreditsAtCost < 1 ? 4 : 2,
    }).format(expectedRawCreditsAtCost);
    expect(screen.getAllByText(expectedCreditsAtCost).length).toBeGreaterThanOrEqual(2);
  });

  it("renders a source-duration input for ElevenLabs Voice Changer", () => {
    const state = buildPricingState();
    state.models = [
      {
        ...state.models[0],
        id: "eleven_multilingual_sts_v2",
        label: "ElevenLabs Voice Changer",
        provider: "elevenlabs",
        workflowType: "Text",
        pricingStrategy: "elevenlabs-voice-changer-per-minute",
        pricingStrategyLabel: "Per minute",
        defaultAspect: "audio",
        defaultResolution: null,
        defaultDurationSeconds: null,
        defaultSourceDurationSeconds: 60,
        minDurationSeconds: null,
        maxDurationSeconds: null,
        allowedDurations: [],
      },
    ];
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    expect(screen.getByText("ElevenLabs Voice Changer")).toBeInTheDocument();
    const durationInput = screen.getByLabelText("Duration seconds for ElevenLabs Voice Changer");
    expect(durationInput).toHaveValue(60);

    fireEvent.change(durationInput, { target: { value: "30" } });

    const expectedCost = computeCostForModel(
      "eleven_multilingual_sts_v2",
      buildDefaultPricingParams("eleven_multilingual_sts_v2", { sourceDurationSeconds: 30 }),
      state.modelPolicy.document as ModelPricingPolicyDocument
    );
    const expectedRawCreditsAtCost = (expectedCost?.usdRaw ?? 0) * 100;
    const expectedCreditsAtCost = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: Number.isInteger(expectedRawCreditsAtCost) ? 0 : 2,
      maximumFractionDigits: expectedRawCreditsAtCost > 0 && expectedRawCreditsAtCost < 1 ? 4 : 2,
    }).format(expectedRawCreditsAtCost);
    expect(screen.getAllByText(expectedCreditsAtCost).length).toBeGreaterThanOrEqual(2);
  });

  it("recalculates workbook pricing from the global credit conversion draft", () => {
    const state = buildPricingState();
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: state,
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const conversionInput = screen.getByLabelText("Global credit conversion");
    expect(conversionInput).toHaveValue("100");

    fireEvent.change(conversionInput, { target: { value: "30" } });

    expect(screen.getByRole("button", { name: "Save draft live" })).not.toBeDisabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getAllByText("0.1944").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("$0.0065").length).toBeGreaterThanOrEqual(2);
  });

  it("recalculates workbook pricing from the round-nearest draft", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const roundInput = screen.getByLabelText("Round nearest for FLUX.2 Lite");
    expect(roundInput).toHaveValue("");

    fireEvent.change(roundInput, { target: { value: "5" } });
    expect(roundInput).toHaveValue("5");

    const expectedCredits = computeCostForModel(
      "fal-ai/flux-2/klein/9b",
      buildDefaultPricingParams("fal-ai/flux-2/klein/9b"),
      {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {
          "fal-ai/flux-2/klein/9b": {
            roundingIncrement: 5,
          },
        },
      }
    )?.credits;

    expect(screen.getByRole("button", { name: "Save draft live" })).not.toBeDisabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getAllByText(String(expectedCredits)).length).toBeGreaterThan(0);
    expect(screen.getByText("$0.0500")).toBeInTheDocument();
  });

  it("keeps model override input drafts stable while typing zero values", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const rowMarkupInput = screen.getByLabelText("Model markup for FLUX.2 Lite");
    fireEvent.change(rowMarkupInput, { target: { value: "0" } });
    expect(rowMarkupInput).toHaveValue("0");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Configure pricing override for FLUX.2 Lite",
      })
    );

    const conversionInput = screen.getByLabelText("Credit conversion override");
    fireEvent.change(conversionInput, { target: { value: "0" } });
    expect(conversionInput).toHaveValue("0");

    const inlineMarkupInput = screen.getByLabelText("Model markup");
    fireEvent.change(inlineMarkupInput, { target: { value: "0" } });
    expect(inlineMarkupInput).toHaveValue("0");
    expect(rowMarkupInput).toHaveValue("0");

    const inlineRoundingInput = screen.getByLabelText("Roundup increment override");
    fireEvent.change(inlineRoundingInput, { target: { value: "0" } });
    expect(inlineRoundingInput).toHaveValue("0");
    expect(screen.getByLabelText("Round nearest for FLUX.2 Lite")).toHaveValue("0");
  });

  it("previews empty model markup drafts at cost", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    const rowMarkupInput = screen.getByLabelText("Model markup for FLUX.2 Lite");
    fireEvent.change(rowMarkupInput, { target: { value: "25" } });
    fireEvent.change(rowMarkupInput, { target: { value: "" } });

    expect(rowMarkupInput).toHaveValue("");
    expect(screen.getAllByText("$0.0065").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("$0.0100")).not.toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("disables model policy confirmation for invalid visible row drafts", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Model markup for FLUX.2 Lite"), {
      target: { value: "." },
    });
    expect(screen.getByRole("button", { name: "Save draft live" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save draft live" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows provider pricing docs when hovering the cost unit", () => {
    const state = buildPricingState();
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: {
        ...state,
        models: [
          ...state.models,
          {
            ...state.models[0],
            id: "fal-ai/flux-pro/v1/fill",
            label: "FLUX Pro Fill",
            pricingStrategy: "fal-fill-per-mp",
            pricingStrategyLabel: "fal-fill-per-mp",
          },
        ],
      },
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.mouseEnter(screen.getByLabelText("Show provider pricing docs for FLUX.2 Lite"), {
      clientX: 500,
      clientY: 300,
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Provider cost basis used here: $0.006 per output megapixel."
    );
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("Source:");

    fireEvent.mouseEnter(screen.getByLabelText("Show provider pricing docs for FLUX Pro Fill"), {
      clientX: 520,
      clientY: 320,
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate."
    );
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("rounded up");
  });

  it("saves edited plan pricing as a new current offer", async () => {
    const state = {
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
            stripePriceId: "price_studio_year_current",
            acquisitionEnabled: true,
            isActive: true,
            effectiveStartAt: "2026-04-24T12:00:00.000Z",
          },
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

    render(<AdminPricingPage />);
    openCatalogTools();

    fireEvent.click(screen.getByRole("button", { name: "Edit monthly" }));
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

    const [, requestOptions] = fetchWithAuthMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body)).toEqual(
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

  it("can start a first annual offer draft when a plan has no annual offer", async () => {
    const state = {
      ...buildPricingState(),
      plans: [
        {
          planId: "creator",
          displayName: "Creator",
          offerId: "creator__current",
          sortOrder: 40,
          accountCount: 0,
          status: "active",
          recurringPriceCents: 5900,
          monthlyCreditsCents: 4500,
          storageLimitBytes: 214748364800,
          stripeProductId: "prod_creator",
          stripePriceId: "price_creator_current",
          acquisitionEnabled: true,
          isActive: true,
          effectiveStartAt: "2026-04-24T12:00:00.000Z",
          monthlyOffer: {
            offerId: "creator__current",
            recurringPriceCents: 5900,
            monthlyCreditsCents: 4500,
            storageLimitBytes: 214748364800,
            stripePriceId: "price_creator_current",
            acquisitionEnabled: true,
            isActive: true,
            effectiveStartAt: "2026-04-24T12:00:00.000Z",
          },
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

    render(<AdminPricingPage />);
    openCatalogTools();

    fireEvent.click(screen.getByRole("button", { name: "Create annual" }));

    expect(screen.getByText("Edit plan pricing")).toBeInTheDocument();
    expect(screen.getByLabelText("Recurring price (cents)")).toHaveValue("70800");
    expect(screen.getByLabelText("Stripe price id")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Stripe price id"), {
      target: { value: "price_creator_year" },
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
    const [, requestOptions] = fetchWithAuthMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body)).toEqual(
      expect.objectContaining({
        billingInterval: "year",
        expectedCurrentOfferId: null,
        expectedCurrentOfferAbsent: true,
        stripePriceId: "price_creator_year",
      })
    );
  });

  it("creates new plans with an annual price draft", async () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);
    openCatalogTools();

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
    const [, requestOptions] = fetchWithAuthMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body)).toEqual(
      expect.objectContaining({
        planId: "creator",
        recurringPriceCents: "5900",
        annualRecurringPriceCents: "70800",
      })
    );
  });

  it("disables confirmation when a draft has known-invalid values", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);
    openCatalogTools();

    fireEvent.click(screen.getByRole("button", { name: "Create new plan" }));
    fireEvent.change(screen.getByLabelText("Plan id"), {
      target: { value: "creator" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Creator" },
    });
    fireEvent.change(screen.getByLabelText("Recurring price (cents)"), {
      target: { value: "not-a-number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create plan" })
    ).toBeDisabled();
  });

  it("disables paid plan offer confirmation when Stripe linkage is missing", () => {
    const state = {
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
            stripePriceId: "price_studio_current",
            acquisitionEnabled: true,
            isActive: true,
            effectiveStartAt: "2026-04-24T12:00:00.000Z",
          },
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

    render(<AdminPricingPage />);
    openCatalogTools();

    fireEvent.click(screen.getByRole("button", { name: "Edit monthly" }));
    fireEvent.change(screen.getByLabelText("Stripe price id"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Activate offer" })
    ).toBeDisabled();
  });

  it("disables non-free zero-price plan confirmations", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);
    openCatalogTools();

    fireEvent.click(screen.getByRole("button", { name: "Create new plan" }));
    fireEvent.change(screen.getByLabelText("Plan id"), {
      target: { value: "creator" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Creator" },
    });
    fireEvent.change(screen.getByLabelText("Recurring price (cents)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Annual price (cents)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Monthly credits"), {
      target: { value: "4500" },
    });
    fireEvent.change(screen.getByLabelText("Storage bytes"), {
      target: { value: "214748364800" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create plan" })
    ).toBeDisabled();
  });

  it("applies current row markup input without requiring a blur first", async () => {
    fetchWithAuthMock.mockImplementationOnce(async (_url, options) => ({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        activePolicyVersion: 4,
        activePolicy: JSON.parse(String(options?.body ?? "{}")).policy,
      })),
    }));
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

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/pricing/model-policy/apply",
        expect.objectContaining({ method: "POST" })
      )
    );

    const [, requestOptions] = fetchWithAuthMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body).policy.perModel["fal-ai/flux-2/klein/9b"]).toEqual({
      markupBps: 1250,
    });
    await waitFor(() => expect(refreshPricingStateMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Model pricing policy v4 saved.")).toBeInTheDocument();
  });

  it("shows verified row pricing after the admin state refreshes", async () => {
    const persistedState = buildPricingState();
    persistedState.modelPolicy = {
      ...persistedState.modelPolicy,
      version: "policy-v4",
      activePolicyVersion: 4,
      updatedAt: "2026-04-24T13:00:00.000Z",
      updatedByEmail: "admin2@example.com",
      document: {
        schemaVersion: 1 as const,
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
    };
    let currentState = buildPricingState();
    fetchWithAuthMock.mockImplementationOnce(async (_url, options) => ({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        activePolicyVersion: 4,
        activePolicy: JSON.parse(String(options?.body ?? "{}")).policy,
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
    const [, requestOptions] = fetchWithAuthMock.mock.calls[0];
    const submittedPolicy = JSON.parse(requestOptions.body).policy;
    expect(submittedPolicy.perModel["fal-ai/flux-2/klein/9b"]).toEqual({ markupBps: 20000 });
    await waitFor(() => expect(refreshPricingStateMock).toHaveBeenCalledTimes(1));

    rerender(<AdminPricingPage />);

    expect(screen.getByLabelText("Model markup for FLUX.2 Lite")).toHaveValue("200");

    screen.getByRole("button", {
      name: "Configure pricing override for FLUX.2 Lite",
    });
    expect(screen.getByText("$0.0194")).toBeInTheDocument();
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

  it("updates current model credit previews from the row draft policy", () => {
    useAdminPricingControllerMock.mockReturnValue({
      pricingState: buildPricingState(),
      pricingLoading: false,
      pricingRefreshing: false,
      pricingError: null,
      refreshPricingState: refreshPricingStateMock,
    });

    render(<AdminPricingPage />);

    fireEvent.change(screen.getByLabelText("Model markup for FLUX.2 Lite"), {
      target: { value: "200" },
    });

    screen.getByRole("button", {
      name: "Configure pricing override for FLUX.2 Lite",
    });
    expect(screen.getByText("$0.0194")).toBeInTheDocument();
  });
});
