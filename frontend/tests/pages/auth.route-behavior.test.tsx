/**
 * Auth route tests for redirect sanitization and primary auth actions.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const locationAssignMock = vi.hoisted(() => vi.fn());
const googleOAuthUrl = "https://project.supabase.co/auth/v1/authorize?provider=google";

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
    vi.useRealTimers();
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
    signInWithOAuthMock.mockResolvedValue({ error: null, data: { url: googleOAuthUrl } });
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
      if (parsed.pathname === "/api/auth/oauth-handoff-preflight") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
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
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: locationAssignMock,
      },
    });

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

  it("does not silently open AI Studio from signup mode when a prior session exists", async () => {
    routerState.pathname = "/auth";
    routerState.asPath = "/auth?mode=signup&next=%2Fai-studio";
    routerState.query = { mode: "signup", next: "/ai-studio" };
    readSupabaseSessionMock.mockImplementation(async () => ({
      access_token: "token",
      user: { id: "user-1" },
    }));

    render(<AuthPage />);

    await waitFor(() => {
      expect(readSupabaseSessionMock).toHaveBeenCalled();
    });
    await expect(readSupabaseSessionMock.mock.results[0]?.value).resolves.toEqual({
      access_token: "token",
      user: { id: "user-1" },
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(replaceMock).not.toHaveBeenCalledWith("/ai-studio");
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
    expect(container.querySelector("form.auth-card")).toHaveClass("auth-card-signin");
    expect(container.querySelector(".auth-showcase-gallery")).toBeInTheDocument();
    expect(container.querySelector(".auth-showcase-copy")).not.toBeInTheDocument();
    expect(screen.queryByText("Video Gallery")).not.toBeInTheDocument();
    expect(screen.queryByText("See what ShortPulse makes.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Use your email, password, or Google account to continue.")
    ).not.toBeInTheDocument();
    const showcaseMedia = Array.from(
      container.querySelectorAll<HTMLVideoElement>(".auth-showcase-gallery-media")
    );
    expect(showcaseMedia).toHaveLength(10);
    showcaseMedia.forEach((media) => {
      expect(media).not.toHaveAttribute("src");
      expect(media).toHaveAttribute("preload", "none");
    });
    expect(showcaseMedia[0]).toHaveAttribute(
      "poster",
      "/dashboard/gallery/monster-wall-break-demo-poster.webp"
    );
    expect(showcaseMedia[0]?.parentElement).toHaveClass("auth-showcase-gallery-tile-alpine");
    expect(showcaseMedia[1]?.parentElement).toHaveClass("auth-showcase-gallery-tile-seedance");
    expect(showcaseMedia[2]?.parentElement).toHaveClass("auth-showcase-gallery-tile-feature");
    expect(showcaseMedia[5]?.parentElement).toHaveClass("auth-showcase-gallery-tile-bottom-right");
    expect(showcaseMedia[6]?.parentElement).toHaveClass("auth-showcase-gallery-tile-portrait-9x16");
    expect(showcaseMedia[7]).toHaveAttribute(
      "poster",
      "/dashboard/gallery/luxury-purse-ugc-demo-poster.webp"
    );
    expect(showcaseMedia[8]).toHaveAttribute(
      "poster",
      "/dashboard/gallery/viking-longship-storm-demo-poster.webp"
    );
    expect(showcaseMedia.at(-1)).toHaveAttribute(
      "poster",
      "/dashboard/gallery/forest-bear-encounter-demo-poster.webp"
    );
    expect(showcaseMedia.at(-1)?.parentElement).toHaveClass("auth-showcase-gallery-tile-wide-band");
    expect(container.querySelector(".auth-mode-toggle")).toBeInTheDocument();
    expect(container.querySelectorAll(".auth-input")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass(
      "auth-submit",
      "primary-btn"
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
  });

  it("staggers auth showcase motion sources across visible gallery tiles", async () => {
    vi.useFakeTimers();

    const { container } = render(<AuthPage />);

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    const showcaseMedia = Array.from(
      container.querySelectorAll<HTMLVideoElement>(".auth-showcase-gallery-media")
    );
    const attachedMedia = showcaseMedia.filter((media) => media.hasAttribute("src"));

    expect(showcaseMedia).toHaveLength(10);
    expect(attachedMedia).toHaveLength(2);
    expect(showcaseMedia[0]).toHaveAttribute(
      "src",
      "/dashboard/gallery/monster-wall-break-demo.mp4"
    );
    expect(showcaseMedia[1]).toHaveAttribute("src", "/dashboard/gallery/anime-cat-dance-demo.mp4");
    expect(showcaseMedia[0]).toHaveAttribute("preload", "metadata");
    expect(showcaseMedia[1]).toHaveAttribute("preload", "metadata");
    showcaseMedia.slice(2).forEach((media) => {
      expect(media).not.toHaveAttribute("src");
      expect(media).toHaveAttribute("preload", "none");
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(showcaseMedia.filter((media) => media.hasAttribute("src"))).toHaveLength(8);
    expect(showcaseMedia[2]).toHaveAttribute("src", "/dashboard/gallery/panda-villa-tour-demo.mp4");
    expect(showcaseMedia[3]).not.toHaveAttribute("src");
    expect(showcaseMedia[4]).not.toHaveAttribute("src");
    expect(showcaseMedia[5]).toHaveAttribute("src", "/dashboard/gallery/alpine-ski-pov-demo.mp4");
    expect(showcaseMedia[6]).toHaveAttribute("src", "/dashboard/gallery/seedance-podcast-demo.mp4");
    expect(showcaseMedia[7]).toHaveAttribute("src", "/dashboard/gallery/luxury-purse-ugc-demo.mp4");
    expect(showcaseMedia[8]).toHaveAttribute(
      "src",
      "/dashboard/gallery/viking-longship-storm-demo.mp4"
    );
    expect(showcaseMedia[9]).toHaveAttribute(
      "src",
      "/dashboard/gallery/forest-bear-encounter-demo.mp4"
    );
    expect(showcaseMedia[3]).toHaveAttribute("preload", "none");
    expect(showcaseMedia[4]).toHaveAttribute("preload", "none");
    showcaseMedia
      .filter((media) => media.hasAttribute("src"))
      .forEach((media) => {
        expect(media).toHaveAttribute("autoplay");
        expect(media).toHaveAttribute("preload", "metadata");
      });
    showcaseMedia
      .filter((media) => !media.hasAttribute("src"))
      .forEach((media) => {
        expect(media).not.toHaveAttribute("autoplay");
        expect(media).toHaveAttribute("preload", "none");
      });
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
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/oauth-handoff-preflight",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: googleOAuthUrl }),
      })
    );
    expect(locationAssignMock).toHaveBeenCalledWith(googleOAuthUrl);
  });

  it("keeps Google sign-in on ShortPulse when the OAuth handoff is unavailable", async () => {
    routerState.query = { next: "/profile?section=account" };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input.toString();
      const parsed = new URL(rawUrl, "https://shortpulse.test");
      if (parsed.pathname === "/api/auth/oauth-handoff-preflight") {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            ok: false,
            error: "Google sign-in is temporarily unavailable. Please try again in a few minutes.",
          }),
        } as Response;
      }
      const flow = parsed.searchParams.get("flow") ?? "signin";
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

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    expect(
      await screen.findByText(
        "Google sign-in is temporarily unavailable. Please try again in a few minutes."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).not.toBeDisabled();
    expect(locationAssignMock).not.toHaveBeenCalled();
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
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
  });

  it("starts Google sign-in without using populated email and password fields as account hints", async () => {
    routerState.query = { next: "/ai-studio" };

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " existing@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "stored-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fai-studio&provider=google",
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("resets the Google sign-in loading state when the browser restores the auth page", async () => {
    routerState.asPath = "/log-in?next=%2Fai-studio";
    routerState.pathname = "/log-in";
    routerState.query = { next: "/ai-studio" };

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    expect(await screen.findByRole("button", { name: "Opening Google..." })).toBeDisabled();

    fireEvent(window, new Event("pageshow"));

    expect(screen.getByRole("button", { name: "Sign in with Google" })).not.toBeDisabled();
  });

  it("shows a calm message after Google OAuth is cancelled", async () => {
    routerState.query = { oauth: "cancelled", next: "/dashboard" };
    routerState.asPath = "/auth?next=%2Fdashboard&oauth=cancelled";

    render(<AuthPage />);

    expect(await screen.findByText("Google sign-in was canceled.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows a missing-account message after Google sign-in cannot find a ShortPulse account", async () => {
    routerState.query = { oauth: "account_not_found", next: "/dashboard" };
    routerState.asPath = "/log-in?next=%2Fdashboard&oauth=account_not_found";
    routerState.pathname = "/log-in";

    render(<AuthPage />);

    expect(
      await screen.findByText(
        "No ShortPulse account exists for that Google account. Sign in with an existing account, or create an account first."
      )
    ).toBeInTheDocument();
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

  it("opens account-first signup by default and starts Google OAuth without requiring email first", async () => {
    routerState.asPath = "/sign-up?next=%2Fai-studio";
    routerState.pathname = "/sign-up";
    routerState.query = { next: "/ai-studio" };

    const { container } = render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(container.querySelector("form.auth-card")).toHaveClass("auth-card-signup");
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    const googleSignupButton = screen.getByRole("button", { name: "Sign up with Google" });
    const accountEmailInput = screen.getByLabelText("Account email");
    expect(googleSignupButton).not.toBeDisabled();
    expect(
      googleSignupButton.compareDocumentPosition(accountEmailInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.click(googleSignupButton);
    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fai-studio&provider=google",
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          nextPath: "/ai-studio",
          provider: "google",
        }),
      })
    );
    expect(
      screen.queryByText("Create a free account with full studio access and zero starting credits.")
    ).not.toBeInTheDocument();
  });

  it("resets the Google signup loading state when the browser restores the auth page", async () => {
    routerState.asPath = "/sign-up?next=%2Fai-studio";
    routerState.pathname = "/sign-up";
    routerState.query = { next: "/ai-studio" };

    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    expect(await screen.findByRole("button", { name: "Opening Google..." })).toBeDisabled();

    fireEvent(window, new Event("pageshow"));

    expect(screen.getByRole("button", { name: "Sign up with Google" })).not.toBeDisabled();
  });

  it("keeps signup closed when explicitly disabled even with a selected paid pricing plan", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "false");
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

  it("opens in signup mode by default with a paid pricing plan", async () => {
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=create-project&plan=starter",
    };

    const { container } = render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(container.querySelector("form.auth-card")).toHaveClass("auth-card-signup");
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Account email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strongpass" } });
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: "new@example.com" },
    });
    expect(screen.getByRole("button", { name: "Create account" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign up with Google" })).not.toBeDisabled();
    expect(
      screen.queryByText("Create your account, then continue to your selected plan.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("For Google signup, choose the Google account with this email.")
    ).not.toBeInTheDocument();
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
        "Google signup could not be completed. Try again from this signup page, then choose the Google account you want to use."
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

  it("starts Google signup without using populated email and password fields as account hints", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = {
      mode: "signup",
      next: "/pricing?intent=open-projects&plan=media&interval=month",
    };

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Account email"), {
      target: { value: " buyer@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "stored-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fpricing%3Fintent%3Dopen-projects%26plan%3Dmedia%26interval%3Dmonth&provider=google",
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          nextPath: "/pricing?intent=open-projects&plan=media&interval=month",
          provider: "google",
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

  it("shows a direct fallback when signup confirmation email delivery fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    routerState.query = { mode: "signup" };
    signUpMock.mockResolvedValue({
      error: new Error("Error sending confirmation mail"),
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
        "Confirmation email could not be sent right now. Try again in a few minutes."
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

  it("shows a clear message when Supabase rejects password sign-in credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: new Error("Invalid login credentials"),
      data: { session: null },
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "Email or password is incorrect. Check your login details or reset your password."
      )
    ).toBeInTheDocument();
    expect(primeSupabaseSessionMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
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
