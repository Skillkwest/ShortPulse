import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminOffersController } from "../useAdminOffersController";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

type MockOffer = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  offerKind: "custom" | "plan" | "credit_package" | "model_pricing" | "storage_addon";
  discountLabel: string;
  targetLabel: string;
  ctaLabel: string;
  ctaHref: string;
  displayOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

const buildOffer = (overrides: Partial<MockOffer> = {}): MockOffer => ({
  id: "offer-1",
  eyebrow: "Launch",
  title: "Save on Studio",
  description: "",
  offerKind: "plan",
  discountLabel: "Save 30%",
  targetLabel: "Studio annual",
  ctaLabel: "View plan",
  ctaHref: "/pricing",
  displayOrder: 1,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z",
  ...overrides,
});

describe("useAdminOffersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bulk-saves only changed offer slots", async () => {
    let offers = [buildOffer()];
    const savedBodies: unknown[] = [];

    fetchWithAuthMock.mockImplementation(async (_url: string, options?: { body?: string }) => {
      if (!options?.body) {
        return jsonResponse({ offers });
      }

      const body = JSON.parse(options.body) as Partial<MockOffer> & { id?: string | null };
      savedBodies.push(body);
      const savedOffer = buildOffer({
        ...body,
        id: body.id ?? "offer-2",
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:01:00.000Z",
      });
      offers = [
        savedOffer,
        ...offers.filter((offer) => offer.id !== savedOffer.id && offer.id !== body.id),
      ].sort((left, right) => left.displayOrder - right.displayOrder);
      return jsonResponse({ offer: savedOffer, message: "Offer saved and active." });
    });

    const { result } = renderHook(() => useAdminOffersController({ enabled: true }));

    await waitFor(() => expect(result.current.offers).toHaveLength(1));
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      result.current.updateDraft(0, { title: "Updated Studio offer" });
      result.current.updateDraft(1, { title: "Creator bundle", discountLabel: "Bonus credits" });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.saveAllOffers();
    });

    expect(result.current.error ?? result.current.result).toBe("2 offers saved.");
    expect(savedBodies).toHaveLength(2);
    expect(savedBodies[0]).toEqual(
      expect.objectContaining({
        id: "offer-1",
        title: "Updated Studio offer",
        displayOrder: 1,
      })
    );
    expect(savedBodies[1]).toEqual(
      expect.objectContaining({
        id: null,
        title: "Creator bundle",
        discountLabel: "Bonus credits",
        displayOrder: 2,
      })
    );
    expect(result.current.result).toBe("2 offers saved.");
  });

  it("does not bulk-save dirty placeholder slots without titles", async () => {
    fetchWithAuthMock.mockResolvedValue(jsonResponse({ offers: [buildOffer()] }));

    const { result } = renderHook(() => useAdminOffersController({ enabled: true }));

    await waitFor(() => expect(result.current.offers).toHaveLength(1));

    act(() => {
      result.current.updateDraft(2, { discountLabel: "Save 20%" });
    });

    await act(async () => {
      await result.current.saveAllOffers();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("Offer 3 title is required.");
  });
});
