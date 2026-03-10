/**
 * Admin page tests for dashboard announcement management interactions.
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

describe("Admin announcements tab", () => {
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
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      const path = String(url);
      if (path.startsWith("/api/admin/users")) {
        return jsonResponse({
          users: [],
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          search: { limited: false },
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
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({
          announcement: {
            id: "ann-1",
            title: "Studio maintenance",
            message: "We are deploying updates at 2AM UTC.",
            publishedAt: "2026-03-10T00:00:00.000Z",
            updatedAt: "2026-03-10T00:00:00.000Z",
          },
        });
      }
      if (path === "/api/admin/announcements/publish") {
        return jsonResponse({
          ok: true,
          announcement: {
            id: "ann-2",
            title: "New title",
            message: "New message",
            publishedAt: "2026-03-10T01:00:00.000Z",
            updatedAt: "2026-03-10T01:00:00.000Z",
          },
        });
      }
      if (path === "/api/admin/announcements/clear") {
        return jsonResponse({ ok: true });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads and pre-fills current announcement on tab open", async () => {
    render(<AdminDashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: "Announcements" }));

    await waitFor(() => expect(screen.getByDisplayValue("Studio maintenance")).toBeInTheDocument());
    expect(screen.getByDisplayValue("We are deploying updates at 2AM UTC.")).toBeInTheDocument();
  });

  it("publishes and clears announcement with deterministic feedback", async () => {
    render(<AdminDashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: "Announcements" }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/announcements/current",
        expect.objectContaining({ method: "GET" })
      )
    );

    fireEvent.change(screen.getByPlaceholderText("Platform notice"), {
      target: { value: "New title" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Tell users what changed and what to expect next."),
      {
        target: { value: "New message" },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByText("Announcement published.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clear active announcement" }));
    await waitFor(() =>
      expect(screen.getByText("Active announcement cleared.")).toBeInTheDocument()
    );
  });
});
