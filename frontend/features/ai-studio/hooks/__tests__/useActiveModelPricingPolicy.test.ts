import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { PRICING_POLICY_REFRESH_REQUESTED_EVENT } from "../../../../lib/model-runtime/pricingPolicyFreshness";
import { useActiveModelPricingPolicy } from "../useActiveModelPricingPolicy";
import { materializeImageBilledCreditPolicy } from "../../../../lib/model-runtime/materializeImageBilledCreditPolicy";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const createPolicyPayload = (activePolicyVersion = 12) => ({
  modelPolicy: {
    version: "runtime-default-v1",
    activePolicyVersion,
    policySource: "control_plane" as const,
    updatedAt: "2026-04-27T17:00:00.000Z",
    updatedByEmail: "ops@example.com",
    creditUsdScale: 100,
    creditValueUsd: 0.01,
    defaultRoundingMode: "ceil" as const,
    defaultRoundingIncrement: 1,
    overrideCount: 1,
    document: materializeImageBilledCreditPolicy({
      schemaVersion: 1 as const,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil" as const,
        defaultRoundingIncrement: 1,
      },
      perModel: {
        [KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]: {
          roundingIncrement: 1,
        },
      },
    }),
  },
});

describe("useActiveModelPricingPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays idle without fetching while disabled", () => {
    const { result } = renderHook(() => useActiveModelPricingPolicy({ enabled: false }));

    expect(result.current.modelPricingPolicyLoading).toBe(false);
    expect(result.current.modelPricingPolicyReady).toBe(false);
    expect(result.current.modelPricingPolicyError).toBeNull();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("loads the authenticated model pricing policy", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => createPolicyPayload(),
    } as unknown as Response);

    const { result } = renderHook(() => useActiveModelPricingPolicy({ enabled: true }));

    expect(result.current.modelPricingPolicyLoading).toBe(true);
    expect(result.current.modelPricingPolicyReady).toBe(false);

    await waitFor(() => {
      expect(result.current.modelPricingPolicyLoading).toBe(false);
    });

    expect(result.current.modelPricingPolicyReady).toBe(true);
    expect(result.current.modelPricingPolicyError).toBeNull();
    expect(
      result.current.modelPricingPolicy?.perModel[KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]
        ?.roundingIncrement
    ).toBe(1);
    expect(
      Object.values(
        result.current.modelPricingPolicy?.perModel[KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]
          ?.variants ?? {}
      ).some((variant) => variant.billedCreditsOverride != null)
    ).toBe(true);
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/pricing/model-policy", {
      cache: "no-store",
      method: "GET",
      shortpulseRetryNetworkOnce: true,
    });
  });

  it("clears the last known policy when refresh fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => createPolicyPayload(),
    } as unknown as Response);

    const { result } = renderHook(() => useActiveModelPricingPolicy({ enabled: true }));

    await waitFor(() => {
      expect(result.current.modelPricingPolicyLoading).toBe(false);
    });

    expect(result.current.modelPricingPolicy).not.toBeNull();

    fetchWithAuthMock.mockRejectedValueOnce(new Error("network down"));

    await act(async () => {
      await result.current.refreshModelPricingPolicy();
    });

    await waitFor(() => {
      expect(result.current.modelPricingPolicyLoading).toBe(false);
    });

    expect(result.current.modelPricingPolicyReady).toBe(false);
    expect(result.current.modelPricingPolicy).toBeNull();
    expect(result.current.modelPricingPolicyError).toBe("network down");
  });

  it("dedupes overlapping model pricing loads across concurrent hook mounts", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchWithAuthMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    const first = renderHook(() => useActiveModelPricingPolicy({ enabled: true }));
    const second = renderHook(() => useActiveModelPricingPolicy({ enabled: true }));

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    resolveResponse(
      new Response(JSON.stringify(createPolicyPayload()), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    await waitFor(() => {
      expect(first.result.current.modelPricingPolicyLoading).toBe(false);
      expect(second.result.current.modelPricingPolicyLoading).toBe(false);
    });

    expect(first.result.current.modelPricingPolicyReady).toBe(true);
    expect(second.result.current.modelPricingPolicyReady).toBe(true);
  });

  it("invalidates readiness and waits for a genuinely fresh request after a pricing conflict", async () => {
    const responseResolvers: Array<(response: Response) => void> = [];
    fetchWithAuthMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responseResolvers.push(resolve);
        })
    );

    const { result } = renderHook(() => useActiveModelPricingPolicy({ enabled: true }));

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event(PRICING_POLICY_REFRESH_REQUESTED_EVENT));
      window.dispatchEvent(new Event(PRICING_POLICY_REFRESH_REQUESTED_EVENT));
    });

    expect(result.current.modelPricingPolicyReady).toBe(false);
    expect(result.current.modelPricingPolicyLoading).toBe(true);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    act(() => {
      responseResolvers[0]?.(
        new Response(JSON.stringify(createPolicyPayload(12)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    });
    expect(result.current.modelPricingPolicyReady).toBe(false);

    act(() => {
      responseResolvers[1]?.(
        new Response(JSON.stringify(createPolicyPayload(13)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await waitFor(() => {
      expect(result.current.modelPricingPolicyLoading).toBe(false);
    });

    expect(result.current.modelPricingPolicyReady).toBe(true);
    expect(result.current.modelPricingPolicySnapshot?.activePolicyVersion).toBe(13);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
  });
});
