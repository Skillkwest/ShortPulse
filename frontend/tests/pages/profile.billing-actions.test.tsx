/**
 * Profile billing-section tests for portal and credit-refresh action wiring.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: { section: "billing" } as Record<string, string>,
  isReady: true,
  pathname: "/profile",
}));

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

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: routerState.query,
    isReady: routerState.isReady,
    pathname: routerState.pathname,
    replace: vi.fn(),
  }),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: useProtectedRouteMock,
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: useCreditsMock,
}));

vi.mock("../../features/ai-studio/hooks/useMediaAutosavePreference", () => ({
  useMediaAutosavePreference: useMediaAutosavePreferenceMock,
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Profile billing actions", () => {
  beforeEach(() => {
    routerState.query = { section: "billing" };
    fetchWithAuthMock.mockReset();

    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => 1000),
    });
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("renders the billing section controls", () => {
    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Billing & credits" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh credits" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage card, invoices, and subscription" })
    ).toBeInTheDocument();
  });

  it("shows an info notice when credit refresh returns the same balance", async () => {
    const refreshBalance = vi.fn(async () => 1000);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Credits synced. Balance is still 1,000."
    );
    expect(refreshBalance).toHaveBeenCalledTimes(1);
  });

  it("shows a success notice when credit refresh changes the balance", async () => {
    const refreshBalance = vi.fn(async () => 2500);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Credits updated from 1,000 to 2,500."
    );
  });

  it("shows an error notice when credit refresh fails", async () => {
    const refreshBalance = vi.fn(async () => null);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Unable to sync credits right now. Please try again."
    );
  });

  it("shows an error notice when opening the billing portal fails", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Portal unavailable" }),
    });

    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage card, invoices, and subscription" })
    );

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/billing/stripe/portal", {
        method: "POST",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Portal unavailable");
  });
});
