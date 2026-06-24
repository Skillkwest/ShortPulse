/**
 * Generic protected-route bootstrap gate.
 * Owns session/compliance checks for non-AI-Studio protected routes so the
 * shared app shell does not statically own those runtime dependencies.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, type ReactNode } from "react";
import { MediaComplianceGate } from "../components/MediaComplianceGate";
import { useMediaComplianceGate } from "../hooks/useMediaComplianceGate";
import { buildLoginPath } from "../../../lib/authRedirects";
import { useProtectedRoute } from "../../../lib/authGuard";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";

type ProtectedRouteBootstrapGateProps = {
  children: ReactNode;
};

const GenericProtectedLoader = ({ message }: { message: string }) => (
  <>
    <Head>
      <title>ShortPulse · Loading</title>
    </Head>
    <main className="page page-wide">
      <div className="panel">
        <p className="subdued">{message}</p>
      </div>
    </main>
  </>
);

/**
 * Resolves shared protected-route prerequisites before page content renders.
 */
export function ProtectedRouteBootstrapGate({ children }: ProtectedRouteBootstrapGateProps) {
  const router = useRouter();
  const authRedirectPath = useMemo(
    () => buildLoginPath({ nextPath: router.asPath || "/dashboard" }),
    [router.asPath]
  );
  const { loading, session, user } = useProtectedRoute(true);
  const mediaCompliance = useMediaComplianceGate({
    enabled: Boolean(session),
    userId: user?.id ?? null,
  });

  useEffect(() => {
    if (mediaCompliance.status !== "auth_recovery_required") return;
    void router.replace(authRedirectPath);
  }, [authRedirectPath, mediaCompliance.status, router]);

  if (loading || !session) {
    return <GenericProtectedLoader message="Checking your session…" />;
  }

  if (mediaCompliance.status === "loading") {
    return <GenericProtectedLoader message="Checking your media agreement…" />;
  }

  if (mediaCompliance.status === "auth_recovery_required") {
    return <GenericProtectedLoader message="Refreshing your session…" />;
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

  const resolvedUser = user ?? session.user;

  return (
    <ProtectedRouteSessionProvider session={session} user={resolvedUser}>
      {children}
    </ProtectedRouteSessionProvider>
  );
}
