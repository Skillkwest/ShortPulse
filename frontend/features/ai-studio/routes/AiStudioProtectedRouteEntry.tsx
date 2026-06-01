/**
 * Thin AI Studio route entry.
 * Owns auth/compliance bootstrap so the heavy studio runtime only loads after
 * protected-route prerequisites are satisfied.
 */
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, type ComponentType } from "react";
import { AppErrorBoundary } from "../../../components/AppErrorBoundary";
import { useProtectedRoute } from "../../../lib/authGuard";
import { MediaComplianceGate } from "../../compliance/components/MediaComplianceGate";
import { useMediaComplianceGate } from "../../compliance/hooks/useMediaComplianceGate";
import { AiStudioProjectEntryState } from "../components/AiStudioProjectEntryState";

const loadAiStudioRouteApp = () => import("./AiStudioRouteApp");

const AiStudioRouteApp = dynamic(loadAiStudioRouteApp, {
  loading: () => (
    <AiStudioProjectEntryState
      variant="loading"
      phase="resolving-project"
      stepsAriaLabel="Project loading progress"
    />
  ),
});

type AiStudioProtectedRouteEntryProps = {
  RuntimeComponent?: ComponentType;
};

/**
 * Resolves route-access prerequisites before the full AI Studio runtime loads.
 */
export default function AiStudioProtectedRouteEntry({
  RuntimeComponent = AiStudioRouteApp,
}: AiStudioProtectedRouteEntryProps) {
  const router = useRouter();
  const authRedirectPath = useMemo(
    () => `/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`,
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

  useEffect(() => {
    if (loading || !session) return;
    if (mediaCompliance.status !== "accepted") return;
    void loadAiStudioRouteApp();
  }, [loading, mediaCompliance.status, session]);

  if (loading || !session) {
    return (
      <AiStudioProjectEntryState
        variant="loading"
        phase="resolving-project"
        message="Checking your session before project restore continues."
        activeStepIndex={0}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "loading") {
    return (
      <AiStudioProjectEntryState
        variant="loading"
        phase="resolving-project"
        message="Checking your media agreement before project restore continues."
        activeStepIndex={1}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "auth_recovery_required") {
    return (
      <AiStudioProjectEntryState
        variant="loading"
        phase="resolving-project"
        message="Refreshing your session before project restore continues."
        activeStepIndex={0}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "service_unavailable") {
    return (
      <AppErrorBoundary>
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
      </AppErrorBoundary>
    );
  }

  if (mediaCompliance.status === "needs_consent") {
    return (
      <AppErrorBoundary>
        <MediaComplianceGate
          agreement={mediaCompliance.agreement}
          error={mediaCompliance.error}
          loading={mediaCompliance.loading}
          onAccept={mediaCompliance.acceptAgreement}
          onRetry={mediaCompliance.refreshStatus}
        />
      </AppErrorBoundary>
    );
  }

  return <RuntimeComponent />;
}
