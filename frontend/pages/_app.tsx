/**
 * Next.js custom App entry point.
 * Wires global CSS modules and ensures every page receives shared props.
 */
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { AiStudioProjectEntryState } from "../features/ai-studio/components/AiStudioProjectEntryState";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { MediaComplianceGate } from "../features/compliance/components/MediaComplianceGate";
import { useMediaComplianceGate } from "../features/compliance/hooks/useMediaComplianceGate";
import { PROTECTED_ROUTES, useProtectedRoute } from "../lib/authGuard";
import { installGlobalAppErrorHandlers, reportAppError } from "../lib/appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "../lib/clientBreadcrumbs";
import { installMediaPerfDebugHandle } from "../lib/mediaPerfTelemetry";
import "../styles/globals.css";

const isAiStudioRoutePath = (pathname: string): boolean =>
  pathname.startsWith("/ai-studio") || pathname.startsWith("/creator-studio");

const isExperimentalAiStudioEntryRoute = (pathname: string): boolean =>
  pathname.startsWith("/ai-studio");

const toRouteLoadMessage = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "message" in value) {
    const candidate = (value as { message?: unknown }).message;
    return typeof candidate === "string" ? candidate.trim() : "";
  }
  return "";
};

const hasFailedScriptLoadText = (value: string): boolean => {
  const lower = value.toLowerCase();
  return (
    lower.includes("failed to load script") ||
    (lower.includes("failed to load") && /_next\/static\/chunks\/[^\\s"']+\.js/.test(value))
  );
};

const extractFailedChunk = (value: string): string | null => {
  const match = value.match(/_next\/static\/chunks\/[^\\s"']+\.js/);
  return match ? match[0] : null;
};

/**
 * Render the active page with its provided props.
 */
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isProtected = PROTECTED_ROUTES.some((route) => router.pathname.startsWith(route));
  const isAiStudioRoute = isAiStudioRoutePath(router.pathname);
  const shouldUseExperimentalAiStudioEntry = isExperimentalAiStudioEntryRoute(router.pathname);
  const authRedirectPath = useMemo(
    () => `/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`,
    [router.asPath]
  );
  const { loading, session, user } = useProtectedRoute(isProtected);
  const mediaCompliance = useMediaComplianceGate({
    enabled: isProtected && Boolean(session),
    userId: user?.id ?? null,
  });

  useEffect(() => {
    return installGlobalAppErrorHandlers();
  }, []);

  useEffect(() => {
    if (!isProtected) return;
    if (mediaCompliance.status !== "auth_recovery_required") return;
    void router.replace(authRedirectPath);
  }, [authRedirectPath, isProtected, mediaCompliance.status, router]);

  useEffect(() => {
    installMediaPerfDebugHandle();
  }, []);

  useEffect(() => {
    const onStart = (url: string) => {
      addBreadcrumb({
        type: "route",
        message: "route_change_start",
        data: {
          to: redactUrlForTelemetry(url),
          from: typeof window !== "undefined" ? window.location.pathname : null,
        },
      });
    };
    const onComplete = (url: string) => {
      addBreadcrumb({
        type: "route",
        message: "route_change_complete",
        data: {
          to: redactUrlForTelemetry(url),
        },
      });
    };
    const onError = (routeError: Error & { cancelled?: boolean }, url: string) => {
      if (routeError?.cancelled) return;

      const routeErrorMessage = toRouteLoadMessage(routeError);
      const telemetryRouteChangeTarget = redactUrlForTelemetry(url);
      const hasScriptLoadFailure = hasFailedScriptLoadText(routeErrorMessage);

      addBreadcrumb({
        type: "route",
        level: "warn",
        message: "route_change_error",
        data: {
          to: telemetryRouteChangeTarget,
        },
      });

      if (hasScriptLoadFailure && typeof window !== "undefined") {
        void reportAppError({
          source: "client.route_change_script_load_failure",
          scope: "app",
          severity: "high",
          message: routeErrorMessage
            ? `Route change failed: ${routeErrorMessage}`
            : "Route change failed",
          stack: routeError?.stack ?? null,
          route: window.location.pathname,
          endpoint: telemetryRouteChangeTarget,
          metadata: {
            route_change_target: telemetryRouteChangeTarget,
            route_change_script_chunk: extractFailedChunk(routeErrorMessage),
          },
        });
        return;
      }

      void reportAppError({
        source: "client.route_change",
        scope: "app",
        severity: "medium",
        message: routeError?.message
          ? `Route change failed: ${routeError.message}`
          : "Route change failed",
        stack: routeError?.stack ?? null,
        route: typeof window !== "undefined" ? window.location.pathname : null,
        endpoint: telemetryRouteChangeTarget,
        metadata: {
          route_change_target: telemetryRouteChangeTarget,
        },
      });
    };

    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onComplete);
    router.events.on("routeChangeError", onError);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onComplete);
      router.events.off("routeChangeError", onError);
    };
  }, [router.events]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      try {
        const rawTarget = event.target;
        if (!(rawTarget instanceof Element)) return;

        // Never breadcrumb editable controls; avoid any chance of interfering
        // with focus/input behavior and avoid logging form interactions.
        const isEditableTarget = Boolean(
          rawTarget.closest("input,textarea,select,[contenteditable='true']")
        );
        if (isEditableTarget) return;

        const el = rawTarget.closest("button,a,[role='button'],[data-testid]");
        if (!(el instanceof HTMLElement)) return;

        addBreadcrumb({
          type: "ui",
          message: "click",
          data: {
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute("role"),
            testid: el.getAttribute("data-testid"),
            id: el.id || null,
            aria_label: el.getAttribute("aria-label"),
          },
        });
      } catch {
        // Best-effort diagnostics only.
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (isProtected && (loading || !session)) {
    if (isAiStudioRoute) {
      return (
        <AiStudioProjectEntryState
          variant="loading"
          phase="resolving-project"
          enableExperimentalAnimation={shouldUseExperimentalAiStudioEntry}
          message="Checking your session before project restore continues."
          activeStepIndex={0}
          stepsAriaLabel="Project loading progress"
        />
      );
    }
    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="subdued">Checking your session…</p>
        </div>
      </main>
    );
  }

  if (isProtected && mediaCompliance.status === "loading") {
    if (isAiStudioRoute) {
      return (
        <AiStudioProjectEntryState
          variant="loading"
          phase="resolving-project"
          enableExperimentalAnimation={shouldUseExperimentalAiStudioEntry}
          message="Checking your media agreement before project restore continues."
          activeStepIndex={1}
          stepsAriaLabel="Project loading progress"
        />
      );
    }
    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="subdued">Checking your media agreement…</p>
        </div>
      </main>
    );
  }

  if (isProtected && mediaCompliance.status === "auth_recovery_required") {
    if (isAiStudioRoute) {
      return (
        <AiStudioProjectEntryState
          variant="loading"
          phase="resolving-project"
          enableExperimentalAnimation={shouldUseExperimentalAiStudioEntry}
          message="Refreshing your session before project restore continues."
          activeStepIndex={0}
          stepsAriaLabel="Project loading progress"
        />
      );
    }
    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="subdued">Refreshing your session…</p>
        </div>
      </main>
    );
  }

  if (isProtected && mediaCompliance.status === "service_unavailable") {
    return (
      <AppErrorBoundary>
        <MediaComplianceGate
          mode="unavailable"
          agreement={mediaCompliance.agreement}
          error={mediaCompliance.error}
          loading={mediaCompliance.loading}
          primaryActionLabel="Retry"
          showSecondaryAction={false}
          onAccept={mediaCompliance.acceptAgreement}
          onRetry={mediaCompliance.refreshStatus}
        />
      </AppErrorBoundary>
    );
  }

  if (isProtected && mediaCompliance.status === "needs_consent") {
    return (
      <AppErrorBoundary>
        <MediaComplianceGate
          agreement={mediaCompliance.agreement}
          error={mediaCompliance.error}
          loading={mediaCompliance.loading}
          onAccept={mediaCompliance.acceptAgreement}
          onRetry={mediaCompliance.refreshStatus}
        />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <Component {...pageProps} />
    </AppErrorBoundary>
  );
}
