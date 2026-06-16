/**
 * Public dashboard/home surface.
 * Renders the logged-out dashboard experience shared by `/` and anonymous `/dashboard`.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { DashboardAppBar } from "../components/DashboardAppBar";
import { GuestDashboardView } from "../components/GuestDashboardView";
import type { DashboardTutorial } from "../components/DashboardTutorialGrid";
import { buildDashboardAuthPath, buildPricingPath } from "../../pricing/paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";
import type { DashboardOffer } from "../../../lib/server/api/dashboardOffers";
import type { PublicDashboardStaticProps } from "./publicDashboardData";
import { readDashboardTutorialsFromPublicEndpoint } from "../logic/dashboardTutorialEndpointClient";
import { asDashboardTutorials } from "../logic/dashboardTutorialPayload";

type DashboardHeaderCard = {
  key: string;
  label: string;
  value: string;
  icon: ComponentType<DashboardHeaderIconProps>;
  className?: string;
  href?: string;
};

type DashboardHeaderIconProps = {
  size?: number;
  weight?: "bold";
};

type PublicDashboardRouteProps = Partial<PublicDashboardStaticProps>;
type PublicDashboardRouteInternalProps = PublicDashboardRouteProps & {
  manageBodyClass?: boolean;
};

type WindowWithIdleCallback = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const GROWTH_TELEMETRY_STARTUP_DELAY_MS = 3500;

const DashboardOfferPlanIcon = function DashboardOfferPlanIcon({
  size = 16,
}: DashboardHeaderIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 3.5 19 6v5.4c0 4.1-2.6 7.7-7 9.1-4.4-1.4-7-5-7-9.1V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m8.7 12.2 2.1 2.1 4.8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const DashboardOfferStorageIcon = function DashboardOfferStorageIcon({
  size = 16,
}: DashboardHeaderIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M7 17.5h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.1 8.1 4.8 4.8 0 0 0 7 17.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15V8.5m0 0-2.6 2.6M12 8.5l2.6 2.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const DashboardOfferChartIcon = function DashboardOfferChartIcon({
  size = 16,
}: DashboardHeaderIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M7 16v-5m5 5V6.5m5 9.5v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

const DashboardOfferSparkIcon = function DashboardOfferSparkIcon({
  size = 16,
}: DashboardHeaderIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m12 3 1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const getOfferIcon = (offer: DashboardOffer) => {
  if (offer.offerKind === "storage_addon") return DashboardOfferStorageIcon;
  if (offer.offerKind === "plan") return DashboardOfferPlanIcon;
  if (offer.offerKind === "model_pricing") return DashboardOfferChartIcon;
  return DashboardOfferSparkIcon;
};

const buildGuestHeaderCards = (offers: DashboardOffer[]): DashboardHeaderCard[] => {
  return offers.slice(0, 4).map((offer) => ({
    key: offer.id,
    label: offer.eyebrow,
    value: offer.title,
    icon: getOfferIcon(offer),
    href: offer.ctaHref,
  }));
};

/**
 * Renders the shared public dashboard/home route surface.
 */
export function PublicDashboardRoute({
  dashboardOffers = [],
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
  const signupHref = buildDashboardAuthPath({ mode: "signup" });
  const pricingHref = buildPricingPath();
  const guestCreateProjectHref = buildPricingPath({ intent: "create-project" });

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
          cards={buildGuestHeaderCards(dashboardOffers)}
          actionSlot={
            <div className="public-dashboard-actions" aria-label="Guest actions">
              <div className="public-dashboard-auth-column">
                <Link
                  href={pricingHref}
                  className="public-dashboard-action public-dashboard-pricing"
                  prefetch={false}
                >
                  Pricing
                </Link>
                <Link
                  href="#public-home-orbit-heading"
                  className="public-dashboard-action public-dashboard-community"
                  prefetch={false}
                >
                  Community
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
