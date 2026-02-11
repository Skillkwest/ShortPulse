/**
 * Next.js custom App entry point.
 * Wires global CSS modules and ensures every page receives shared props.
 */
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { PROTECTED_ROUTES, useProtectedRoute } from "../lib/authGuard";
import { installGlobalAppErrorHandlers } from "../lib/appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "../lib/clientBreadcrumbs";
import "../styles/globals.css";

/**
 * Render the active page with its provided props.
 */
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isProtected = PROTECTED_ROUTES.some((route) => router.pathname.startsWith(route));
  const { loading, session } = useProtectedRoute(isProtected);

  useEffect(() => {
    // Lock the CSS viewport variables to the initial window size.
    const root = document.documentElement;
    root.style.setProperty("--app-fixed-width", `${window.innerWidth}px`);
    root.style.setProperty("--app-fixed-height", `${window.innerHeight}px`);
  }, []);

  useEffect(() => {
    return installGlobalAppErrorHandlers();
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
    const onError = (_error: Error, url: string) => {
      addBreadcrumb({
        type: "route",
        level: "warn",
        message: "route_change_error",
        data: {
          to: redactUrlForTelemetry(url),
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
    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="subdued">Checking your session…</p>
        </div>
      </main>
    );
  }

  return (
    <AppErrorBoundary>
      <Component {...pageProps} />
    </AppErrorBoundary>
  );
}
