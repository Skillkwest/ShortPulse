/**
 * Public dashboard/home surface.
 * Renders the logged-out dashboard experience shared by `/`, `/landing`, and anonymous `/dashboard`.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { ChartBar, CloudArrowUp, ShieldCheck, Sparkle, type IconProps } from "phosphor-react";
import { DashboardAppBar } from "../components/DashboardAppBar";
import { GuestDashboardView } from "../components/GuestDashboardView";
import { buildPricingPath } from "../../pricing/paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";
import type { DashboardOffer } from "../../../lib/server/api/dashboardOffers";
import type { PublicDashboardStaticProps } from "./publicDashboardData";

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
  if (offers.length) {
    return offers.slice(0, 4).map((offer) => ({
      key: offer.id,
      label: offer.eyebrow,
      value: offer.title,
      icon: getOfferIcon(offer),
      href: offer.ctaHref,
    }));
  }

  return [
    {
      key: "guest-offer-1",
      label: "Offer 1",
      value: "Offer 1",
      icon: Sparkle,
    },
    {
      key: "guest-offer-2",
      label: "Offer 2",
      value: "Offer 2",
      icon: CloudArrowUp,
    },
    {
      key: "guest-offer-3",
      label: "Offer 3",
      value: "Offer 3",
      icon: ShieldCheck,
    },
    {
      key: "guest-offer-4",
      label: "Offer 4",
      value: "Offer 4",
      icon: ChartBar,
    },
  ];
};

/**
 * Renders the shared public dashboard/home route surface.
 */
export function PublicDashboardRoute({
  dashboardOffers = [],
  manageBodyClass = true,
}: PublicDashboardRouteInternalProps) {
  const guestPageViewTrackedRef = useRef(false);

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

  const loginHref = `/auth?next=${encodeURIComponent("/dashboard")}`;
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
            <div className="user-cluster">
              <Link href={loginHref} className="avatar-card app-bar-login-button">
                Log in
              </Link>
            </div>
          }
        />

        <GuestDashboardView createProjectHref={guestCreateProjectHref} />
      </main>
    </>
  );
}
