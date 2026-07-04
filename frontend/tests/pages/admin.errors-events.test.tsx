/**
 * Admin page tests for the errors handoff queue.
 * Locks the operator-facing copy-to-Codex incident workflow.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminErrorsPage from "../../pages/admin/errors";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const copyToClipboardMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../features/admin/logic/copyToClipboard", () => ({
  copyToClipboard: (value: string) => copyToClipboardMock(value),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

describe("Admin errors handoff queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(true);

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
              route: "/api/fal/nano-banana-2-submit",
              endpoint: "/api/fal/nano-banana-2-submit",
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
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads the handoff queue without event-stream telemetry", async () => {
    render(<AdminErrorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Error queue")).toBeInTheDocument();
      expect(
        screen.getByText("Copy one error packet, then paste it into Codex.")
      ).toBeInTheDocument();
      expect(screen.getByText("Generation timeout")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy triage" })).toBeInTheDocument();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/errors?page=1&limit=50&status=open",
      expect.objectContaining({ method: "GET" })
    );

    const calls = fetchWithAuthMock.mock.calls.map(([value]) => String(value));
    expect(calls.some((value) => value.startsWith("/api/admin/error-events?"))).toBe(false);
  });

  it("copies an incident packet and marks the row in progress", async () => {
    render(<AdminErrorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Generation timeout")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy triage" }));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("In progress")).toBeInTheDocument();
    });

    expect(copyToClipboardMock.mock.calls[0]?.[0]).toContain("Generation timeout");

    const calls = fetchWithAuthMock.mock.calls.map(([value]) => String(value));
    expect(calls.some((value) => value === "/api/admin/errors-status")).toBe(false);
    expect(calls.some((value) => value.startsWith("/api/admin/error-events?"))).toBe(false);
  });
});
