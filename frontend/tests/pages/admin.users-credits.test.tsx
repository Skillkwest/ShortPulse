/**
 * Admin page tests for users and credits workflows.
 * Locks search, ledger loading, and manual adjustment feedback before B4-01 users/credits extraction.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../../pages/admin";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

describe("Admin users and credits overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    fetchWithAuthMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      const path = String(url);
      if (path.startsWith("/api/admin/users")) {
        return jsonResponse({
          users: [
            {
              id: "user-1",
              email: "alpha@example.com",
              planId: "studio",
              spendableCredits: 120,
              availableCredits: 150,
              reservedCredits: 30,
              subscriptionStatus: "active",
              createdAt: "2026-03-01T00:00:00.000Z",
            },
            {
              id: "user-2",
              email: "beta@example.com",
              planId: "business",
              spendableCredits: 0,
              availableCredits: 0,
              reservedCredits: 0,
              subscriptionStatus: "inactive",
              createdAt: "2026-03-02T00:00:00.000Z",
            },
          ],
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 2,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          search: { limited: false },
        });
      }
      if (path.startsWith("/api/admin/credits/ledger?")) {
        const search = new URL(path, "http://localhost").searchParams;
        const userId = search.get("userId");
        return jsonResponse({
          transactions:
            userId === "user-2"
              ? [
                  {
                    id: "txn-2",
                    userId: "user-2",
                    changeCents: 500,
                    reason: "Manual adjustment",
                    source: "admin",
                    sourceRef: "ticket-2",
                    pricingBreakdown: null,
                    createdAt: "2026-03-17T00:00:00.000Z",
                  },
                ]
              : [
                  {
                    id: "txn-1",
                    userId: "user-1",
                    changeCents: -20,
                    reason: "Generation charge",
                    source: "generation",
                    sourceRef: "job-1",
                    pricingBreakdown: null,
                    createdAt: "2026-03-16T00:00:00.000Z",
                  },
                ],
        });
      }
      if (path.startsWith("/api/admin/errors?")) {
        return jsonResponse({
          errors: [],
          summary: {
            openCount: 0,
            highSeverityOpenCount: 0,
            last24hCount: 0,
            appOpenCount: 0,
            generationOpenCount: 0,
          },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path.startsWith("/api/admin/error-events?")) {
        return jsonResponse({
          events: [],
          summary: {
            last15mCount: 0,
            high15mCount: 0,
            generation15mCount: 0,
            providerRunningTimeout15mCount: 0,
            lastHourCount: 0,
            last24hCount: 0,
            app24hCount: 0,
            generation24hCount: 0,
            high24hCount: 0,
            characterModeReferenceRefreshEmptyLastHourCount: 0,
            characterModeReferenceRefreshEmptyLast24hCount: 0,
            characterModeBundleUnavailableFallbackLastHourCount: 0,
            characterModeBundleUnavailableFallbackLast24hCount: 0,
            total15mThreshold: 40,
            high15mThreshold: 8,
            generation15mThreshold: 20,
            providerRunningTimeout15mThreshold: 2,
            total15mBreached: false,
            high15mBreached: false,
            generation15mBreached: false,
            providerRunningTimeout15mBreached: false,
          },
          health: { eventsTableAvailable: true, degraded: false, reason: null },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path === "/api/admin/credits/adjust") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ ok: true });
      }
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads users, auto-selects the first user, and loads that user's ledger", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("alpha@example.com")).toBeInTheDocument();
      expect(screen.getAllByText("beta@example.com").length).toBeGreaterThan(0);
    });
    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/credits/ledger?userId=user-1&limit=20",
        expect.objectContaining({ method: "GET" })
      )
    );
    expect(screen.getByText("Generation charge")).toBeInTheDocument();
  });

  it("applies a manual credit adjustment and refreshes users plus ledger", async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("alpha@example.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("alpha@example.com"), {
      target: { value: "user-2" },
    });

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/credits/ledger?userId=user-2&limit=20",
        expect.objectContaining({ method: "GET" })
      )
    );

    fireEvent.change(screen.getByPlaceholderText("+500 or -100"), {
      target: { value: "+500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByText("Credit adjustment applied.")).toBeInTheDocument());

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/credits/adjust",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: "user-2",
          changeCents: 500,
        }),
      })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/credits/ledger?userId=user-2&limit=20",
      expect.objectContaining({ method: "GET" })
    );
  });
});
