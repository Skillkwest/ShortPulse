import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Eye, EyeSlash, LockSimple, SignIn } from "phosphor-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  hasPasswordRecoveryHint,
  readHashParams,
  resolveAuthCallbackError,
  resolveAuthCallbackFlow,
  resolveAuthCallbackFlowFromAsPath,
  resolveNextPath,
  resolveNextPathFromAsPath,
} from "../../lib/authRedirects";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import {
  ensureSupabaseClient,
  isSupabaseAbortError,
  primeSupabaseSession,
  readSupabaseSession,
  refreshSupabaseSession,
} from "../../lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;
const CALLBACK_SESSION_SETTLE_MS = 750;

type CallbackStatus = "loading" | "recovery" | "error";
type CompletionAuthEvent = "SIGNED_IN" | "USER_UPDATED";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCallbackErrorMessage = (flow: "signup" | "recovery" | "email-change"): string => {
  if (flow === "recovery") {
    return "This password reset link is invalid or has expired. Request a new one.";
  }
  if (flow === "email-change") {
    return "This email confirmation link is invalid or has expired. Sign in and request the change again.";
  }
  return "This confirmation link is invalid or has expired. Sign up again to request a new confirmation email.";
};

const hasAuthCallbackArtifacts = (asPath: string, hash: string): boolean => {
  const beforeHash = asPath.split("#", 1)[0] ?? asPath;
  const queryString = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  const queryParams = new URLSearchParams(queryString);
  const hashParams = readHashParams(hash);
  const callbackKeys = ["code", "type", "access_token", "refresh_token", "token_hash"];
  return callbackKeys.some((key) => queryParams.has(key) || hashParams.has(key));
};

const isCallbackCompletionEvent = (event: string): event is CompletionAuthEvent =>
  event === "SIGNED_IN" || event === "USER_UPDATED";

