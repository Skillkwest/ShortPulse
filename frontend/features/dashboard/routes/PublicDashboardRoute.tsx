/**
 * Public dashboard/home surface.
 * Renders the logged-out dashboard experience shared by `/` and anonymous `/dashboard`.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DashboardAppBar } from "../components/DashboardAppBar";
import { GuestDashboardView } from "../components/GuestDashboardView";
import type { DashboardTutorial } from "../components/DashboardTutorialGrid";
import {
  buildDashboardAuthPath,
  buildDashboardSignupPath,
  buildPricingPath,
} from "../../pricing/paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";
import type { PublicDashboardStaticProps } from "./publicDashboardData";
import { readDashboardTutorialsFromPublicEndpoint } from "../logic/dashboardTutorialEndpointClient";
import { asDashboardTutorials } from "../logic/dashboardTutorialPayload";
import { SHORTPULSE_COMMUNITY_URL } from "../communityLinks";

type PublicDashboardRouteProps = Partial<PublicDashboardStaticProps>;
type PublicDashboardRouteInternalProps = PublicDashboardRouteProps & {
  manageBodyClass?: boolean;
};

type WindowWithIdleCallback = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const GROWTH_TELEMETRY_STARTUP_DELAY_MS = 3500;

/**
 * Renders the shared public dashboard/home route surface.
 */
export function PublicDashboardRoute({
  dashboardTutorials = [],
  manageBodyClass = true,
}: PublicDashboardRouteInternalProps) {
  const guestPageViewTrackedRef = useRef(false);
  const [liveDashboardTutorials, setLiveDashboardTutorials] = useState<DashboardTutorial[]>(() =>
    asDashboardTutorials(dashboardTutorials)
  );

  useEffect(() => {
    if (guestPageViewTrackedRef.current) return;
    guestPageViewTrackedRef.current = true;

    let cancelled = false;
    let idleHandle: number | null = null;
    const windowWithIdleCallback = window as WindowWithIdleCallback;

    const trackPageView = () => {
      if (cancelled) return;
      void loadGrowthTelemetry().then(({ trackMarketingPageView }) => {
        if (cancelled) return;
        trackMarketingPageView("dashboard", {
          page_surface: "dashboard",
        });
      });
    };

    const startupDelayHandle = globalThis.setTimeout(() => {
      if (windowWithIdleCallback.requestIdleCallback) {
        idleHandle = windowWithIdleCallback.requestIdleCallback(trackPageView, { timeout: 2500 });
        return;
      }

      trackPageView();
    }, GROWTH_TELEMETRY_STARTUP_DELAY_MS);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(startupDelayHandle);
      if (idleHandle !== null) {
        windowWithIdleCallback.cancelIdleCallback?.(idleHandle);
      }
    };
  }, []);

  useEffect(() => {
    if (!manageBodyClass) return;
    document.body.classList.add("dashboard-body");
    document.documentElement.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
      document.documentElement.classList.remove("dashboard-body");
    };
  }, [manageBodyClass]);

  useEffect(() => {
    if (liveDashboardTutorials.length > 0) return undefined;
    let active = true;

    const loadDashboardTutorials = async () => {
      try {
        const tutorials = await readDashboardTutorialsFromPublicEndpoint();
        if (!active) return;
        setLiveDashboardTutorials(tutorials);
      } catch {
        if (!active) return;
        setLiveDashboardTutorials([]);
      }
    };

    void loadDashboardTutorials();
    return () => {
      active = false;
    };
  }, [liveDashboardTutorials.length]);

  const loginHref = buildDashboardAuthPath();
  const signupHref = buildDashboardSignupPath();
  const pricingHref = buildPricingPath();
  const guestCreateProjectHref = buildDashboardSignupPath();

  return (
    <>
      <Head>
        <title>ShortPulse · Home</title>
        <meta
          name="description"
          content="ShortPulse public dashboard and workspace entry for pricing, account access, and AI Studio project flow."
        />
      </Head>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <main id="main-content" className="page page-wide dashboard-refresh public-dashboard-page">
        <DashboardAppBar
          cards={[]}
          actionSlot={
            <div className="public-dashboard-actions" aria-label="Guest actions">
              <div className="public-dashboard-auth-column">
                <Link
                  href={SHORTPULSE_COMMUNITY_URL}
                  className="public-dashboard-action public-dashboard-community"
                  prefetch={false}
                >
                  Community
                </Link>
                <Link
                  href={pricingHref}
                  className="public-dashboard-action public-dashboard-pricing"
                  prefetch={false}
                >
                  Pricing
                </Link>
                <Link
                  href={loginHref}
                  className="public-dashboard-action public-dashboard-login"
                  prefetch={false}
                >
                  Login
                </Link>
              </div>
              <Link
                href={signupHref}
                className="public-dashboard-action public-dashboard-signup"
                prefetch={false}
              >
                Sign up
              </Link>
            </div>
          }
        />

        <GuestDashboardView
          createProjectHref={guestCreateProjectHref}
          dashboardTutorials={liveDashboardTutorials}
        />
      </main>
    </>
  );
}
