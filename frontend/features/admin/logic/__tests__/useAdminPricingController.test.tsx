import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminPricingController } from "../useAdminPricingController";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

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
  models: [],
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

describe("useAdminPricingController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pricing state when enabled", async () => {
    fetchWithAuthMock.mockResolvedValue(jsonResponse(buildPricingState()));

    const { result } = renderHook(() => useAdminPricingController({ enabled: true }));

    await waitFor(() => expect(result.current.pricingState).not.toBeNull());

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/pricing/state",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.current.pricingError).toBeNull();
    expect(result.current.pricingLoading).toBe(false);
  });

  it("preserves the last loaded pricing snapshot when a refresh fails", async () => {
    let mode: "success" | "error" = "success";
    fetchWithAuthMock.mockImplementation(() => {
      if (mode === "error") {
        return Promise.resolve(jsonResponse({ error: "Refresh failed." }, false));
      }
      return Promise.resolve(jsonResponse(buildPricingState()));
    });

    const { result } = renderHook(() => useAdminPricingController({ enabled: true }));

    await waitFor(() => expect(result.current.pricingState).not.toBeNull());

    const initialSnapshot = result.current.pricingState;

    mode = "error";
    await act(async () => {
      await result.current.refreshPricingState();
    });

    expect(result.current.pricingState).toEqual(initialSnapshot);
    expect(result.current.pricingError).toBe("Refresh failed.");
    expect(result.current.pricingRefreshing).toBe(false);
  });
});