export default function AuthCallbackPage() {
  const router = useRouter();
  const replace = router.replace;
  const callbackFlow = useMemo(() => {
    if (router.isReady) {
      return (
        resolveAuthCallbackFlow(router.query.flow) ??
        resolveAuthCallbackFlowFromAsPath(router.asPath || "") ??
        "signup"
      );
    }
    return resolveAuthCallbackFlowFromAsPath(router.asPath || "") ?? "signup";
  }, [router.asPath, router.isReady, router.query.flow]);
  const nextPath = useMemo(() => {
    if (router.isReady) {
      return resolveNextPath(router.query.next);
    }
    return resolveNextPathFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.next]);
  const callbackError = useMemo(
    () =>
      resolveAuthCallbackError(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const recoveryFlowHint = useMemo(
    () =>
      hasPasswordRecoveryHint(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const callbackArtifactsPresent = useMemo(
    () =>
      hasAuthCallbackArtifacts(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const [status, setStatus] = useState<CallbackStatus>(
    callbackFlow === "recovery" && recoveryFlowHint ? "recovery" : "loading"
  );
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const [info, setInfo] = useState<string | null>(
    callbackFlow === "recovery" && recoveryFlowHint
      ? "Enter a new password to finish resetting your account."
      : null
  );
  const completionStartedRef = useRef(false);
  const completionEventSeenRef = useRef(false);
  const recoveryEventSeenRef = useRef(false);

  const signInHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("next", nextPath);
    return `/auth?${params.toString()}`;
  }, [nextPath]);

  useEffect(() => {
    if (!callbackError) return;
    setStatus("error");
    setError(callbackError);
    setInfo(null);
  }, [callbackError]);

  useEffect(() => {
    if (callbackError) return;
    if (callbackFlow !== "recovery" || !recoveryFlowHint) return;
    setStatus("recovery");
    setError(null);
    setInfo("Enter a new password to finish resetting your account.");
  }, [callbackError, callbackFlow, recoveryFlowHint]);

  useEffect(() => {
    let cancelled = false;

    const handleResolvedSession = async (session: Session | null) => {
      if (cancelled || !session) return;
      primeSupabaseSession(session);

      if (callbackFlow === "recovery") {
        setStatus("recovery");
        setError(null);
        setInfo("Enter a new password to finish resetting your account.");
        return;
      }
      if (completionStartedRef.current) return;
      completionStartedRef.current = true;

      setStatus("loading");
      setError(null);
      setInfo(
        callbackFlow === "email-change"
          ? "Email confirmed. Redirecting..."
          : "Account confirmed. Redirecting..."
      );

      try {
        if (callbackFlow === "email-change") {
          await refreshSupabaseSession({ preserveSnapshotOnError: true });
          const response = await fetchWithAuth("/api/account/email/confirm", {
            method: "POST",
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.error || "Unable to finish syncing your confirmed email.");
          }
        }
        if (!cancelled) {
          await replace(nextPath);
        }
      } catch (authError) {
        if (cancelled) return;
        completionStartedRef.current = false;
        setStatus("error");
        setInfo(null);
        setError(getErrorMessage(authError, "Unable to complete this authentication callback."));
      }
    };

    const supabase = ensureSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (callbackError) return;
      primeSupabaseSession(session ?? null);
      if (event === "PASSWORD_RECOVERY") {
        if (cancelled) return;
        recoveryEventSeenRef.current = true;
        setStatus("recovery");
        setError(null);
        setInfo("Enter a new password to finish resetting your account.");
        return;
      }
      if (event === "SIGNED_OUT" || !session) return;
      if (!isCallbackCompletionEvent(event)) return;
      completionEventSeenRef.current = true;
      setTimeout(() => {
        void handleResolvedSession(session);
      }, 0);
    });

    void readSupabaseSession()
      .then((session) => {
        if (cancelled || callbackError) return;
        if (session) {
          const canUseSessionForFlow =
            callbackFlow === "recovery"
              ? recoveryFlowHint || recoveryEventSeenRef.current
              : callbackArtifactsPresent || completionEventSeenRef.current;
          if (canUseSessionForFlow) {
            void handleResolvedSession(session);
            return;
          }
        }
        window.setTimeout(() => {
          if (cancelled || callbackError) return;
          if (callbackFlow === "recovery") {
            if (recoveryEventSeenRef.current) {
              setStatus("recovery");
              setError(null);
              setInfo("Enter a new password to finish resetting your account.");
              return;
            }
            setStatus("error");
            setInfo(null);
            setError(resolveCallbackErrorMessage(callbackFlow));
            return;
          }
          if (completionEventSeenRef.current) return;
          setStatus("error");
          setInfo(null);
          setError(resolveCallbackErrorMessage(callbackFlow));
        }, CALLBACK_SESSION_SETTLE_MS);
      })
      .catch((sessionError) => {
        if (cancelled || isSupabaseAbortError(sessionError)) return;
        setStatus("error");
        setInfo(null);
        setError(getErrorMessage(sessionError, "Unable to complete this authentication callback."));
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [callbackArtifactsPresent, callbackError, callbackFlow, nextPath, recoveryFlowHint, replace]);

  const onUpdatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    if (password !== passwordConfirmation) {
      setError("New password and confirmation must match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await refreshSupabaseSession({ preserveSnapshotOnError: true }).catch(() => null);
      setInfo("Password updated. Redirecting...");
      await replace(nextPath);
    } catch (updatePasswordError) {
      setError(getErrorMessage(updatePasswordError, "Unable to update your password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {`ShortPulse · ${
            status === "recovery"
              ? "Reset password"
              : callbackFlow === "email-change"
                ? "Confirm email change"
                : "Complete sign in"
          }`}
        </title>
      </Head>
      <main className="auth-shell">
        <div className="auth-overlay" />
        <div className="auth-glow auth-glow-left" />
        <div className="auth-glow auth-glow-right" />
        <div className="auth-layout">
          <form
            className="auth-card"
            onSubmit={status === "recovery" ? onUpdatePassword : undefined}
          >
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
                {status === "recovery"
                  ? "Reset your password"
                  : status === "error"
                    ? "Authentication link issue"
                    : callbackFlow === "email-change"
                      ? "Confirming your new email"
                      : "Completing your sign-in"}
              </h1>
              <p className="auth-subtitle">
                {status === "recovery"
                  ? "Choose a new password to finish the recovery flow."
                  : status === "error"
                    ? "The callback link could not be completed."
                    : "Finalizing your authenticated session."}
              </p>
            </div>

            {status === "recovery" ? (
              <>
                <div className="auth-field-stack">
                  <label className="auth-label" htmlFor="password">
                    New password
                  </label>
                  <div className="auth-input">
                    <LockSimple size={18} weight="bold" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPassword((value) => !value)}
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

                <div className="auth-field-stack">
                  <label className="auth-label" htmlFor="password-confirmation">
                    Confirm new password
                  </label>
                  <div className="auth-input">
                    <LockSimple size={18} weight="bold" />
                    <input
                      id="password-confirmation"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </>
            ) : null}

            {error ? <div className="auth-error">{error}</div> : null}
            {info ? <div className="auth-info">{info}</div> : null}

            {status === "recovery" ? (
              <button
                className="auth-submit primary-btn"
                type="submit"
                disabled={!password || !passwordConfirmation || loading}
              >
                <SignIn size={18} weight="bold" />
                {loading ? "Please wait..." : "Update password"}
              </button>
            ) : status === "error" ? (
              <Link className="auth-submit primary-btn" href={signInHref}>
                <SignIn size={18} weight="bold" />
                Return to sign in
              </Link>
            ) : null}
            <div className="auth-divider" />
            <p className="auth-footnote">
              ShortPulse uses this route to complete secure email and recovery links.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
