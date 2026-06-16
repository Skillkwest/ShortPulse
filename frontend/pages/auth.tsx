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
import { AppMessage } from "../components/AppMessage";
import {
  fetchCanonicalAuthCallbackUrl,
  isPaidPricingSignupNextPath,
  isPublicSignupEnabled,
  resolveNextPath,
  resolveNextPathFromAsPath,
  resolveSignupNextPath,
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

const MIN_PASSWORD_LENGTH = 8;

const authClass = (...names: Array<string | false | null | undefined>) =>
  names.filter((name): name is string => Boolean(name)).join(" ");

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
  const signupNextPath = useMemo(() => resolveSignupNextPath(nextPath), [nextPath]);
  const signupAllowed = isPublicSignupEnabled() && signupNextPath !== null;
  const activeMode: Mode = mode === "signup" && signupAllowed ? "signup" : "signin";
  const postAuthPath = activeMode === "signup" && signupNextPath ? signupNextPath : nextPath;

  useEffect(() => {
    setMode(requestedMode === "signup" && !signupAllowed ? "signin" : requestedMode);
  }, [requestedMode, signupAllowed]);

  useEffect(() => {
    void readSupabaseSession()
      .then((session) => {
        if (session) {
          router.replace(postAuthPath);
        }
      })
      .catch((error) => {
        if (isSupabaseAbortError(error)) return;
      });
  }, [router, postAuthPath]);

  const isSubmitDisabled = !email.trim() || !password || loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const normalizedEmail = email.trim();
    try {
      const supabase = ensureSupabaseClient();
      if (activeMode === "signup") {
        if (!signupAllowed || !signupNextPath || !isPaidPricingSignupNextPath(signupNextPath)) {
          setError("Account creation is temporarily closed.");
          setMode("signin");
          return;
        }
        const emailRedirectTo = await fetchCanonicalAuthCallbackUrl({
          flow: "signup",
          nextPath: signupNextPath,
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
      router.push(postAuthPath);
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
        <title>{`ShortPulse · ${activeMode === "signin" ? "Sign in" : "Sign up"}`}</title>
      </Head>
      <main className={authClass("auth-shell")}>
        <div className={authClass("auth-overlay")} />
        <div className={authClass("auth-glow", "auth-glow-left")} />
        <div className={authClass("auth-glow", "auth-glow-right")} />
        <div className={authClass("auth-layout")}>
          <form className={authClass("auth-card")} onSubmit={onSubmit}>
            <div className={authClass("auth-card-header")}>
              <Link
                href="/"
                className={authClass("auth-brand")}
                aria-label="Go to ShortPulse dashboard home"
              >
                <Image
                  src="/small good d.png"
                  alt="ShortPulse logo"
                  className={authClass("auth-brand-logo")}
                  width={203}
                  height={64}
                  style={{ height: "auto" }}
                />
              </Link>
              <h1 className={authClass("auth-title")}>
                {activeMode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className={authClass("auth-subtitle")}>
                {activeMode === "signin"
                  ? "Use your email and password to continue."
                  : "Create an account to get started."}
              </p>
            </div>

            <div
              className={authClass("auth-mode-toggle")}
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeMode === "signin"}
                className={authClass(activeMode === "signin" && "active")}
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
                aria-selected={activeMode === "signup"}
                className={authClass(activeMode === "signup" && "active")}
                disabled={!signupAllowed}
                onClick={() => {
                  if (!signupAllowed) {
                    setError("Choose a paid plan from pricing before creating an account.");
                    return;
                  }
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
              >
                Sign up
              </button>
            </div>

            <div className={authClass("auth-field-stack")}>
              <label className={authClass("auth-label")} htmlFor="email">
                Email
              </label>
              <div className={authClass("auth-input")}>
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

            <div className={authClass("auth-field-stack")}>
              <div className={authClass("auth-label-row")}>
                <label className={authClass("auth-label")} htmlFor="password">
                  Password
                </label>
                {activeMode === "signin" ? (
                  <button
                    type="button"
                    className={authClass("auth-forgot")}
                    onClick={onResetPassword}
                    disabled={resettingPassword || loading}
                  >
                    {resettingPassword ? "Sending reset link..." : "Forgot password?"}
                  </button>
                ) : null}
              </div>
              <div className={authClass("auth-input")}>
                <LockSimple size={18} weight="bold" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={activeMode === "signup" ? MIN_PASSWORD_LENGTH : 1}
                  autoComplete={activeMode === "signin" ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  className={authClass("auth-eye")}
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

            {error ? (
              <AppMessage
                className={authClass("auth-error")}
                tone="error"
                mode="banner"
                message={error}
              />
            ) : null}
            {info ? (
              <AppMessage
                className={authClass("auth-info")}
                tone="info"
                mode="banner"
                message={info}
              />
            ) : null}

            <button
              className={authClass("auth-submit", "primary-btn")}
              type="submit"
              disabled={isSubmitDisabled}
            >
              <SignIn size={18} weight="bold" />
              {loading ? "Please wait..." : activeMode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div className={authClass("auth-divider")} />
            <p className={authClass("auth-switch")}>
              {activeMode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  if (activeMode === "signin" && !signupAllowed) {
                    setError("Choose a paid plan from pricing before creating an account.");
                    return;
                  }
                  setMode(activeMode === "signin" ? "signup" : "signin");
                  setError(null);
                  setInfo(null);
                }}
                disabled={activeMode === "signin" && !signupAllowed}
              >
                {activeMode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
            <p className={authClass("auth-footnote")}>
              By continuing, you agree to use ShortPulse under your workspace account.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
