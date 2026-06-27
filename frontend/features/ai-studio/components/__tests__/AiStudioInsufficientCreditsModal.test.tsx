import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioInsufficientCreditsModal } from "../AiStudioInsufficientCreditsModal";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (payload: unknown, ok = true): Response =>
  ({
    ok,
    json: async () => payload,
  }) as Response;

const withMockedLocationAssign = (fn: (url: string) => void): (() => void) => {
  const previousLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...previousLocation,
      assign: fn,
    },
  });

  return () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: previousLocation,
    });
  };
};

describe("AiStudioInsufficientCreditsModal", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    window.history.pushState({}, "", "/ai-studio?projectId=project-1");
  });

  afterEach(() => {
    document.getElementById("ai-studio-modal-layer-root")?.remove();
  });

  it("starts top-up checkout with the active AI Studio return path", async () => {
    const assignMock = vi.fn();
    const restoreLocation = withMockedLocationAssign(assignMock);
    const onClose = vi.fn();
    const onCheckoutStarted = vi.fn();
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (url === "/api/billing/credit-packages") {
        return jsonResponse({
          packages: [
            {
              id: "starter-pack",
              display_name: "Starter Pack",
              credit_amount_cents: 500,
              price_cents: 700,
              sort_order: 1,
            },
            {
              id: "studio-pack",
              display_name: "Studio Pack",
              credit_amount_cents: 2000,
              price_cents: 2600,
              sort_order: 2,
            },
          ],
        });
      }
      if (url === "/api/billing/stripe/checkout") {
        return jsonResponse({ checkoutUrl: "https://checkout.stripe.test/session-1" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
      render(
        <AiStudioInsufficientCreditsModal
          isOpen
          requiredCredits={1200}
          availableCredits={100}
          onClose={onClose}
          onCheckoutStarted={onCheckoutStarted}
        />
      );

      expect(await screen.findByText("Insufficient Credits")).toBeInTheDocument();
      expect(screen.getByText(/This generation needs 1,200 credits/)).toBeInTheDocument();
      expect(screen.getByText(/You have 100 available/)).toBeInTheDocument();
      const starterPackageButton = screen.getByRole("button", {
        name: /select starter pack top-up package/i,
      });
      const studioPackageButton = screen.getByRole("button", {
        name: /select studio pack top-up package/i,
      });
      expect(studioPackageButton).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByText("Buy credits").length).toBeGreaterThan(1);

      fireEvent.click(starterPackageButton);
      expect(starterPackageButton).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(screen.getByRole("button", { name: /^buy credits$/i }));

      await waitFor(() => {
        expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.test/session-1");
      });
      const checkoutCall = fetchWithAuthMock.mock.calls.find(
        ([url]) => url === "/api/billing/stripe/checkout"
      );
      expect(checkoutCall).toBeTruthy();
      const [, init] = checkoutCall as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({
        packageId: "starter-pack",
        returnPath: "/ai-studio?projectId=project-1",
      });
      expect(onCheckoutStarted).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      restoreLocation();
    }
  });

  it("opens the account credits section from the manage credits action", async () => {
    const assignMock = vi.fn();
    const restoreLocation = withMockedLocationAssign(assignMock);
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        packages: [
          {
            id: "starter-pack",
            display_name: "Starter Pack",
            credit_amount_cents: 500,
            price_cents: 700,
            sort_order: 1,
          },
        ],
      })
    );

    try {
      render(
        <AiStudioInsufficientCreditsModal
          isOpen
          requiredCredits={600}
          availableCredits={100}
          onClose={vi.fn()}
        />
      );

      expect(await screen.findByText("Insufficient Credits")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /manage credits/i }));

      expect(assignMock).toHaveBeenCalledWith("/profile?section=credits");
      expect(fetchWithAuthMock).not.toHaveBeenCalledWith(
        "/api/billing/stripe/checkout",
        expect.anything()
      );
    } finally {
      restoreLocation();
    }
  });
});
