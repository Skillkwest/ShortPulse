/**
 * Next.js custom App entry point.
 * Wires global CSS modules and ensures every page receives shared props.
 */
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  AiStudioProjectEntryState,
  type AiStudioProjectEntryStep,
} from "../features/ai-studio/components/AiStudioProjectEntryState";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { MediaComplianceGate } from "../features/compliance/components/MediaComplianceGate";
import { useMediaComplianceGate } from "../features/compliance/hooks/useMediaComplianceGate";
import { PROTECTED_ROUTES, useProtectedRoute } from "../lib/authGuard";
import { installGlobalAppErrorHandlers, reportAppError } from "../lib/appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "../lib/clientBreadcrumbs";
import { installMediaPerfDebugHandle } from "../lib/mediaPerfTelemetry";
import "../styles/globals.css";

const AI_STUDIO_PREFLIGHT_STEPS: AiStudioProjectEntryStep[] = [
  {
    id: "session",
    label: "Verify session",
    hint: "Confirm your authenticated workspace access.",
  },
  {
    id: "compliance",
    label: "Check media agreement",
    hint: "Load your one-time media compliance acceptance.",
  },
  {
    id: "studio",
    label: "Open studio",
    hint: "Continue into the AI Studio workspace.",
  },
];

const isAiStudioRoutePath = (pathname: string): boolean =>
  pathname.startsWith("/ai-studio") || pathname.startsWith("/creator-studio");

/**
 * Render the active page with its provided props.
 */
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isProtected = PROTECTED_ROUTES.some((route) => router.pathname.startsWith(route));
  const isAiStudioRoute = isAiStudioRoutePath(router.pathname);
  const { loading, session, user } = useProtectedRoute(isProtected);
  const mediaCompliance = useMediaComplianceGate({
    enabled: isProtected && Boolean(session),
    userId: user?.id ?? null,
  });

  useEffect(() => {
    return installGlobalAppErrorHandlers();
  }, []);

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
      addBreadcrumb({
        type: "route",
        level: "warn",
        message: "route_change_error",
        data: {
          to: redactUrlForTelemetry(url),
        },
      });
      if (routeError?.cancelled) return;

      void reportAppError({
        source: "client.route_change",
        scope: "app",
        severity: "medium",
        message: routeError?.message
          ? `Route change failed: ${routeError.message}`
          : "Route change failed",
        stack: routeError?.stack ?? null,
        route: typeof window !== "undefined" ? window.location.pathname : null,
        endpoint: redactUrlForTelemetry(url),
        metadata: {
          route_change_target: redactUrlForTelemetry(url),
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
          pillLabel="AI Studio Access Check"
          metaLabel="Checking your session…"
          title="Opening AI Studio"
          message="Checking your session before AI Studio opens."
          steps={AI_STUDIO_PREFLIGHT_STEPS}
          activeStepIndex={0}
          stepsAriaLabel="AI Studio access progress"
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

  if (isProtected && !mediaCompliance.initialized) {
    if (isAiStudioRoute) {
      return (
        <AiStudioProjectEntryState
          variant="loading"
          phase="loading-workspace"
          pillLabel="AI Studio Access Check"
          metaLabel="Checking your media agreement…"
          title="Opening AI Studio"
          message="Checking your media agreement before the project workspace opens."
          steps={AI_STUDIO_PREFLIGHT_STEPS}
          activeStepIndex={1}
          stepsAriaLabel="AI Studio access progress"
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

  if (isProtected && !mediaCompliance.accepted) {
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
