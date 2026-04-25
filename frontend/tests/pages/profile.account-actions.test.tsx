/**
 * Profile account-action tests for save, email, reset, and logout flows.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";
import { ensureSupabaseClient, primeSupabaseSession } from "../../lib/supabaseClient";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const refreshSessionMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } = await import("../support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);
const primeSupabaseSessionMock = vi.mocked(primeSupabaseSession);

describe("Profile account actions", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    refreshSessionMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    signOutMock.mockReset();
    fetchWithAuthMock.mockReset();

    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
          access_token: "token",
        },
      },
      error: null,
    });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue(undefined);
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        refreshSession: refreshSessionMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        signOut: signOutMock,
      },
    } as never);

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

  it("saves the display name through Supabase auth metadata", async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alice Example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/account/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Alice Example" }),
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Profile updated.");
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it("updates the email through Supabase auth", async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/account/email/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Email update requested. Check your inbox to confirm."
    );
  });

  it("sends a password reset link to the workspace email", async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith("reset@example.com", {
        redirectTo: "http://localhost:3000/auth",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Password reset link sent.");
  });

  it("shows an inline validation error when no email is available for reset", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("No email is available for reset.");
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("confirms logout before signing out and redirecting to auth", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByRole("heading", { name: "Are you sure?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes, log out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith(null);
      expect(routerReplaceMock).toHaveBeenCalledWith("/auth");
    });
  });
});
