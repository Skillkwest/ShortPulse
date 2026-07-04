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
const exchangeCodeForSessionMock = vi.hoisted(() => vi.fn());

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
        exchangeCodeForSession: exchangeCodeForSessionMock,
        updateUser: updateUserMock,
      },
    });
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("bootstraps account identity and redirects after a confirmed signup session is available", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fprofile%3Fsection%3Daccount#type=signup&access_token=test-token",
      { flow: "signup", next: "/profile?section=account" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "test-token",
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({
        user: { id: "user-1" },
        access_token: "test-token",
      });
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/account/bootstrap", {
        method: "POST",
      });
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=account");
    });
  });

  it("redirects after a Google sign-in callback without running email-change sync", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signin&next=%2Fprofile%3Fsection%3Daccount&provider=google#access_token=test-token&refresh_token=refresh-token",
      { flow: "signin", next: "/profile?section=account", provider: "google" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "test-token",
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({
        user: { id: "user-1" },
        access_token: "test-token",
      });
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=account");
    });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("renders a minimal loading status while the callback is settling", () => {
    setCallbackRoute("/auth/callback?flow=signin&next=%2Fdashboard", {
      flow: "signin",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue(null);

    const { container } = render(<AuthCallbackPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Completing sign-in...");
    expect(container.querySelector("main.auth-callback-minimal-shell")).toBeInTheDocument();
    expect(container.querySelector("form.auth-card")).not.toBeInTheDocument();
    expect(container.querySelector(".auth-brand-logo")).not.toBeInTheDocument();
  });

  it("renders invalid callback links as minimal text without the auth card", async () => {
    setCallbackRoute("/auth/callback?flow=recovery&next=%2Fdashboard#type=recovery", {
      flow: "recovery",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue(null);

    const { container } = render(<AuthCallbackPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This password reset link is invalid or has expired. Request a new one."
    );
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute(
      "href",
      "/log-in?next=%2Fdashboard"
    );
    expect(container.querySelector("main.auth-callback-minimal-shell")).toBeInTheDocument();
    expect(container.querySelector("form.auth-card")).not.toBeInTheDocument();
    expect(container.querySelector(".auth-brand-logo")).not.toBeInTheDocument();
  });

  it("renders the recovery form when Supabase emits PASSWORD_RECOVERY", async () => {
    setCallbackRoute(
      "/auth/callback?flow=recovery&next=%2Fdashboard#type=recovery&access_token=test-token",
      { flow: "recovery", next: "/dashboard" }
    );
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

    await waitFor(() => expect(callback).not.toBeNull());

    act(() => {
      callback?.("PASSWORD_RECOVERY", { user: { id: "user-1" } });
    });

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("updates the password and redirects after a recovery callback", async () => {
    setCallbackRoute(
      "/auth/callback?flow=recovery&next=%2Fai-studio#type=recovery&access_token=test-token",
      { flow: "recovery", next: "/ai-studio" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "test-token",
    });

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
      expect(replaceMock).toHaveBeenCalledWith("/ai-studio");
    });
  });

  it("syncs Stripe only after the confirmed email-change callback session is available", async () => {
    setCallbackRoute(
      "/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount#type=email_change&access_token=test-token",
      { flow: "email-change", next: "/profile?section=account" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "test-token",
    });

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

    expect(await screen.findByRole("alert")).toHaveTextContent("Recovery link expired");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("fails closed for a recovery callback with no recovery session", async () => {
    setCallbackRoute("/auth/callback?flow=recovery&next=%2Fdashboard#type=recovery", {
      flow: "recovery",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This password reset link is invalid or has expired. Request a new one."
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("fails closed when a recovery callback only has a stale existing session", async () => {
    setCallbackRoute(
      "/auth/callback?flow=recovery&next=%2Fdashboard#type=recovery&access_token=callback-token",
      { flow: "recovery", next: "/dashboard" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "stale-session-token",
    });

    render(<AuthCallbackPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This password reset link is invalid or has expired. Request a new one."
    );
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("routes an authenticated stale signup callback to the sanitized destination without completing signup", async () => {
    setCallbackRoute("/auth/callback?flow=signup&next=%2Fdashboard", {
      flow: "signup",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({ user: { id: "user-1" } });
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("routes an authenticated stale sign-in callback to the sanitized destination", async () => {
    setCallbackRoute("/auth/callback?flow=signin&next=%2Fai-studio", {
      flow: "signin",
      next: "/ai-studio",
    });
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({ user: { id: "user-1" } });
      expect(replaceMock).toHaveBeenCalledWith("/ai-studio");
    });
  });

  it("fails closed for a sign-in callback with no resolved session", async () => {
    setCallbackRoute("/auth/callback?flow=signin&next=%2Fdashboard", {
      flow: "signin",
      next: "/dashboard",
    });
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This sign-in link is invalid or has expired. Try signing in again."
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("returns to login when Google sign-in is cancelled by the provider", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signin&next=%2Fdashboard&provider=google&error=access_denied",
      { flow: "signin", next: "/dashboard", provider: "google", error: "access_denied" }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fdashboard&oauth=cancelled");
    });
    expect(
      screen.queryByText("This sign-in link is invalid or has expired. Try signing in again.")
    ).not.toBeInTheDocument();
  });

  it("returns to login with account-not-found copy when Google sign-in cannot find a ShortPulse account", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signin&next=%2Fdashboard&provider=google&error=access_denied&error_description=User%20from%20sub%20claim%20in%20JWT%20does%20not%20exist",
      { flow: "signin", next: "/dashboard", provider: "google", error: "access_denied" }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fdashboard&oauth=account_not_found");
    });
    expect(replaceMock).not.toHaveBeenCalledWith("/log-in?next=%2Fdashboard&oauth=cancelled");
  });

  it("returns to login with account-not-found copy when Google sign-in is rejected by the signup-intent hook", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signin&next=%2Fdashboard&provider=google&error=access_denied&error_description=Start%20from%20ShortPulse%20signup%20before%20creating%20an%20account.",
      { flow: "signin", next: "/dashboard", provider: "google", error: "access_denied" }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fdashboard&oauth=account_not_found");
    });
    expect(replaceMock).not.toHaveBeenCalledWith("/log-in?next=%2Fdashboard&oauth=cancelled");
  });

  it("returns to signup auth when Google signup is rejected by the provider or auth hook", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter&provider=google&error=server_error&error_description=Choose%20a%20paid%20ShortPulse%20plan",
      {
        flow: "signup",
        next: "/pricing?intent=create-project&plan=starter",
        provider: "google",
        error: "server_error",
      }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/sign-up?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter&oauth=signup_failed"
      );
    });
    expect(
      screen.queryByRole("heading", { name: "Authentication link issue" })
    ).not.toBeInTheDocument();
  });

  it("returns to signup auth when a Google signup callback has no artifacts or session", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter&provider=google",
      {
        flow: "signup",
        next: "/pricing?intent=create-project&plan=starter",
        provider: "google",
      }
    );
    readSupabaseSessionMock.mockResolvedValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/sign-up?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter&oauth=signup_failed"
      );
    });
    expect(
      screen.queryByText(
        "This confirmation link is invalid or has expired. Sign up again to request a new confirmation email."
      )
    ).not.toBeInTheDocument();
  });

  it("exchanges a Google signup callback code when the initial session is not hydrated yet", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fai-studio&provider=google&code=oauth-code",
      {
        flow: "signup",
        next: "/ai-studio",
        provider: "google",
        code: "oauth-code",
      }
    );
    readSupabaseSessionMock.mockResolvedValue(null);
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
          access_token: "exchanged-token",
        },
      },
      error: null,
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/account/bootstrap", {
        method: "POST",
      });
      expect(replaceMock).toHaveBeenCalledWith("/ai-studio");
    });
  });

  it("returns to signup failure instead of canceled when Google code exchange fails", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signup&next=%2Fai-studio&provider=google&code=oauth-code",
      {
        flow: "signup",
        next: "/ai-studio",
        provider: "google",
        code: "oauth-code",
      }
    );
    readSupabaseSessionMock.mockResolvedValue(null);
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error("OAuth exchange failed"),
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
      expect(replaceMock).toHaveBeenCalledWith("/sign-up?next=%2Fai-studio&oauth=signup_failed");
    });
  });

  it("returns to login with account-not-found copy when Google sign-in code exchange reports a missing user", async () => {
    setCallbackRoute(
      "/auth/callback?flow=signin&next=%2Fai-studio&provider=google&code=oauth-code",
      {
        flow: "signin",
        next: "/ai-studio",
        provider: "google",
        code: "oauth-code",
      }
    );
    readSupabaseSessionMock.mockResolvedValue(null);
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error("User from sub claim in JWT does not exist"),
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio&oauth=account_not_found");
    });
  });

  it("allows retrying email sync after Supabase confirms the email but downstream sync fails", async () => {
    setCallbackRoute(
      "/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount#type=email_change&access_token=callback-token",
      { flow: "email-change", next: "/profile?section=account" }
    );
    readSupabaseSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      access_token: "callback-token",
    });
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Temporary Stripe sync failure" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: "user@example.com" }),
      });

    render(<AuthCallbackPage />);

    expect(await screen.findByText("Temporary Stripe sync failure")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your email was confirmed, but ShortPulse still needs to finish syncing your account."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry account sync" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=account");
    });
  });
});
