/**
 * Public dashboard/home surface.
 * Renders the logged-out dashboard experience shared by `/` and anonymous `/dashboard`.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { ChartBar, CloudArrowUp, ShieldCheck, Sparkle, type IconProps } from "phosphor-react";
import { DashboardAppBar } from "../components/DashboardAppBar";
import { GuestDashboardView } from "../components/GuestDashboardView";
import type { DashboardTutorial } from "../components/DashboardTutorialGrid";
import { buildDashboardAuthPath, buildPricingPath } from "../../pricing/paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";
import type { DashboardOffer } from "../../../lib/server/api/dashboardOffers";
import type { PublicDashboardStaticProps } from "./publicDashboardData";
import { asDashboardTutorials } from "../logic/dashboardTutorialPayload";

type DashboardHeaderCard = {
  key: string;
  label: string;
  value: string;
  icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  className?: string;
  href?: string;
};

type PublicDashboardRouteProps = Partial<PublicDashboardStaticProps>;
type PublicDashboardRouteInternalProps = PublicDashboardRouteProps & {
  manageBodyClass?: boolean;
};

const getOfferIcon = (offer: DashboardOffer) => {
  if (offer.offerKind === "storage_addon") return CloudArrowUp;
  if (offer.offerKind === "plan") return ShieldCheck;
  if (offer.offerKind === "model_pricing") return ChartBar;
  return Sparkle;
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
  manageBodyClass = true,
}: PublicDashboardRouteInternalProps) {
  const guestPageViewTrackedRef = useRef(false);
  const [liveDashboardTutorials, setLiveDashboardTutorials] = useState<DashboardTutorial[]>([]);

  useEffect(() => {
    if (guestPageViewTrackedRef.current) return;
    guestPageViewTrackedRef.current = true;
    void loadGrowthTelemetry().then(({ trackMarketingPageView }) => {
      trackMarketingPageView("dashboard", {
        page_surface: "dashboard",
      });
    });
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
    let active = true;

    const loadDashboardTutorials = async () => {
      try {
        const response = await fetch("/api/dashboard/tutorials", {
          method: "GET",
        });
        if (!response.ok) {
          throw new Error("Failed to load dashboard tutorials.");
        }
        const payload = (await response.json().catch(() => ({}))) as {
          tutorials?: unknown;
        };
        if (!active) return;
        setLiveDashboardTutorials(asDashboardTutorials(payload.tutorials));
      } catch {
        if (!active) return;
        setLiveDashboardTutorials([]);
      }
    };

    void loadDashboardTutorials();
    return () => {
      active = false;
    };
  }, []);

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

      <main id="main-content" className="page page-wide dashboard-refresh">
        <DashboardAppBar
          cards={buildGuestHeaderCards(dashboardOffers)}
          actionSlot={
            <div className="public-dashboard-actions" aria-label="Guest actions">
              <div className="public-dashboard-auth-column">
                <Link
                  href={loginHref}
                  className="public-dashboard-action public-dashboard-login"
                  prefetch={false}
                >
                  Login
                </Link>
                <Link
                  href={pricingHref}
                  className="public-dashboard-action public-dashboard-pricing"
                  prefetch={false}
                >
                  Pricing
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
