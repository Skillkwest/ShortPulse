/**
 * Session-aware dashboard route branch.
 * Owns client session bootstrap and authenticated dashboard rendering behind the `/dashboard` async seam.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useLayoutEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthenticatedDashboardRoute } from "../components/AuthenticatedDashboardRoute";
import { ProjectEntryLoadingSurface } from "../../projects/components/ProjectEntryLoadingSurface";
import { PublicDashboardRoute } from "./PublicDashboardRoute";
import {
  emptyBillingCatalogSnapshot,
  type PublicDashboardStaticProps,
} from "./publicDashboardData";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";
import { readPersistedSupabaseSessionHint } from "../../../lib/supabaseSessionHints";

const DASHBOARD_BOOTSTRAP_ROUTE = "/dashboard";
const DASHBOARD_BOOTSTRAP_TITLE = "Loading dashboard";
const DASHBOARD_BOOTSTRAP_MESSAGE = "Checking your session before your dashboard workspace loads.";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type DashboardRouteSessionAwareProps = Partial<PublicDashboardStaticProps>;

const renderDashboardBootstrap = () => (
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

/**
 * Renders the session-aware `/dashboard` branch behind the lightweight page shell.
 */
export function DashboardRouteSessionAware({
  billingCatalog = emptyBillingCatalogSnapshot(),
  dashboardOffers = [],
}: DashboardRouteSessionAwareProps) {
  const router = useRouter();
  const { initialized, session, user } = useSupabaseSessionState();
  const [shouldHoldForPersistedSession, setShouldHoldForPersistedSession] = useState(false);
  const isDashboardBootstrapPending =
    router.pathname === DASHBOARD_BOOTSTRAP_ROUTE && !initialized && shouldHoldForPersistedSession;
  const isAuthenticated = Boolean(user);

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

  if (isDashboardBootstrapPending) {
    return renderDashboardBootstrap();
  }

  if (!isAuthenticated || !user) {
    return (
      <PublicDashboardRoute
        billingCatalog={billingCatalog}
        dashboardOffers={dashboardOffers}
        manageBodyClass={false}
      />
    );
  }

  if (!session) {
    return renderDashboardBootstrap();
  }

  return (
    <ProtectedRouteSessionProvider session={session} user={user}>
      <>
        <Head>
          <title>ShortPulse · Dashboard</title>
          <meta
            name="description"
            content="ShortPulse dashboard bootstrap while your authenticated workspace session resolves."
          />
        </Head>

        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <AuthenticatedDashboardRoute billingCatalog={billingCatalog} user={user as User} />
      </>
    </ProtectedRouteSessionProvider>
  );
}
