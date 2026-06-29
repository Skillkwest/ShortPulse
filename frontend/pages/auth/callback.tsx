import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Eye, EyeSlash, LockSimple, SignIn } from "phosphor-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppMessage } from "../../components/AppMessage";
import {
  buildLoginPath,
  buildSignupPath,
  hasPasswordRecoveryHint,
  readHashParams,
  resolveAuthCallbackError,
  resolveAuthCallbackErrorCode,
  resolveAuthCallbackFlow,
  resolveAuthCallbackFlowFromAsPath,
  resolveAuthCallbackOAuthProvider,
  resolveAuthCallbackOAuthProviderFromAsPath,
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

const authClass = (...names: Array<string | false | null | undefined>) =>
  names.filter((name): name is string => Boolean(name)).join(" ");

type CallbackStatus = "loading" | "recovery" | "error";
type CompletionAuthEvent = "SIGNED_IN" | "USER_UPDATED";
type AccountSyncRetryKind = "email-change" | "signup";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCallbackErrorMessage = (
  flow: "signin" | "signup" | "recovery" | "email-change"
): string => {
  if (flow === "signin") {
    return "This sign-in link is invalid or has expired. Try signing in again.";
  }
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

const readCallbackCode = (asPath: string): string | null => {
  const beforeHash = asPath.split("#", 1)[0] ?? asPath;
  const queryString = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  const candidate = new URLSearchParams(queryString).get("code");
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
};

const readCallbackAccessToken = (asPath: string, hash: string): string | null => {
  const beforeHash = asPath.split("#", 1)[0] ?? asPath;
  const queryString = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  const queryParams = new URLSearchParams(queryString);
  const hashParams = readHashParams(hash);
  const candidate = queryParams.get("access_token") ?? hashParams.get("access_token") ?? null;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
};

const isCallbackCompletionEvent = (event: string): event is CompletionAuthEvent =>
  event === "SIGNED_IN" || event === "USER_UPDATED";

const buildAuthReturnPath = (options: {
  nextPath: string;
  callbackFlow: "signin" | "signup" | "recovery" | "email-change";
  oauthStatus?: "cancelled" | "signup_failed" | "signin_failed";
}): string => {
  if (options.callbackFlow === "signup") {
    const signupPath = buildSignupPath({ nextPath: options.nextPath });
    if (!options.oauthStatus) return signupPath;
    return `${signupPath}&oauth=${encodeURIComponent(options.oauthStatus)}`;
  }
  const loginPath = buildLoginPath({ nextPath: options.nextPath });
  if (!options.oauthStatus) return loginPath;
  return `${loginPath}&oauth=${encodeURIComponent(options.oauthStatus)}`;
};

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
  const oauthProvider = useMemo(() => {
    if (router.isReady) {
      return (
        resolveAuthCallbackOAuthProvider(router.query.provider) ??
        resolveAuthCallbackOAuthProviderFromAsPath(router.asPath || "")
      );
    }
    return resolveAuthCallbackOAuthProviderFromAsPath(router.asPath || "");
  }, [router.asPath, router.isReady, router.query.provider]);
  const callbackErrorCode = useMemo(
    () =>
      resolveAuthCallbackErrorCode(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const callbackError = useMemo(
    () =>
      resolveAuthCallbackError(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const isGoogleOAuthCallback = oauthProvider === "google";
  const isGoogleOAuthAccessDenied = isGoogleOAuthCallback && callbackErrorCode === "access_denied";
  const shouldReturnToAuthForGoogleOAuthError =
    isGoogleOAuthCallback &&
    callbackError !== null &&
    !isGoogleOAuthAccessDenied &&
    (callbackFlow === "signin" || callbackFlow === "signup");
  const googleOAuthErrorHref = useMemo(
    () =>
      shouldReturnToAuthForGoogleOAuthError
        ? buildAuthReturnPath({
            nextPath,
            callbackFlow,
            oauthStatus: callbackFlow === "signup" ? "signup_failed" : "signin_failed",
          })
        : null,
    [callbackFlow, nextPath, shouldReturnToAuthForGoogleOAuthError]
  );
  const googleOAuthFailedHref = useMemo(
    () =>
      isGoogleOAuthCallback && (callbackFlow === "signin" || callbackFlow === "signup")
        ? buildAuthReturnPath({
            nextPath,
            callbackFlow,
            oauthStatus: callbackFlow === "signup" ? "signup_failed" : "signin_failed",
          })
        : null,
    [callbackFlow, isGoogleOAuthCallback, nextPath]
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
  const callbackAccessToken = useMemo(
    () =>
      readCallbackAccessToken(
        router.asPath || "",
        typeof window === "undefined" ? "" : window.location.hash
      ),
    [router.asPath]
  );
  const callbackCode = useMemo(() => readCallbackCode(router.asPath || ""), [router.asPath]);
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingAccountSync, setRetryingAccountSync] = useState(false);
  const [accountSyncRetryKind, setAccountSyncRetryKind] = useState<AccountSyncRetryKind | null>(
    null
  );
  const [error, setError] = useState<string | null>(
    callbackError && !isGoogleOAuthAccessDenied && !shouldReturnToAuthForGoogleOAuthError
      ? callbackError
      : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const completionStartedRef = useRef(false);
  const completionEventSeenRef = useRef(false);
  const recoveryEventSeenRef = useRef(false);

  const signInHref = useMemo(() => {
    return buildAuthReturnPath({ nextPath, callbackFlow });
  }, [callbackFlow, nextPath]);
  const authReturnLabel = callbackFlow === "signup" ? "Return to signup" : "Return to sign in";
  const oauthCancelledHref = useMemo(
    () => buildAuthReturnPath({ nextPath, callbackFlow, oauthStatus: "cancelled" }),
    [callbackFlow, nextPath]
  );

  useEffect(() => {
    if (!isGoogleOAuthAccessDenied) return;
    void replace(oauthCancelledHref);
  }, [isGoogleOAuthAccessDenied, oauthCancelledHref, replace]);

  useEffect(() => {
    if (!googleOAuthErrorHref) return;
    void replace(googleOAuthErrorHref);
  }, [googleOAuthErrorHref, replace]);

  useEffect(() => {
    if (!callbackError || isGoogleOAuthAccessDenied || shouldReturnToAuthForGoogleOAuthError)
      return;
    setStatus("error");
    setError(callbackError);
    setInfo(null);
    setAccountSyncRetryKind(null);
  }, [callbackError, isGoogleOAuthAccessDenied, shouldReturnToAuthForGoogleOAuthError]);

  useEffect(() => {
    let cancelled = false;

    const runConfirmedEmailSync = async () => {
      await refreshSupabaseSession({ preserveSnapshotOnError: true });
      const response = await fetchWithAuth("/api/account/email/confirm", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to finish syncing your confirmed email.");
      }
    };

    const runSignupBootstrap = async () => {
      await refreshSupabaseSession({ preserveSnapshotOnError: true });
      const response = await fetchWithAuth("/api/account/bootstrap", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to finish setting up your account.");
      }
    };

    const handleResolvedSession = async (session: Session | null) => {
      if (cancelled || !session) return;
      primeSupabaseSession(session);
      setAccountSyncRetryKind(null);

      const isRecoverySession = callbackFlow === "recovery" || recoveryEventSeenRef.current;
      if (isRecoverySession) {
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
          : callbackFlow === "signin"
            ? "Sign-in confirmed. Redirecting..."
            : "Account confirmed. Redirecting..."
      );

      try {
        if (callbackFlow === "email-change") {
          await runConfirmedEmailSync();
        }
        if (callbackFlow === "signup") {
          await runSignupBootstrap();
        }
        if (!cancelled) {
          await replace(nextPath);
        }
      } catch (authError) {
        if (cancelled) return;
        completionStartedRef.current = false;
        setStatus("error");
        setInfo(
          callbackFlow === "email-change"
            ? "Your email was confirmed, but ShortPulse still needs to finish syncing your account."
            : callbackFlow === "signup"
              ? "Your account was confirmed, but ShortPulse still needs to finish setting it up."
              : null
        );
        setAccountSyncRetryKind(
          callbackFlow === "email-change" || callbackFlow === "signup" ? callbackFlow : null
        );
        setError(getErrorMessage(authError, "Unable to complete this authentication callback."));
      }
    };

    const isTrustedInitialSession = (session: Session | null): boolean => {
      if (!session || !callbackAccessToken) {
        return false;
      }
      if (session.access_token !== callbackAccessToken) {
        return false;
      }
      if (callbackFlow === "recovery" || recoveryEventSeenRef.current) {
        return recoveryFlowHint;
      }
      return callbackArtifactsPresent;
    };

    const supabase = ensureSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (callbackError || isGoogleOAuthAccessDenied) return;
      primeSupabaseSession(session ?? null);
      if (event === "PASSWORD_RECOVERY") {
        if (cancelled) return;
        recoveryEventSeenRef.current = true;
        setStatus("loading");
        setError(null);
        setInfo("Finalizing your recovery link...");
        if (session) {
          setTimeout(() => {
            void handleResolvedSession(session);
          }, 0);
        }
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
        if (
          cancelled ||
          callbackError ||
          isGoogleOAuthAccessDenied ||
          shouldReturnToAuthForGoogleOAuthError
        )
          return;
        if (session && isTrustedInitialSession(session)) {
          void handleResolvedSession(session);
          return;
        }
        if (
          callbackCode &&
          isGoogleOAuthCallback &&
          (callbackFlow === "signin" || callbackFlow === "signup")
        ) {
          void supabase.auth
            .exchangeCodeForSession(callbackCode)
            .then(({ data, error }) => {
              if (cancelled || callbackError || isGoogleOAuthAccessDenied) return;
              if (error) throw error;
              const exchangedSession = data.session ?? null;
              if (!exchangedSession) {
                throw new Error("Google did not return an authenticated ShortPulse session.");
              }
              completionEventSeenRef.current = true;
              void handleResolvedSession(exchangedSession);
            })
            .catch(() => {
              if (cancelled || callbackError || isGoogleOAuthAccessDenied) return;
              void replace(googleOAuthFailedHref ?? googleOAuthErrorHref ?? oauthCancelledHref);
            });
          return;
        }
        window.setTimeout(() => {
          if (
            cancelled ||
            callbackError ||
            isGoogleOAuthAccessDenied ||
            shouldReturnToAuthForGoogleOAuthError
          )
            return;
          if (callbackFlow === "recovery") {
            if (recoveryEventSeenRef.current) {
              return;
            }
            setStatus("error");
            setInfo(null);
            setAccountSyncRetryKind(null);
            setError(resolveCallbackErrorMessage(callbackFlow));
            return;
          }
          if (completionEventSeenRef.current) return;
          if (
            isGoogleOAuthCallback &&
            !callbackArtifactsPresent &&
            (callbackFlow === "signin" || callbackFlow === "signup")
          ) {
            void replace(googleOAuthFailedHref ?? googleOAuthErrorHref ?? oauthCancelledHref);
            return;
          }
          setStatus("error");
          setInfo(null);
          setAccountSyncRetryKind(null);
          setError(resolveCallbackErrorMessage(callbackFlow));
        }, CALLBACK_SESSION_SETTLE_MS);
      })
      .catch((sessionError) => {
        if (
          cancelled ||
          callbackError ||
          isGoogleOAuthAccessDenied ||
          shouldReturnToAuthForGoogleOAuthError ||
          isSupabaseAbortError(sessionError)
        )
          return;
        setStatus("error");
        setInfo(null);
        setAccountSyncRetryKind(null);
        setError(getErrorMessage(sessionError, "Unable to complete this authentication callback."));
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [
    callbackAccessToken,
    callbackCode,
    callbackArtifactsPresent,
    callbackError,
    callbackFlow,
    googleOAuthErrorHref,
    googleOAuthFailedHref,
    isGoogleOAuthAccessDenied,
    isGoogleOAuthCallback,
    nextPath,
    oauthCancelledHref,
    recoveryFlowHint,
    replace,
    shouldReturnToAuthForGoogleOAuthError,
  ]);

  const onRetryAccountSync = async () => {
    const retryKind = accountSyncRetryKind;
    if (!retryKind) return;

    setRetryingAccountSync(true);
    setError(null);
    setInfo("Retrying account sync...");
    try {
      await refreshSupabaseSession({ preserveSnapshotOnError: true });
      const response = await fetchWithAuth(
        retryKind === "email-change" ? "/api/account/email/confirm" : "/api/account/bootstrap",
        {
          method: "POST",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.error ||
            (retryKind === "email-change"
              ? "Unable to finish syncing your confirmed email."
              : "Unable to finish setting up your account.")
        );
      }
      setAccountSyncRetryKind(null);
      setInfo(
        retryKind === "email-change"
          ? "Email confirmed. Redirecting..."
          : "Account ready. Redirecting..."
      );
      await replace(nextPath);
    } catch (retryError) {
      setAccountSyncRetryKind(retryKind);
      setInfo(
        retryKind === "email-change"
          ? "Your email was confirmed, but ShortPulse still needs to finish syncing your account."
          : "Your account was confirmed, but ShortPulse still needs to finish setting it up."
      );
      setError(getErrorMessage(retryError, "Unable to complete this authentication callback."));
    } finally {
      setRetryingAccountSync(false);
    }
  };

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
      <main className={authClass("auth-shell")}>
        <div className={authClass("auth-overlay")} />
        <div className={authClass("auth-glow", "auth-glow-left")} />
        <div className={authClass("auth-glow", "auth-glow-right")} />
        <div className={authClass("auth-layout")}>
          <form
            className={authClass("auth-card")}
            onSubmit={status === "recovery" ? onUpdatePassword : undefined}
          >
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
                {status === "recovery"
                  ? "Reset your password"
                  : status === "error"
                    ? "Authentication link issue"
                    : callbackFlow === "email-change"
                      ? "Confirming your new email"
                      : "Completing your sign-in"}
              </h1>
              <p className={authClass("auth-subtitle")}>
                {status === "recovery"
                  ? "Choose a new password to finish the recovery flow."
                  : status === "error"
                    ? "The callback link could not be completed."
                    : "Finalizing your authenticated session."}
              </p>
            </div>

            {status === "recovery" ? (
              <>
                <div className={authClass("auth-field-stack")}>
                  <label className={authClass("auth-label")} htmlFor="password">
                    New password
                  </label>
                  <div className={authClass("auth-input")}>
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
                      className={authClass("auth-eye")}
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

                <div className={authClass("auth-field-stack")}>
                  <label className={authClass("auth-label")} htmlFor="password-confirmation">
                    Confirm new password
                  </label>
                  <div className={authClass("auth-input")}>
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

            {status === "recovery" ? (
              <button
                className={authClass("auth-submit", "primary-btn")}
                type="submit"
                disabled={!password || !passwordConfirmation || loading}
              >
                <SignIn size={18} weight="bold" />
                {loading ? "Please wait..." : "Update password"}
              </button>
            ) : status === "error" && accountSyncRetryKind ? (
              <button
                className={authClass("auth-submit", "primary-btn")}
                type="button"
                onClick={() => {
                  void onRetryAccountSync();
                }}
                disabled={retryingAccountSync}
              >
                <SignIn size={18} weight="bold" />
                {retryingAccountSync ? "Retrying..." : "Retry account sync"}
              </button>
            ) : status === "error" ? (
              <Link className={authClass("auth-submit", "primary-btn")} href={signInHref}>
                <SignIn size={18} weight="bold" />
                {authReturnLabel}
              </Link>
            ) : null}
            {status === "error" && accountSyncRetryKind ? (
              <Link className={authClass("auth-switch")} href={signInHref}>
                Return to sign in
              </Link>
            ) : null}
            <div className={authClass("auth-divider")} />
            <p className={authClass("auth-footnote")}>
              ShortPulse uses this route to complete secure email and recovery links.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
