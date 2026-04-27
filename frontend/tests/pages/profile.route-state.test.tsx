/**
 * Profile route-state tests for section normalization and checkout notice cleanup.
 */
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
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
    replace: routerReplaceMock,
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

describe("Profile route state", () => {
  beforeEach(() => {
    routerState.query = {};
    routerState.isReady = true;
    routerReplaceMock.mockReset();
    routerReplaceMock.mockImplementation((nextUrl) => {
      if (nextUrl && typeof nextUrl === "object" && "query" in nextUrl) {
        const nextQuery = nextUrl.query;
        routerState.query =
          nextQuery && typeof nextQuery === "object"
            ? { ...(nextQuery as Record<string, string>) }
            : {};
      }
      return Promise.resolve(true);
    });

    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 0,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(async () => 0),
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

  it("maps the legacy profile section alias to account settings", () => {
    routerState.query = { section: "profile" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Billing & credits" })).not.toBeInTheDocument();
  });

  it("maps the legacy billing section alias to credits", () => {
    routerState.query = { section: "billing" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Credits & billing" })).toBeInTheDocument();
  });

  it("falls back to account settings for unknown sections", () => {
    routerState.query = { section: "unknown" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
  });

  it("renders the dedicated transactions section", () => {
    routerState.query = { section: "transactions" };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Transaction history" })).toBeInTheDocument();
  });

  it("shows a checkout success notice, refreshes credits, and clears the query flag", async () => {
    const refreshBalance = vi.fn(async () => 1250);
    useCreditsMock.mockReturnValue({
      balanceCents: 1000,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance,
    });
    routerState.query = { checkout: "success" };

    render(<ProfilePage />);

    expect(
      await screen.findByText("Credit purchase completed. Your balance is syncing now.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshBalance).toHaveBeenCalledWith({ silent: true });
      expect(routerReplaceMock).toHaveBeenCalledWith(
        { pathname: "/profile", query: {} },
        undefined,
        { shallow: true }
      );
    });
  });

  it("shows a checkout cancel notice and clears the query flag", async () => {
    routerState.query = { checkout: "cancel", section: "billing" };

    render(<ProfilePage />);

    expect(await screen.findByText("Checkout canceled. No charge was made.")).toBeInTheDocument();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        { pathname: "/profile", query: { section: "billing" } },
        undefined,
        { shallow: true }
      );
    });
  });
});
