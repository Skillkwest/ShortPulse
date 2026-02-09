/**
 * Next.js custom App entry point.
 * Wires global CSS modules and ensures every page receives shared props.
 */
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { PROTECTED_ROUTES, useProtectedRoute } from "../lib/authGuard";
import { installGlobalAppErrorHandlers } from "../lib/appErrorReporter";
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

  if (isProtected && (loading || !session)) {
    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="subdued">Checking your session…</p>
        </div>
      </main>
    );
  }

  return <Component {...pageProps} />;
}
