/**
 * Authentication page for ShortPulse.
 * Provides streamlined email/password sign-in, account creation, and recovery actions.
 */
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Eye, EyeSlash, EnvelopeSimple, LockSimple, SignIn } from "phosphor-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  fetchCanonicalAuthCallbackUrl,
  resolveNextPath,
  resolveNextPathFromAsPath,
} from "../lib/authRedirects";
import {
  resolvePasswordResetErrorMessage,
  resolveSignupEmailErrorMessage,
} from "../lib/authErrorMessages";
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

const resolveMode = (value: string | string[] | undefined): Mode => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "signup" ? "signup" : "signin";
};

function resolveModeFromAsPath(asPath: string): Mode {
  const queryString = asPath.includes("?") ? asPath.slice(asPath.indexOf("?") + 1) : "";
  if (!queryString) return "signin";
  return resolveMode(new URLSearchParams(queryString).get("mode") ?? undefined);
}

export default function AuthPage() {
  const router = useRouter();
  const requestedMode = useMemo(() => {
    if (router.isReady) {
      return resolveMode(router.query.mode);
    }
    return resolveModeFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.mode]);
  const [mode, setMode] = useState<Mode>(requestedMode);
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
    setMode(requestedMode);
  }, [requestedMode]);

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
        const emailRedirectTo = await fetchCanonicalAuthCallbackUrl({
          flow: "signup",
          nextPath,
        });
        if (!emailRedirectTo) {
          throw new Error(
            "Unable to resolve the public confirmation link destination. Please try again in a moment."
          );
        }
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
            emailRedirectTo,
          },
        });
        if (signUpError) {
          throw new Error(
            resolveSignupEmailErrorMessage(signUpError, "Unable to create your account.")
          );
        }
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
        (await fetchCanonicalAuthCallbackUrl({
          flow: "recovery",
          nextPath,
        })) ?? null;
      if (!redirectTo) {
        throw new Error(
          "Unable to resolve the public password reset link destination. Please try again in a moment."
        );
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setInfo("Password reset link sent. Check your inbox.");
    } catch (err: unknown) {
      setError(resolvePasswordResetErrorMessage(err, "Unable to send password reset link."));
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
        <div className="auth-layout">
          <form className="auth-card" onSubmit={onSubmit}>
            <div className="auth-card-header">
              <Link href="/" className="auth-brand" aria-label="Go to ShortPulse dashboard home">
                <Image
                  src="/small good d.png"
                  alt="ShortPulse logo"
                  className="auth-brand-logo"
                  width={203}
                  height={64}
                  style={{ height: "auto" }}
                />
              </Link>
              <h1 className="auth-title">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="auth-subtitle">
                {mode === "signin"
                  ? "Use your email and password to continue."
                  : "Create an account to get started."}
              </p>
            </div>

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

            <div className="auth-field-stack">
              <label className="auth-label" htmlFor="email">
                Email
              </label>
              <div className="auth-input">
                <EnvelopeSimple size={18} weight="bold" />
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
            </div>

            <div className="auth-field-stack">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="password">
                  Password
                </label>
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
              </div>
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
            </div>

            {error ? <div className="auth-error">{error}</div> : null}
            {info ? <div className="auth-info">{info}</div> : null}

            <button className="auth-submit primary-btn" type="submit" disabled={isSubmitDisabled}>
              <SignIn size={18} weight="bold" />
              {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div className="auth-divider" />
            <p className="auth-switch">
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
            <p className="auth-footnote">
              By continuing, you agree to use ShortPulse under your workspace account.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
