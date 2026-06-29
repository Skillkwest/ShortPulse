/**
 * Session-aware dashboard route branch.
 * Owns client session bootstrap and authenticated dashboard rendering behind the `/dashboard` async seam.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthenticatedDashboardRoute } from "../components/AuthenticatedDashboardRoute";
import { ProjectEntryLoadingSurface } from "../../projects/components/ProjectEntryLoadingSurface";
import { PublicDashboardRoute } from "./PublicDashboardRoute";
import {
  emptyBillingCatalogSnapshot,
  type PublicDashboardStaticProps,
} from "./publicDashboardData";
import { MediaComplianceGate } from "../../compliance/components/MediaComplianceGate";
import { useMediaComplianceGate } from "../../compliance/hooks/useMediaComplianceGate";
import { buildLoginPath } from "../../../lib/authRedirects";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";
import { readPersistedSupabaseSessionHint } from "../../../lib/supabaseSessionHints";
import { useProtectedRouteRestoreGuard } from "../../../lib/useProtectedRouteRestoreGuard";

const DASHBOARD_BOOTSTRAP_ROUTE = "/dashboard";
const ROOT_BOOTSTRAP_ROUTE = "/";
const DASHBOARD_AUTHENTICATED_TITLE = "ShortPulse · Dashboard";
const DASHBOARD_BOOTSTRAP_TITLE = "Loading dashboard";
const DASHBOARD_BOOTSTRAP_MESSAGE = "Checking your session before your dashboard workspace loads.";
const NEXT_ROUTE_ANNOUNCER_ID = "__next-route-announcer__";

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
  dashboardTutorials = [],
}: DashboardRouteSessionAwareProps) {
  const router = useRouter();
  const { initialized, session, user } = useSupabaseSessionState();
  const [shouldHoldForPersistedSession, setShouldHoldForPersistedSession] = useState(false);
  const authRedirectPath = useMemo(
    () => buildLoginPath({ nextPath: router.asPath || "/dashboard" }),
    [router.asPath]
  );
  const isDashboardBootstrapPending =
    (router.pathname === DASHBOARD_BOOTSTRAP_ROUTE || router.pathname === ROOT_BOOTSTRAP_ROUTE) &&
    !initialized &&
    shouldHoldForPersistedSession;
  const isAuthenticated = Boolean(user);
  const restoreGuard = useProtectedRouteRestoreGuard({
    enabled: Boolean(session || user || shouldHoldForPersistedSession),
    nextPath: router.asPath || "/dashboard",
    missingSessionBehavior: "clear",
  });
  const mediaCompliance = useMediaComplianceGate({
    enabled: Boolean(session),
    userId: user?.id ?? session?.user?.id ?? null,
  });

  useIsomorphicLayoutEffect(() => {
    const isBootstrapRoute =
      router.pathname === DASHBOARD_BOOTSTRAP_ROUTE || router.pathname === ROOT_BOOTSTRAP_ROUTE;
    if (!isBootstrapRoute) {
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
    if (!isAuthenticated || typeof document === "undefined") return;
    document.title = DASHBOARD_AUTHENTICATED_TITLE;
    const routeAnnouncer = document.getElementById(NEXT_ROUTE_ANNOUNCER_ID);
    if (routeAnnouncer) {
      routeAnnouncer.textContent = DASHBOARD_AUTHENTICATED_TITLE;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (mediaCompliance.status !== "auth_recovery_required") return;
    void router.replace(authRedirectPath);
  }, [authRedirectPath, mediaCompliance.status, router]);

  if (isDashboardBootstrapPending || restoreGuard.checking) {
    return renderDashboardBootstrap();
  }

  if (!isAuthenticated || !user) {
    return (
      <PublicDashboardRoute
        billingCatalog={billingCatalog}
        dashboardTutorials={dashboardTutorials}
        manageBodyClass={false}
      />
    );
  }

  if (!session) {
    return renderDashboardBootstrap();
  }

  if (mediaCompliance.status === "loading") {
    return renderDashboardBootstrap();
  }

  if (mediaCompliance.status === "auth_recovery_required") {
    return renderDashboardBootstrap();
  }

  if (mediaCompliance.status === "service_unavailable") {
    return (
      <MediaComplianceGate
        mode="unavailable"
        agreement={mediaCompliance.agreement}
        error={mediaCompliance.error}
        loading={mediaCompliance.loading}
        primaryActionLabel="Retry"
        showSecondaryAction={false}
        onAccept={mediaCompliance.acceptAgreement}
        onRetry={mediaCompliance.refreshStatus}
      />
    );
  }

  if (mediaCompliance.status === "needs_consent") {
    return (
      <MediaComplianceGate
        agreement={mediaCompliance.agreement}
        error={mediaCompliance.error}
        loading={mediaCompliance.loading}
        onAccept={mediaCompliance.acceptAgreement}
        onRetry={mediaCompliance.refreshStatus}
      />
    );
  }

  return (
    <ProtectedRouteSessionProvider session={session} user={user}>
      <>
        <Head>
          <title>{DASHBOARD_AUTHENTICATED_TITLE}</title>
          <meta
            name="description"
            content="ShortPulse dashboard bootstrap while your authenticated workspace session resolves."
          />
        </Head>

        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <AuthenticatedDashboardRoute
          billingCatalog={billingCatalog}
          dashboardTutorials={dashboardTutorials}
          user={user as User}
        />
      </>
    </ProtectedRouteSessionProvider>
  );
}
