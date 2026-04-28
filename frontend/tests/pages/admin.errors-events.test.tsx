/**
 * Admin page tests for errors and events workflows.
 * Locks telemetry loading and incident status mutation before the B4-01 errors/events extraction.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminErrorsPage from "../../pages/admin/errors";

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

describe("Admin errors and events overview", () => {
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
      if (path.startsWith("/api/admin/users?")) {
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
          ],
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          search: { limited: false },
        });
      }
      if (path.startsWith("/api/admin/credits/ledger?")) {
        return jsonResponse({ transactions: [] });
      }
      if (path.startsWith("/api/admin/errors?")) {
        return jsonResponse({
          errors: [
            {
              id: "err-1",
              fingerprint: "fp-1",
              source: "fal",
              scope: "generation",
              severity: "high",
              status: "open",
              message: "Generation timeout",
              stack: null,
              route: "/api/fal/image-submit",
              endpoint: "/api/fal/image-submit",
              request_id: "req-1",
              http_status: 504,
              user_id: "user-1",
              user_email: "alpha@example.com",
              metadata: { provider: "fal" },
              first_seen_at: "2026-03-17T00:00:00.000Z",
              last_seen_at: "2026-03-17T00:05:00.000Z",
              occurrences_count: 2,
            },
          ],
          summary: {
            openCount: 1,
            highSeverityOpenCount: 1,
            last24hCount: 1,
            appOpenCount: 0,
            generationOpenCount: 1,
          },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 1,
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
            last15mCount: 1,
            high15mCount: 1,
            generation15mCount: 1,
            providerRunningTimeout15mCount: 1,
            lastHourCount: 1,
            last24hCount: 1,
            app24hCount: 0,
            generation24hCount: 1,
            high24hCount: 1,
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
      if (path === "/api/admin/errors-status") {
        expect(options?.method).toBe("POST");
        return jsonResponse({ ok: true });
      }
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads incident summary and telemetry when the errors tab is opened", async () => {
    render(<AdminErrorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Open incidents")).toBeInTheDocument();
      expect(screen.getByText("Generation timeout")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/errors?page=1&limit=50&status=open",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/error-events?page=1&limit=50&synthetic=exclude&incident=actionable",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("resolves an incident and refreshes errors plus telemetry", async () => {
    render(<AdminErrorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Generation timeout")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/errors-status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ errorId: "err-1", status: "resolved" }),
        })
      )
    );

    await waitFor(() => {
      const calls = fetchWithAuthMock.mock.calls.map(([value]) => String(value));
      expect(
        calls.filter((value) => value.startsWith("/api/admin/errors?")).length
      ).toBeGreaterThan(1);
      expect(
        calls.filter((value) => value.startsWith("/api/admin/error-events?")).length
      ).toBeGreaterThan(1);
    });
  });
});
