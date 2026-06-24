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
import { publicHomeGalleryVideoRows } from "../features/dashboard/logic/publicHomeGalleryMedia";
import {
  DEFAULT_SIGNUP_NEXT_PATH,
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
const AUTH_SHOWCASE_GALLERY_ITEMS = publicHomeGalleryVideoRows.slice(0, 2).flat();

type SignupIntentResponse = {
  ok?: unknown;
  error?: unknown;
};

const authClass = (...names: Array<string | false | null | undefined>) =>
  names.filter((name): name is string => Boolean(name)).join(" ");

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const createSignupIntent = async (options: { email: string; nextPath: string }) => {
  const response = await fetch("/api/auth/signup-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(options),
  });
  const payload = (await response.json().catch(() => null)) as SignupIntentResponse | null;
  if (!response.ok || payload?.ok !== true) {
    const errorMessage =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "Unable to prepare account creation right now.";
    throw new Error(errorMessage);
  }
};

const GoogleIcon = () => (
  <svg
    className={authClass("auth-oauth-icon")}
    aria-hidden="true"
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M23.04 12.26c0-.82-.07-1.6-.2-2.36H12v4.46h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.42-4.94 3.42-8.48Z"
    />
    <path
      fill="#34A853"
      d="M12 23.5c3.1 0 5.7-1.03 7.62-2.77l-3.72-2.9c-1.03.7-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v3c1.9 3.75 5.78 6.31 10.3 6.31Z"
    />
    <path
      fill="#FBBC05"
      d="M5.55 14.19a6.9 6.9 0 0 1 0-4.38v-3H1.7a11.48 11.48 0 0 0 0 10.38l3.85-3Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.07c1.68 0 3.18.58 4.37 1.71l3.32-3.32C17.68 1.59 15.08.5 12 .5 7.48.5 3.6 3.06 1.7 6.81l3.85 3C6.46 7.09 9 5.07 12 5.07Z"
    />
  </svg>
);

const resolveMode = (value: string | string[] | undefined): Mode => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "signup" ? "signup" : "signin";
};

function resolveModeFromAsPath(asPath: string): Mode {
  const queryString = asPath.includes("?") ? asPath.slice(asPath.indexOf("?") + 1) : "";
  if (!queryString) return "signin";
  return resolveMode(new URLSearchParams(queryString).get("mode") ?? undefined);
}

