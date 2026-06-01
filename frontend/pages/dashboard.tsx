/**
 * Session-aware dashboard route.
 * Serves as the public home/landing/dashboard shell while preserving authenticated workspace actions.
 */
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { ChartBar, CloudArrowUp, ShieldCheck, Sparkle, type IconProps } from "phosphor-react";
import type { BillingCatalogSnapshot } from "../features/billing/catalog";
import { DashboardAppBar } from "../features/dashboard/components/DashboardAppBar";
import { GuestDashboardView } from "../features/dashboard/components/GuestDashboardView";
import { ProjectEntryLoadingSurface } from "../features/projects/components/ProjectEntryLoadingSurface";
import { buildPricingPath } from "../features/pricing/paths";
import { trackMarketingPageView } from "../lib/growthTelemetry";
import { loadBillingCatalogSnapshot } from "../lib/server/api/billingCatalog";
import { readActiveDashboardOffers, type DashboardOffer } from "../lib/server/api/dashboardOffers";
import { getSupabaseAdmin } from "../lib/server/api/supabaseAdmin";
import { readPersistedSupabaseSessionHint, useSupabaseSessionState } from "../lib/supabaseClient";

const DASHBOARD_BOOTSTRAP_ROUTE = "/dashboard";
const DASHBOARD_BOOTSTRAP_TITLE = "Loading dashboard";
const DASHBOARD_BOOTSTRAP_MESSAGE = "Checking your session before your dashboard workspace loads.";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type DashboardPageStaticProps = InferGetStaticPropsType<typeof getStaticProps>;
type DashboardPageProps = {
  billingCatalog?: DashboardPageStaticProps["billingCatalog"];
  dashboardOffers?: DashboardPageStaticProps["dashboardOffers"];
};

type DashboardHeaderCard = {
  key: string;
  label: string;
  value: string;
  icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  className?: string;
  href?: string;
};

const emptyBillingCatalogSnapshot = (): BillingCatalogSnapshot => ({
  plans: [],
  packages: [],
  storageAddons: [],
});

const loadDashboardOffersSnapshot = async (): Promise<DashboardOffer[]> => {
  try {
    return await readActiveDashboardOffers(getSupabaseAdmin());
  } catch {
    return [];
  }
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

const loadAuthenticatedDashboardRoute = async () => {
  const loadedModule = await import("../features/dashboard/components/AuthenticatedDashboardRoute");
  return loadedModule.AuthenticatedDashboardRoute;
};

if (typeof window !== "undefined" && readPersistedSupabaseSessionHint()) {
  void loadAuthenticatedDashboardRoute();
}

const AuthenticatedDashboardRouteBoundary = dynamic(loadAuthenticatedDashboardRoute, {
  loading: () => (
    <ProjectEntryLoadingSurface
      title={DASHBOARD_BOOTSTRAP_TITLE}
      message={DASHBOARD_BOOTSTRAP_MESSAGE}
      steps={[]}
      activeStepIndex={0}
      stepsAriaLabel="Dashboard loading progress"
    />
  ),
});

/**
 * Loads the public billing catalog snapshot used by dashboard guest mode and the pricing route.
 */
export const getStaticProps: GetStaticProps<{
  billingCatalog: BillingCatalogSnapshot;
  dashboardOffers: DashboardOffer[];
}> = async () => {
  const [billingCatalogResult, dashboardOffersResult] = await Promise.allSettled([
    loadBillingCatalogSnapshot(),
    loadDashboardOffersSnapshot(),
  ]);

  return {
    props: {
      billingCatalog:
        billingCatalogResult.status === "fulfilled"
          ? billingCatalogResult.value
          : emptyBillingCatalogSnapshot(),
      dashboardOffers:
        dashboardOffersResult.status === "fulfilled" ? dashboardOffersResult.value : [],
    },
    revalidate: 60,
  };
};

/**
 * Renders the public/authenticated dashboard route.
 */
export default function DashboardPage({
  billingCatalog = emptyBillingCatalogSnapshot(),
  dashboardOffers = [],
}: DashboardPageProps) {
  const router = useRouter();
  const { initialized, user } = useSupabaseSessionState();
  const [shouldHoldForPersistedSession, setShouldHoldForPersistedSession] = useState(false);
  const isDashboardBootstrapPending =
    router.pathname === DASHBOARD_BOOTSTRAP_ROUTE && !initialized && shouldHoldForPersistedSession;
  const isAuthenticated = Boolean(user);
  const guestPageViewTrackedRef = useRef(false);

  useEffect(() => {
    if (!initialized || user || guestPageViewTrackedRef.current) return;
    guestPageViewTrackedRef.current = true;
    trackMarketingPageView("dashboard", {
      page_surface: "dashboard",
    });
  }, [initialized, user]);

  useIsomorphicLayoutEffect(() => {
    if (router.pathname !== DASHBOARD_BOOTSTRAP_ROUTE) {
      setShouldHoldForPersistedSession(false);
      return;
    }
    if (initialized) {
      setShouldHoldForPersistedSession(false);
      return;
    }
    setShouldHoldForPersistedSession(readPersistedSupabaseSessionHint());
  }, [initialized, router.pathname]);

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    document.documentElement.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
      document.documentElement.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated || shouldHoldForPersistedSession) {
      void loadAuthenticatedDashboardRoute();
    }
  }, [isAuthenticated, shouldHoldForPersistedSession]);

  const loginHref = `/auth?next=${encodeURIComponent("/dashboard")}`;
  const guestCreateProjectHref = buildPricingPath({ intent: "create-project" });
  const pageTitle = isAuthenticated ? "ShortPulse · Dashboard" : "ShortPulse · Home";

  if (isDashboardBootstrapPending) {
    return (
      <>
        <Head>
          <title>ShortPulse · Dashboard</title>
          <meta
            name="description"
            content="ShortPulse dashboard bootstrap while your authenticated workspace session resolves."
          />
        </Head>
        <ProjectEntryLoadingSurface
          title={DASHBOARD_BOOTSTRAP_TITLE}
          message={DASHBOARD_BOOTSTRAP_MESSAGE}
          steps={[]}
          activeStepIndex={0}
          stepsAriaLabel="Dashboard loading progress"
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="ShortPulse public dashboard and workspace entry for pricing, account access, and AI Studio project flow."
        />
      </Head>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {isAuthenticated && user ? (
        <AuthenticatedDashboardRouteBoundary billingCatalog={billingCatalog} user={user} />
      ) : (
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
      )}
    </>
  );
}
