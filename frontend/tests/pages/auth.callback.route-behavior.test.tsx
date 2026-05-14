import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "../../pages/auth/callback";

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const routerState = vi.hoisted(() => ({
  query: { flow: "signup", next: "/dashboard" } as Record<string, string>,
  isReady: true,
  asPath: "/auth/callback?flow=signup&next=%2Fdashboard",
}));
const updateUserMock = vi.hoisted(() => vi.fn());
const onAuthStateChangeMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: routerState.query,
    isReady: routerState.isReady,
    asPath: routerState.asPath,
    replace: replaceMock,
  }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("signal is aborted"),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Auth callback route behavior", () => {
  const setCallbackRoute = (asPath: string, query: Record<string, string>) => {
    routerState.query = query;
    routerState.asPath = asPath;
    window.history.replaceState({}, "", asPath);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routerState.isReady = true;
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fdashboard#type=signup&access_token=test-token",
      { flow: "signup", next: "/dashboard" }
    );

    readSupabaseSessionMock.mockResolvedValue(null);
    refreshSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    updateUserMock.mockResolvedValue({ error: null });
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ email: "user@example.com" }),
    });

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        onAuthStateChange: onAuthStateChangeMock,
        updateUser: updateUserMock,
      },
    });
  });

  it("redirects to the sanitized next path after a confirmed signup session is available", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fprofile%3Fsection%3Daccount#type=signup&access_token=test-token",
      { flow: "signup", next: "/profile?section=account" }
    );
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({ user: { id: "user-1" } });
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=account");
    });
  });

  it("renders the recovery form when Supabase emits PASSWORD_RECOVERY", async () => {
    let callback: ((event: string, session: unknown) => void) | null = null;
    onAuthStateChangeMock.mockImplementation(
      (handler: (event: string, session: unknown) => void) => {
        callback = handler;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }
    );

    render(<AuthCallbackPage />);

    act(() => {
      callback?.("PASSWORD_RECOVERY", { user: { id: "user-1" } });
    });

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("updates the password and redirects after a recovery callback", async () => {
    setCallbackRoute(
      "/auth/callback?flow=recovery&next=%2Fmedia-library#type=recovery&access_token=test-token",
      { flow: "recovery", next: "/media-library" }
    );
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: "newpass123" });
      expect(refreshSupabaseSessionMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/media-library");
    });
  });

  it("syncs Stripe only after the confirmed email-change callback session is available", async () => {
    setCallbackRoute(
      "/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount#type=email_change&access_token=test-token",
      { flow: "email-change", next: "/profile?section=account" }
    );
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(refreshSupabaseSessionMock).toHaveBeenCalledTimes(1);
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/account/email/confirm", {
        method: "POST",
      });
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=account");
    });
  });

  it("shows a callback error returned by Supabase", async () => {
    setCallbackRoute(
      "/auth/callback?flow=recovery&next=%2Fdashboard&error_description=Recovery%20link%20expired",
      { flow: "recovery", next: "/dashboard" }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    expect(await screen.findByText("Recovery link expired")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("fails closed for a recovery callback with no recovery session", async () => {
    setCallbackRoute("/auth/callback?flow=recovery&next=%2Fdashboard#type=recovery", {
      flow: "recovery",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText(
        "This password reset link is invalid or has expired. Request a new one."
      )
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not complete a signup callback from an existing initial session without callback artifacts", async () => {
    setCallbackRoute("/auth/callback?flow=signup&next=%2Fdashboard", {
      flow: "signup",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText(
        "This confirmation link is invalid or has expired. Sign up again to request a new confirmation email."
      )
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
