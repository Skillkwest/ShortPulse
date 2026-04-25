/**
 * Authentication page for ShortPulse.
 * Provides streamlined email/password sign-in, account creation, and recovery actions.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { Eye, EyeSlash, LockSimple, PaperPlaneTilt, SignIn } from "phosphor-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ensureSupabaseClient,
  isSupabaseAbortError,
  primeSupabaseSession,
  readSupabaseSession,
} from "../lib/supabaseClient";
import { trackSignupCompleted, trackSignupSubmitted } from "../lib/growthTelemetry";

type Mode = "signin" | "signup";

const DEFAULT_PLAN = "free";
const MIN_PASSWORD_LENGTH = 8;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/**
 * Parse and sanitize the post-auth redirect target from the router query.
 */
function resolveNextPath(nextQueryValue: string | string[] | undefined): string {
  const rawValue = Array.isArray(nextQueryValue) ? nextQueryValue[0] : nextQueryValue;
  if (!rawValue) return "/dashboard";
  const candidate = rawValue.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/dashboard";
  if (candidate.startsWith("/auth")) return "/dashboard";
  return candidate;
}

/**
 * Parse `next` from the current asPath string while router query is hydrating.
 */
function resolveNextPathFromAsPath(asPath: string): string {
  const queryString = asPath.includes("?") ? asPath.slice(asPath.indexOf("?") + 1) : "";
  if (!queryString) return "/dashboard";
  const fallbackNext = new URLSearchParams(queryString).get("next") ?? undefined;
  return resolveNextPath(fallbackNext);
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const nextPath = useMemo(() => {
    if (router.isReady) {
      return resolveNextPath(router.query.next);
    }
    return resolveNextPathFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.next]);

  useEffect(() => {
    void readSupabaseSession()
      .then((session) => {
        if (session) {
          router.replace(nextPath);
        }
      })
      .catch((error) => {
        if (isSupabaseAbortError(error)) return;
      });
  }, [router, nextPath]);

  const isSubmitDisabled = !email.trim() || !password || loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const normalizedEmail = email.trim();
    try {
      const supabase = ensureSupabaseClient();
      if (mode === "signup") {
        trackSignupSubmitted({
          auth_surface: "auth_page",
          signup_method: "email_password",
        });
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              plan: DEFAULT_PLAN,
            },
          },
        });
        if (signUpError) throw signUpError;
        trackSignupCompleted({
          auth_surface: "auth_page",
          signup_method: "email_password",
          email_confirmation_required: !data.session,
        });
        if (!data.session) {
          setInfo("Check your email to confirm your account, then sign in to continue.");
          setMode("signin");
          return;
        }
        primeSupabaseSession(data.session);
      } else {
        const { error: signInError, data } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
        primeSupabaseSession(data.session ?? null);
      }
      router.push(nextPath);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to authenticate"));
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    setError(null);
    setInfo(null);
    if (loading) return;
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    const normalizedEmail = email.trim();
    setResettingPassword(true);
    try {
      const supabase = ensureSupabaseClient();
      const redirectTo =
        typeof window === "undefined" ? undefined : `${window.location.origin}/auth`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setInfo("Password reset link sent. Check your inbox.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to send password reset link."));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`ShortPulse · ${mode === "signin" ? "Sign in" : "Sign up"}`}</title>
      </Head>
      <main className="auth-shell">
        <div className="auth-overlay" />
        <div className="auth-glow auth-glow-left" />
        <div className="auth-glow auth-glow-right" />
        <form className="auth-card" onSubmit={onSubmit}>
          <p className="auth-kicker">ShortPulse workspace access</p>
          <h1 className="auth-title">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="auth-subtitle">
            {mode === "signin"
              ? "Sign in to continue to your workspace."
              : "Every new account starts on the Free plan automatically."}
          </p>

          <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfo(null);
              }}
            >
              Sign up
            </button>
          </div>

          {mode === "signup" ? (
            <div className="auth-plan-note" aria-live="polite">
              <span className="auth-plan-pill">Free</span>
              <span>Plan is set to Free at signup. You can upgrade later in Billing.</span>
            </div>
          ) : null}

          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <div className="auth-input">
            <PaperPlaneTilt size={18} weight="bold" />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <div className="auth-input">
            <LockSimple size={18} weight="bold" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : 1}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeSlash size={18} weight="bold" />
              ) : (
                <Eye size={18} weight="bold" />
              )}
            </button>
          </div>

          {mode === "signin" ? (
            <button
              type="button"
              className="auth-forgot"
              onClick={onResetPassword}
              disabled={resettingPassword || loading}
            >
              {resettingPassword ? "Sending reset link..." : "Forgot password?"}
            </button>
          ) : null}

          {error ? <div className="auth-error">{error}</div> : null}
          {info ? <div className="auth-info">{info}</div> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitDisabled}>
            <SignIn size={18} weight="bold" />
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create free account"}
          </button>

          <div className="auth-divider" />
          <p className="auth-switch">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          <p className="auth-footnote">
            By continuing, you agree to use ShortPulse under your workspace account.
          </p>
        </form>
      </main>
    </>
  );
}
