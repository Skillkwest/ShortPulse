/**
 * Session-aware dashboard route.
 * Serves as the public home/dashboard shell while keeping authenticated bootstrap off the public entry chunk.
 */
import Head from "next/head";
import { useEffect, useState } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import { PublicDashboardRoute } from "../features/dashboard/routes/PublicDashboardRoute";
import { ProjectEntryLoadingSurface } from "../features/projects/components/ProjectEntryLoadingSurface";
import {
  emptyBillingCatalogSnapshot,
  loadPublicDashboardStaticProps,
  type PublicDashboardStaticProps,
} from "../features/dashboard/routes/publicDashboardData";
import { readSupabaseSessionBootstrapHint } from "../lib/supabaseSessionHints";

const DASHBOARD_BOOTSTRAP_TITLE = "Loading dashboard";
const DASHBOARD_BOOTSTRAP_MESSAGE = "Checking your session before your dashboard workspace loads.";

type DashboardPageStaticProps = InferGetStaticPropsType<typeof getStaticProps>;

type SessionAwareDashboardRouteComponent =
  (typeof import("../features/dashboard/routes/DashboardRouteSessionAware"))["DashboardRouteSessionAware"];

let dashboardRouteSessionAwarePromise: Promise<SessionAwareDashboardRouteComponent> | null = null;
let dashboardRouteSessionAwareComponent: SessionAwareDashboardRouteComponent | null = null;

const loadDashboardRouteSessionAware = async () => {
  if (dashboardRouteSessionAwareComponent) {
    return dashboardRouteSessionAwareComponent;
  }
  if (!dashboardRouteSessionAwarePromise) {
    dashboardRouteSessionAwarePromise =
      import("../features/dashboard/routes/DashboardRouteSessionAware").then((loadedModule) => {
        dashboardRouteSessionAwareComponent = loadedModule.DashboardRouteSessionAware;
        return dashboardRouteSessionAwareComponent;
      });
  }
  return await dashboardRouteSessionAwarePromise;
};

if (typeof window !== "undefined" && readSupabaseSessionBootstrapHint()) {
  void loadDashboardRouteSessionAware();
}

/**
 * Loads the public billing catalog snapshot used by dashboard guest mode and the pricing route.
 */
export const getStaticProps: GetStaticProps<PublicDashboardStaticProps> = async () => {
  return {
    props: await loadPublicDashboardStaticProps(),
    revalidate: 60,
  };
};

/**
 * Renders the public/authenticated dashboard route.
 */
export default function DashboardPage({
  billingCatalog = emptyBillingCatalogSnapshot(),
  dashboardTutorials = [],
}: Partial<DashboardPageStaticProps> = {}) {
  const [shouldResolveSession, setShouldResolveSession] = useState(false);
  const [SessionAwareDashboardRoute, setSessionAwareDashboardRoute] =
    useState<SessionAwareDashboardRouteComponent | null>(() => dashboardRouteSessionAwareComponent);

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    document.documentElement.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
      document.documentElement.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    if (!readSupabaseSessionBootstrapHint()) return undefined;
    const timeoutId = window.setTimeout(() => {
      setShouldResolveSession(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!shouldResolveSession || SessionAwareDashboardRoute) return;
    let cancelled = false;
    void loadDashboardRouteSessionAware().then((component) => {
      if (!cancelled) {
        setSessionAwareDashboardRoute(() => component);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [SessionAwareDashboardRoute, shouldResolveSession]);

  if (!shouldResolveSession) {
    return (
      <PublicDashboardRoute
        billingCatalog={billingCatalog}
        dashboardTutorials={dashboardTutorials}
        manageBodyClass={false}
      />
    );
  }

  if (!SessionAwareDashboardRoute) {
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
    <SessionAwareDashboardRoute
      billingCatalog={billingCatalog}
      dashboardTutorials={dashboardTutorials}
    />
  );
}
