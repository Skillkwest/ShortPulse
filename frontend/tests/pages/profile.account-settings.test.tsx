/**
 * Profile account settings page tests for autosave toggle wiring.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());

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
    query: { section: "account" },
    isReady: true,
    pathname: "/profile",
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

describe("Profile account settings autosave toggle", () => {
  beforeEach(() => {
    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 0,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(),
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

  it("renders autosave preference card in account settings", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("heading", { name: "Media Library autosave" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disable Media Library autosave" })
    ).toBeInTheDocument();
  });

  it("renders restored account presentation styles without relying on browser defaults", () => {
    render(<ProfilePage />);

    expect(screen.getByRole("main")).toHaveStyle({
      backgroundColor: "rgb(11, 15, 20)",
    });
    expect(screen.getByLabelText("Display name").getAttribute("style")).toContain(
      "background: rgba(8, 12, 17, 0.92)"
    );
    expect(screen.getByRole("link", { name: "Account" }).getAttribute("style")).toContain(
      "background: rgba(24, 64, 76, 0.94)"
    );
  });

  it("forwards toggle intent to media autosave setter", () => {
    const setMediaAutosaveEnabled = vi.fn();
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Disable Media Library autosave" }));
    expect(setMediaAutosaveEnabled).toHaveBeenCalledWith(false);
  });

  it("disables toggle while preference is loading or saving", () => {
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: true,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });

    const { rerender } = render(<ProfilePage />);
    expect(screen.getByRole("button", { name: "Disable Media Library autosave" })).toBeDisabled();

    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "saving",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    rerender(<ProfilePage />);

    expect(screen.getByRole("button", { name: "Disable Media Library autosave" })).toBeDisabled();
    expect(screen.getByText("Saving autosave preference...")).toBeInTheDocument();
  });

  it("shows inline autosave sync errors", () => {
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "error",
      error: "Unable to update media autosave preference",
      setMediaAutosaveEnabled: vi.fn(),
    });

    render(<ProfilePage />);
    expect(screen.getByText("Unable to update media autosave preference")).toBeInTheDocument();
  });
});
