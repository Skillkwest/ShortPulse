/**
 * Auth route tests for redirect sanitization and primary auth actions.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "../../pages/auth";

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  isReady: true,
  asPath: "/auth",
  pathname: "/auth",
}));
const getSessionMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: routerState.query,
    isReady: routerState.isReady,
    asPath: routerState.asPath,
    pathname: routerState.pathname,
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("signal is aborted"),
}));

describe("Auth route behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    routerState.query = {};
    routerState.isReady = true;
    routerState.asPath = "/auth";
    routerState.pathname = "/auth";
    window.history.replaceState({}, "", "/auth");

    readSupabaseSessionMock.mockResolvedValue(null);
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { session: null } });
    signInWithOAuthMock.mockResolvedValue({ error: null, data: {} });
    signUpMock.mockResolvedValue({ error: null, data: { session: null } });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input.toString();
      const parsed = new URL(rawUrl, "https://shortpulse.test");
      if (parsed.pathname === "/api/auth/signup-intent") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            expiresAt: "2026-06-21T18:00:00.000Z",
          }),
        } as Response;
      }
      const flow = parsed.searchParams.get("flow") ?? "signup";
      const next = parsed.searchParams.get("next") ?? "/dashboard";
      const provider = parsed.searchParams.get("provider");
      const providerQuery = provider ? `&provider=${encodeURIComponent(provider)}` : "";
      return {
        ok: true,
        json: async () => ({
          url: `https://www.shortpulse.ai/auth/callback?flow=${flow}&next=${encodeURIComponent(
            next
          )}${providerQuery}`,
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: getSessionMock,
        signInWithPassword: signInWithPasswordMock,
        signInWithOAuth: signInWithOAuthMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
      },
    });
  });

  it("redirects an existing session to the sanitized next path", async () => {
    routerState.query = { next: "/profile?section=billing" };
    readSupabaseSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    render(<AuthPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/profile?section=billing");
    });
  });

  it("ignores aborted session reads during auth bootstrap", async () => {
    readSupabaseSessionMock.mockRejectedValue(new Error("signal is aborted without reason"));

    render(<AuthPage />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders the auth stylesheet class contract used by auth.css", () => {
    const { container } = render(<AuthPage />);

    expect(container.querySelector("main.auth-shell")).toBeInTheDocument();
    expect(container.querySelector("form.auth-card")).toBeInTheDocument();
    expect(container.querySelector(".auth-showcase-gallery")).toBeInTheDocument();
    expect(container.querySelectorAll(".auth-showcase-gallery-media")).toHaveLength(6);
    expect(
      container.querySelector(
        '.auth-showcase-gallery-media[src="/dashboard/gallery/monster-wall-break-demo.mp4"]'
      )
    ).toBeInTheDocument();
    expect(container.querySelector(".auth-mode-toggle")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".auth-input")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass(
      "auth-submit",
      "primary-btn"
    );
  });

  it("falls back to /dashboard when sign-in receives an unsafe redirect target", async () => {
    routerState.query = { next: "//evil.example" };
    signInWithPasswordMock.mockResolvedValue({
      error: null,
      data: { session: { user: { id: "user-1" } } },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " user@example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({ user: { id: "user-1" } });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("starts Google sign-in through the canonical callback URL and preserves safe next", async () => {
    routerState.query = { next: "/profile?section=account" };

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fprofile%3Fsection%3Daccount&provider=google",
        },
      });
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("falls back to /dashboard when Google sign-in receives an unsafe redirect target", async () => {
    routerState.query = { next: "https://evil.example/account" };

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fdashboard&provider=google",
        },
      });
    });
  });

  it("shows a calm message after Google OAuth is cancelled", async () => {
    routerState.query = { oauth: "cancelled", next: "/dashboard" };
    routerState.asPath = "/auth?next=%2Fdashboard&oauth=cancelled";

    render(<AuthPage />);

    expect(await screen.findByText("Google sign-in was canceled.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("uses asPath fallback while router query is hydrating", async () => {
    routerState.isReady = false;
    routerState.asPath = "/auth?next=%2Fai-studio";
    signInWithPasswordMock.mockResolvedValue({
      error: null,
      data: { session: { user: { id: "user-1" } } },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "creator@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/ai-studio");
    });
  });

  it("opens account-first signup when public signup is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.asPath = "/sign-up?next=%2Fai-studio";
    routerState.pathname = "/sign-up";
    routerState.query = { next: "/ai-studio" };

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeDisabled();
  });

  it("keeps signup closed by default even with a selected paid pricing plan", async () => {
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
    };

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(
      screen.getByText("Account creation is not open yet. Sign in if you already have an account.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("opens in signup mode when public signup is explicitly enabled with a paid pricing plan", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
    };

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeDisabled();
    expect(
      screen.getByText("For Google signup, choose the Google account with this email.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();
  });

  it("submits account-first signup and preserves the AI Studio next path", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.asPath = "/sign-up?next=%2Fai-studio";
    routerState.pathname = "/sign-up";
    routerState.query = { next: "/ai-studio" };

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: " new@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          nextPath: "/ai-studio",
        }),
      })
    );
    expect(signUpMock).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "strongpass",
      options: {
        emailRedirectTo: "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fai-studio",
      },
    });
    expect(
      screen.getByText("Check your email to confirm your account, then sign in to continue.")
    ).toBeInTheDocument();
  });

  it("submits signup with a selected paid plan and preserves the pricing intent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
    };

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: " new@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          nextPath: "/pricing?intent=create-project&plan=starter",
        }),
      })
    );
    expect(signUpMock).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "strongpass",
      options: {
        emailRedirectTo:
          "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter",
      },
    });

    expect(
      screen.getByText("Check your email to confirm your account, then sign in to continue.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();
  });

  it("explains a Google signup provider failure on the signup surface", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
      oauth: "signup_failed",
    };
    routerState.asPath =
      "/auth?next=%2Fpricing%3Fintent%3Dcreate-project%26plan%3Dstarter&mode=signup&oauth=signup_failed";

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Google signup could not be completed. Use the same Google account email you entered, then try again."
      )
    ).toBeInTheDocument();
  });

  it("redirects signup sessions to the selected paid pricing plan", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=studio",
    };
    signUpMock.mockResolvedValue({
      error: null,
      data: { session: { user: { id: "user-new" } } },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/pricing?intent=create-project&plan=studio");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "buyer@example.com",
          nextPath: "/pricing?intent=create-project&plan=studio",
        }),
      })
    );
  });

  it("starts Google signup only after creating a paid signup intent for the entered email", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=open-projects&plan=media&interval=month",
    };

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: " buyer@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fpricing%3Fintent%3Dopen-projects%26plan%3Dmedia%26interval%3Dmonth&provider=google",
        },
      });
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "buyer@example.com",
          nextPath: "/pricing?intent=open-projects&plan=media&interval=month",
        }),
      })
    );
    expect(signUpMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("shows a clear cooldown message when Supabase throttles signup confirmation emails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
    };
    signUpMock.mockResolvedValue({
      error: new Error("email rate limit exceeded"),
      data: { session: null },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText(
        "Too many confirmation emails were requested. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another."
      )
    ).toBeInTheDocument();
  });

  it("primes shared session state after sign in succeeds", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: null,
      data: { session: { user: { id: "user-2" } } },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "prime@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith({ user: { id: "user-2" } });
    });
  });

  it("validates empty email before requesting a reset link and sends the reset with callback redirect", async () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(
      screen.getByText("Enter your email first, then request a reset link.")
    ).toBeInTheDocument();
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " reset@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(resetPasswordForEmailMock.mock.calls[0]?.[0]).toBe("reset@example.com");
    expect(resetPasswordForEmailMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirectTo: "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard",
      })
    );

    expect(screen.getByText("Password reset link sent. Check your inbox.")).toBeInTheDocument();
  });

  it("shows a clear cooldown message when Supabase throttles reset emails", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: new Error("email rate limit exceeded"),
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "reset@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(
      await screen.findByText(
        "Too many reset emails were requested. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another."
      )
    ).toBeInTheDocument();
  });
});
