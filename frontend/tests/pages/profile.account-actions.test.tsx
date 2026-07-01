/**
 * Profile account-action tests for save, email, reset, and logout flows.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";
import {
  ensureSupabaseClient,
  refreshSupabaseSession,
  signOutSupabaseSession,
} from "../../lib/supabaseClient";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const refreshSessionMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

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
    asPath: "/profile?section=account",
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
const refreshSupabaseSessionModuleMock = vi.mocked(refreshSupabaseSession);
const signOutSupabaseSessionMock = vi.mocked(signOutSupabaseSession);

describe("Profile account actions", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/profile?section=account");
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
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input.toString();
      const parsed = new URL(rawUrl, "https://shortpulse.test");
      const flow = parsed.searchParams.get("flow") ?? "recovery";
      const next = parsed.searchParams.get("next") ?? "/profile?section=account";
      return {
        ok: true,
        json: async () => ({
          url: `https://www.shortpulse.ai/auth/callback?flow=${flow}&next=${encodeURIComponent(
            next
          )}`,
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    refreshSupabaseSessionModuleMock.mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    signOutSupabaseSessionMock.mockResolvedValue(undefined);
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

  afterEach(() => {
    vi.useRealTimers();
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
    expect(refreshSupabaseSessionModuleMock).toHaveBeenCalledTimes(1);
  });

  it("reflects the server-normalized display name after save", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ displayName: "Alice Normalized" }),
    });
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alice Normalized With Unsaved Suffix" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toHaveValue("Alice Normalized");
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Profile updated.");
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
    expect(refreshSupabaseSessionModuleMock).toHaveBeenCalled();
  });

  it("automatically clears the email update success notice", async () => {
    vi.useFakeTimers();
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update email" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Email update requested. Check your inbox to confirm."
    );

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a clear cooldown message when Supabase throttles email confirmation requests", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "email rate limit exceeded" }),
    });

    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many email confirmation requests were made. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another."
    );
  });

  it("requires an email before requesting an email change", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Update email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email.");
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("sends a password reset link to the workspace email", async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith("reset@example.com", {
        redirectTo:
          "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fprofile%3Fsection%3Daccount",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Password reset link sent.");
  });

  it("shows a clear cooldown message when Supabase throttles reset emails", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: new Error("email rate limit exceeded"),
    });

    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many reset emails were requested. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another."
    );
  });

  it("shows an inline validation error when no email is available for reset", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No email is available for reset.");
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("confirms logout before signing out and redirecting to auth", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = screen.getByRole("dialog", { name: "Log out?" });
    expect(within(dialog).getByRole("heading", { name: "Log out?" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(signOutSupabaseSessionMock).toHaveBeenCalledTimes(1);
      expect(routerReplaceMock).toHaveBeenCalledWith("/auth");
    });
  });
});