const resolveModeFromRoutePath = (pathname: string | undefined, asPath: string): Mode | null => {
  const candidate = pathname || asPath.split(/[?#]/, 1)[0] || "";
  if (candidate === "/sign-up") return "signup";
  if (candidate === "/log-in") return "signin";
  return null;
};

const resolveOauthStatus = (value: string | string[] | undefined): string | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
};

const resolveOauthMessage = (
  oauthStatus: string | null,
  requestedMode: Mode
): { tone: "info" | "error"; message: string } | null => {
  if (oauthStatus === "cancelled") {
    return {
      tone: "info",
      message:
        requestedMode === "signup" ? "Google signup was canceled." : "Google sign-in was canceled.",
    };
  }
  if (oauthStatus === "signup_failed") {
    return {
      tone: "error",
      message:
        "Google signup could not be completed. Use the same Google account email you entered, then try again.",
    };
  }
  if (oauthStatus === "signin_failed") {
    return {
      tone: "error",
      message: "Google sign-in could not be completed. Try signing in again.",
    };
  }
  return null;
};

function resolveOauthStatusFromAsPath(asPath: string): string | null {
  const beforeHash = asPath.split("#", 1)[0] ?? asPath;
  const queryString = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  if (!queryString) return null;
  return resolveOauthStatus(new URLSearchParams(queryString).get("oauth") ?? undefined);
}

export default function AuthPage() {
  const router = useRouter();
  const requestedMode = useMemo(() => {
    const routeMode = resolveModeFromRoutePath(router.pathname, router.asPath || "");
    if (routeMode) return routeMode;
    if (router.isReady) {
      return resolveMode(router.query.mode);
    }
    return resolveModeFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.pathname, router.query.mode]);
  const [mode, setMode] = useState<Mode>(requestedMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const oauthStatus = useMemo(() => {
    if (router.isReady) {
      return resolveOauthStatus(router.query.oauth);
    }
    return resolveOauthStatusFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.oauth]);
  const nextPath = useMemo(() => {
    if (router.isReady) {
      return resolveNextPath(router.query.next);
    }
    return resolveNextPathFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.next]);
  const signupNextPath = useMemo(
    () => resolveSignupNextPath(nextPath) ?? DEFAULT_SIGNUP_NEXT_PATH,
    [nextPath]
  );
  const signupAllowed = isPublicSignupEnabled() && signupNextPath !== null;
  const activeMode: Mode = mode === "signup" && signupAllowed ? "signup" : "signin";
  const isPricingSignup = activeMode === "signup" && isPaidPricingSignupNextPath(signupNextPath);
  const postAuthPath = activeMode === "signup" && signupNextPath ? signupNextPath : nextPath;

  useEffect(() => {
    setMode(requestedMode === "signup" && !signupAllowed ? "signin" : requestedMode);
  }, [requestedMode, signupAllowed]);

  useEffect(() => {
    if (requestedMode !== "signup" || signupAllowed || oauthStatus) return;
    setError(null);
    setInfo("Account creation is not open yet. Sign in if you already have an account.");
  }, [oauthStatus, requestedMode, signupAllowed]);

  useEffect(() => {
    const oauthMessage = resolveOauthMessage(oauthStatus, requestedMode);
    if (!oauthMessage) return;
    if (oauthMessage.tone === "error") {
      setInfo(null);
      setError(oauthMessage.message);
      return;
    }
    setError(null);
    setInfo(oauthMessage.message);
  }, [oauthStatus, requestedMode]);

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

  const isSubmitDisabled = !email.trim() || !password || loading || oauthLoading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const normalizedEmail = email.trim();
    try {
      const supabase = ensureSupabaseClient();
      if (activeMode === "signup") {
        if (!signupAllowed || !signupNextPath) {
          setError("Account creation is temporarily closed.");
          setMode("signin");
          return;
        }
        await createSignupIntent({
          email: normalizedEmail,
          nextPath: signupNextPath,
        });
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
    if (loading || oauthLoading) return;
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

  const onGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setOauthLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const normalizedEmail = email.trim();
      if (activeMode === "signup") {
        if (!signupAllowed || !signupNextPath) {
          setError("Account creation is temporarily closed.");
          setMode("signin");
          setOauthLoading(false);
          return;
        }
        if (!normalizedEmail) {
          setError("Enter the Google account email you want to use first.");
          setOauthLoading(false);
          return;
        }
        await createSignupIntent({
          email: normalizedEmail,
          nextPath: signupNextPath,
        });
        trackSignupSubmitted({
          auth_surface: "auth_page",
          signup_method: "google",
        });
      }
      const redirectTo = await fetchCanonicalAuthCallbackUrl({
        flow: activeMode === "signup" ? "signup" : "signin",
        nextPath: activeMode === "signup" && signupNextPath ? signupNextPath : nextPath,
        oauthProvider: "google",
      });
      if (!redirectTo) {
        throw new Error(
          "Unable to resolve the public Google sign-in destination. Please try again in a moment."
        );
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to start Google sign-in."));
      setOauthLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`ShortPulse · ${activeMode === "signin" ? "Sign in" : "Sign up"}`}</title>
      </Head>
      <main className={authClass("auth-shell", "auth-experience-shell")}>
        <div className={authClass("auth-overlay")} />
        <div className={authClass("auth-glow", "auth-glow-left")} />
        <div className={authClass("auth-glow", "auth-glow-right")} />
        <section className={authClass("auth-showcase")} aria-label="ShortPulse examples">
          <div className={authClass("auth-showcase-gallery")} aria-hidden="true">
            {AUTH_SHOWCASE_GALLERY_ITEMS.map((item, index) => (
              <div
                key={item.src}
                className={authClass(
                  "auth-showcase-gallery-tile",
                  index === 2 && "auth-showcase-gallery-tile-wide"
                )}
              >
                <video
                  className={authClass("auth-showcase-gallery-media")}
                  src={item.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            ))}
          </div>
        </section>
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
                  ? "Use your email, password, or Google account to continue."
                  : isPricingSignup
                    ? "Create your account, then continue to your selected plan."
                    : "Create a free account with full studio access and zero starting credits."}
              </p>
            </div>

            {signupAllowed ? (
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
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Sign up
                </button>
              </div>
            ) : null}

            {activeMode === "signin" ? (
              <>
                <button
                  className={authClass("auth-oauth-button")}
                  type="button"
                  onClick={() => {
                    void onGoogleSignIn();
                  }}
                  disabled={loading || oauthLoading}
                >
                  <GoogleIcon />
                  {oauthLoading ? "Opening Google..." : "Sign in with Google"}
                </button>
                <div className={authClass("auth-choice-divider")}>
                  <span>or sign in with email</span>
                </div>
              </>
            ) : null}

            <div className={authClass("auth-field-stack")}>
              <label className={authClass("auth-label")} htmlFor="email">
                {activeMode === "signup" ? "Account email" : "Email"}
              </label>
              {activeMode === "signup" ? (
                <p className={authClass("auth-field-hint")}>
                  For Google signup, choose the Google account with this email.
                </p>
              ) : null}
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

            {activeMode === "signup" ? (
              <>
                <button
                  className={authClass("auth-oauth-button")}
                  type="button"
                  onClick={() => {
                    void onGoogleSignIn();
                  }}
                  disabled={!email.trim() || loading || oauthLoading}
                >
                  <GoogleIcon />
                  {oauthLoading ? "Opening Google..." : "Sign up with Google"}
                </button>
                <div className={authClass("auth-choice-divider")}>
                  <span>or create a password for this email</span>
                </div>
              </>
            ) : null}

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
                    disabled={resettingPassword || loading || oauthLoading}
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

            {signupAllowed ? (
              <>
                <div className={authClass("auth-divider")} />
                <p className={authClass("auth-switch")}>
                  {activeMode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(activeMode === "signin" ? "signup" : "signin");
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    {activeMode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </>
            ) : null}
            <p className={authClass("auth-footnote")}>
              By continuing, you agree to the ShortPulse Terms and Privacy Policy.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
