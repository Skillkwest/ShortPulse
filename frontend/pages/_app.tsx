/**
 * Next.js custom App entry point.
 * Wires global CSS modules and ensures every page receives shared props.
 */
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { installGlobalAppErrorHandlers, reportAppError } from "../lib/appErrorReporter";
import { installBrowserSessionHealthMonitor } from "../lib/browserSessionHealth";
import {
  extractFailedNextChunk,
  hasNextChunkLoadFailureText,
  toChunkLoadErrorMessage,
} from "../lib/chunkLoadErrors";
import { addBreadcrumb, redactUrlForTelemetry } from "../lib/clientBreadcrumbs";
import { installMediaPerfDebugHandle } from "../lib/mediaPerfTelemetry";
import { isAiStudioRoutePath, isProtectedRoutePath } from "../lib/protectedRoutes";
import "../styles/globals.css";

const SharedProtectedRouteBootstrapGate = dynamic(
  () =>
    import("../features/compliance/routes/ProtectedRouteBootstrapGate").then(
      (module) => module.ProtectedRouteBootstrapGate
    ),
  {
    loading: () => (
      <>
        <Head>
          <title>ShortPulse · Loading</title>
        </Head>
        <main className="page page-wide">
          <div className="panel">
            <p className="subdued">Checking your session…</p>
          </div>
        </main>
      </>
    ),
  }
);

/**
 * Render the active page with its provided props.
 */
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isProtected = isProtectedRoutePath(router.pathname);
  const isAiStudioRoute = isAiStudioRoutePath(router.pathname);
  const usesSharedProtectedBootstrap = isProtected && !isAiStudioRoute;

  useEffect(() => {
    return installGlobalAppErrorHandlers();
  }, []);

  useEffect(() => {
    return installBrowserSessionHealthMonitor();
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
      if (routeError?.cancelled) return;

      const routeErrorMessage = toChunkLoadErrorMessage(routeError);
      const telemetryRouteChangeTarget = redactUrlForTelemetry(url);
      const hasScriptLoadFailure = hasNextChunkLoadFailureText(routeErrorMessage);

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
            route_change_script_chunk: extractFailedNextChunk(routeErrorMessage),
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

  if (usesSharedProtectedBootstrap) {
    return (
      <AppErrorBoundary>
        <SharedProtectedRouteBootstrapGate>
          <Component {...pageProps} />
        </SharedProtectedRouteBootstrapGate>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <Component {...pageProps} />
    </AppErrorBoundary>
  );
}
