/**
 * Auth route tests for redirect sanitization and primary auth actions.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));
const getSessionMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
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
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.query = {};
    routerState.isReady = true;
    routerState.asPath = "/auth";
    window.history.replaceState({}, "", "/auth");

    readSupabaseSessionMock.mockResolvedValue(null);
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { session: null } });
    signUpMock.mockResolvedValue({ error: null, data: { session: null } });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input.toString();
      const parsed = new URL(rawUrl, "https://shortpulse.test");
      const flow = parsed.searchParams.get("flow") ?? "signup";
      const next = parsed.searchParams.get("next") ?? "/dashboard";
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

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: getSessionMock,
        signInWithPassword: signInWithPasswordMock,
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
    expect(container.querySelector(".auth-mode-toggle")).toBeInTheDocument();
    expect(container.querySelectorAll(".auth-input")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveClass("active");
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

  it("opens directly in signup mode when requested by the route query", async () => {
    routerState.query = { mode: "signup" };

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("submits signup with the hidden baseline plan and returns to sign-in with a confirmation notice", async () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " new@example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled();
    });
    expect(signUpMock).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "strongpass",
      options: {
        data: {
          plan: "free",
        },
        emailRedirectTo: "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fdashboard",
      },
    });

    expect(
      screen.getByText("Check your email to confirm your account, then sign in to continue.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();
  });

  it("shows a clear cooldown message when Supabase throttles signup confirmation emails", async () => {
    signUpMock.mockResolvedValue({
      error: new Error("email rate limit exceeded"),
      data: { session: null },
    });

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
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
